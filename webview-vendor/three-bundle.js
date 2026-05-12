// Re-exports three.js plus the UnrealBloomPass + EffectComposer/RenderPass helpers
// so they share the SAME THREE instance used by 3d-force-graph at runtime.
export * from 'three';
export { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
export { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
export { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
export { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
