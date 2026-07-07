import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { convertObjectToToon, addToonOutline } from "./shading.js";

// GLTF model pipeline. Every loaded model automatically goes through the
// Ghibli toon conversion, gets shadows enabled, and can be placed on the
// planet surface, outlined, and animated — all driven by plain options so
// new models normally only need an entry in /models/manifest.json.
//
// Manifest entry fields (all optional except url):
//   { "id": "post-office",            unique name, defaults to url
//     "url": "/models/post-office.glb",
//     "normal": [0.5, 0.3, 0.8],      unit direction on the planet surface
//     "offset": 0.02,                 lift above the surface
//     "forward": [0, 0, -1],          facing direction (tangent projected)
//     "rotateY": 45,                  extra yaw in degrees
//     "scale": 0.8,                   uniform scale
//     "outline": true,                inverted-hull contour (or {color,thickness})
//     "animate": "Idle",              clip name, true/"all" for every clip,
//                                     false to skip; defaults to all clips
//     "toon": true }                  set false to keep original materials

export function createModelPipeline({ world, placeOnPlanet }) {
  const gltfLoader = new GLTFLoader();

  const draco = new DRACOLoader();
  draco.setDecoderPath("/vendor/three/examples/jsm/libs/draco/gltf/");
  gltfLoader.setDRACOLoader(draco);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  const fbxLoader = new FBXLoader();
  const textureLoader = new THREE.TextureLoader();

  const mixers = [];
  const loaded = new Map();

  // Loads .glb/.gltf via GLTFLoader and .fbx via FBXLoader, normalizing both to
  // { root, animations }. FBX returns the Object3D directly with clips on
  // .animations; GLTF nests the graph under .scene.
  async function loadRaw(url) {
    if (/\.fbx$/i.test(url)) {
      const object = await fbxLoader.loadAsync(url);
      return { root: object, animations: object.animations || [] };
    }
    const gltf = await gltfLoader.loadAsync(url);
    return { root: gltf.scene, animations: gltf.animations || [] };
  }

  // Applies optional color/normal texture maps (Maya/FBX exports need
  // flipY = false so baked UVs line up).
  function applyTextures(root, options) {
    if (!options.map && !options.normalMap) {
      return;
    }
    const map = options.map ? textureLoader.load(options.map) : null;
    const normalMap = options.normalMap ? textureLoader.load(options.normalMap) : null;
    if (map) {
      map.colorSpace = THREE.SRGBColorSpace;
      map.flipY = false;
    }
    if (normalMap) {
      normalMap.flipY = false;
    }
    root.traverse((object) => {
      if (!object.isMesh) {
        return;
      }
      object.material = new THREE.MeshStandardMaterial({
        map: map || object.material.map || null,
        normalMap: normalMap || null,
        roughness: options.roughness ?? 0.9,
        metalness: 0
      });
    });
  }

  // Scales root uniformly so its bounding-sphere radius equals targetRadius,
  // then recenters it on the world origin. Used to fit an arbitrary planet
  // mesh into the fixed PLANET_RADIUS sphere the movement code assumes.
  function fitToRadius(root, targetRadius) {
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const sourceRadius = Math.max(size.x, size.z) / 2;
    if (sourceRadius > 0) {
      root.scale.multiplyScalar(targetRadius / sourceRadius);
    }
    const recentered = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    recentered.getCenter(center);
    root.position.sub(center);
    const finalSize = new THREE.Vector3();
    recentered.getSize(finalSize);
    return finalSize.y / 2; // vertical radius after scaling
  }

  async function loadModel(url, options = {}) {
    const { root, animations } = await loadRaw(url);

    applyTextures(root, options);

    if (options.toon !== false) {
      convertObjectToToon(root);
    }
    root.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    if (options.outline) {
      const outlineOptions = options.outline === true ? {} : options.outline;
      root.traverse((object) => {
        if (object.isMesh && !object.name.endsWith("-outline")) {
          addToonOutline(object, outlineOptions);
        }
      });
    }

    if (options.scale) {
      root.scale.setScalar(options.scale);
    }
    let verticalRadius = null;
    if (options.scaleToRadius) {
      verticalRadius = fitToRadius(root, options.scaleToRadius);
    }
    if (options.normal) {
      const normal = new THREE.Vector3(...options.normal).normalize();
      const forward = options.forward ? new THREE.Vector3(...options.forward) : null;
      placeOnPlanet(root, normal, options.offset ?? 0.02, forward);
    }
    if (options.rotateY) {
      root.rotateY(THREE.MathUtils.degToRad(options.rotateY));
    }
    world.add(root);

    let mixer = null;
    if (animations.length > 0 && options.animate !== false) {
      mixer = new THREE.AnimationMixer(root);
      const wantedClips =
        typeof options.animate === "string" && options.animate !== "all"
          ? animations.filter((clip) => clip.name === options.animate)
          : animations;
      wantedClips.forEach((clip) => mixer.clipAction(clip).play());
      mixers.push(mixer);
    }

    const record = { id: options.id || url, url, root, animations, mixer, verticalRadius };
    loaded.set(record.id, record);
    return record;
  }

  // Registers a mixer created outside loadModel (e.g. the player's idle/run
  // blend) so it advances with the shared update loop.
  function registerMixer(mixer) {
    mixers.push(mixer);
    return mixer;
  }

  async function loadManifest(url = "/models/manifest.json") {
    let entries = [];
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return [];
      }
      const manifest = await response.json();
      entries = Array.isArray(manifest) ? manifest : manifest.models || [];
    } catch {
      return [];
    }

    const results = [];
    for (const entry of entries) {
      try {
        results.push(await loadModel(entry.url, entry));
      } catch (error) {
        console.warn(`模型加载失败: ${entry.url}`, error);
      }
    }
    return results;
  }

  function update(dt) {
    mixers.forEach((mixer) => mixer.update(dt));
  }

  return { loadModel, loadManifest, loadRaw, registerMixer, update, loaded };
}
