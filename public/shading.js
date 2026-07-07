import * as THREE from "three";

// Ghibli-style toon shading helpers.
//
// The pipeline works by converting MeshStandardMaterial (both the primitives
// built in app.js and materials arriving on loaded GLTF models) into
// MeshToonMaterial driven by a shared gradient ramp, then injecting a soft
// fresnel rim light into the toon shader. Color/emissive instances are shared
// with the source material so existing tint animations keep working after
// conversion.

const ramps = new Map();

export function getToonRamp(steps = 4, soft = true) {
  const key = `${steps}-${soft}`;
  if (ramps.has(key)) {
    return ramps.get(key);
  }
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i += 1) {
    // Lift the darkest band so shadows stay airy instead of muddy.
    const t = steps === 1 ? 1 : i / (steps - 1);
    data[i] = Math.round(THREE.MathUtils.lerp(96, 255, Math.pow(t, 0.85)));
  }
  const texture = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  texture.minFilter = soft ? THREE.LinearFilter : THREE.NearestFilter;
  texture.magFilter = soft ? THREE.LinearFilter : THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  ramps.set(key, texture);
  return texture;
}

const RIM_DEFAULTS = {
  color: new THREE.Color("#fff3d6"),
  strength: 0.14,
  power: 2.6
};

function injectRimLight(material, options = {}) {
  const rimColor = options.color ? new THREE.Color(options.color) : RIM_DEFAULTS.color.clone();
  const rimStrength = options.strength ?? RIM_DEFAULTS.strength;
  const rimPower = options.power ?? RIM_DEFAULTS.power;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: rimColor };
    shader.uniforms.uRimStrength = { value: rimStrength };
    shader.uniforms.uRimPower = { value: rimPower };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        [
          "uniform vec3 uRimColor;",
          "uniform float uRimStrength;",
          "uniform float uRimPower;",
          "void main() {"
        ].join("\n")
      )
      .replace(
        "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;",
        [
          "float rimFacing = 1.0 - saturate(abs(dot(normalize(vViewPosition), normal)));",
          "vec3 rimGlow = uRimColor * pow(rimFacing, uRimPower) * uRimStrength;",
          "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance + rimGlow * diffuseColor.rgb;"
        ].join("\n")
      );
  };
  // Materials with onBeforeCompile need a distinct cache key per variant.
  material.customProgramCacheKey = () => `ghibli-rim-${rimStrength}-${rimPower}`;
}

const conversionCache = new Map();

export function toToonMaterial(source) {
  if (!source || !source.isMeshStandardMaterial) {
    return source;
  }
  if (conversionCache.has(source)) {
    return conversionCache.get(source);
  }

  const toon = new THREE.MeshToonMaterial({
    gradientMap: getToonRamp(),
    map: source.map || null,
    normalMap: source.normalMap || null,
    aoMap: source.aoMap || null,
    alphaMap: source.alphaMap || null,
    emissiveMap: source.emissiveMap || null,
    emissiveIntensity: source.emissiveIntensity,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    side: source.side,
    fog: source.fog,
    flatShading: source.flatShading,
    name: source.name
  });
  // Share the Color instances so tint animations on the source keep applying.
  toon.color = source.color;
  toon.emissive = source.emissive;

  if (!source.userData.noRim) {
    injectRimLight(toon, source.userData.rim || {});
  }
  toon.userData = { ...source.userData, sourceMaterial: source };

  conversionCache.set(source, toon);
  return toon;
}

export function convertObjectToToon(root) {
  root.traverse((object) => {
    if (!object.isMesh || object.isSprite) {
      return;
    }
    if (Array.isArray(object.material)) {
      object.material = object.material.map(toToonMaterial);
    } else {
      object.material = toToonMaterial(object.material);
    }
  });
  return root;
}

// Inverted-hull outline: a slightly inflated back-face copy drawn behind the
// mesh, giving the classic hand-drawn contour line. Uses a ShaderMaterial so
// the built-in `position`/`normal` attributes are always declared (a patched
// MeshBasicMaterial has no `objectNormal` to offset along).
export function addToonOutline(mesh, options = {}) {
  const color = options.color || "#33261c";
  const thickness = options.thickness ?? 0.015;

  const outlineMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uThickness: { value: thickness }
    },
    vertexShader: `
      uniform float uThickness;
      void main() {
        vec3 inflated = position + normalize(normal) * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(inflated, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
    side: THREE.BackSide
  });

  const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
  outline.name = `${mesh.name || "mesh"}-outline`;
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.renderOrder = (mesh.renderOrder || 0) - 1;
  mesh.add(outline);
  return outline;
}
