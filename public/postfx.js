import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Post-processing chain: scene render -> soft bloom -> tone mapping + sRGB.
// Bloom is tuned low so only genuinely bright pixels (sun, halo, emissive
// highlights) get a gentle dreamy glow rather than washing out the frame.
export function createPostPipeline(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.55, 0.85);
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,
    setSize(width, height) {
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      composer.setSize(width, height);
    },
    render() {
      composer.render();
    }
  };
}
