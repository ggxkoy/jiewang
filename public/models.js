import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
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
  const loader = new GLTFLoader();

  const draco = new DRACOLoader();
  draco.setDecoderPath("/vendor/three/examples/jsm/libs/draco/gltf/");
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  const mixers = [];
  const loaded = new Map();

  async function loadModel(url, options = {}) {
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;

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
    if (gltf.animations.length > 0 && options.animate !== false) {
      mixer = new THREE.AnimationMixer(root);
      const wantedClips =
        typeof options.animate === "string" && options.animate !== "all"
          ? gltf.animations.filter((clip) => clip.name === options.animate)
          : gltf.animations;
      wantedClips.forEach((clip) => mixer.clipAction(clip).play());
      mixers.push(mixer);
    }

    const record = { id: options.id || url, url, root, animations: gltf.animations, mixer };
    loaded.set(record.id, record);
    return record;
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

  return { loadModel, loadManifest, update, loaded };
}
