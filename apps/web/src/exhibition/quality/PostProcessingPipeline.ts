import * as THREE from 'three';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { QUALITY_PROFILES, type QualityLevel } from './qualityProfile';

const TransitionShader = {
  uniforms: {
    tDiffuse: { value: null },
    progress: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float progress;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float vignette = smoothstep(0.82, 0.18, distance(vUv, vec2(0.5)));
      color.rgb *= mix(1.0, vignette, progress * 0.28);
      gl_FragColor = color;
    }
  `
};

export type PostProcessingPipelineOptions = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  quality?: QualityLevel;
  reducedMotion?: boolean;
};

export class PostProcessingPipeline {
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly ssaoPass: SSAOPass;
  private readonly ssrPass: SSRPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly bokehPass: BokehPass;
  private readonly transitionPass: ShaderPass;
  private readonly outputPass: OutputPass;
  private quality: QualityLevel;
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(private readonly options: PostProcessingPipelineOptions) {
    this.quality = options.quality ?? 'high';
    options.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    options.renderer.toneMappingExposure = 1;
    this.composer = new EffectComposer(options.renderer);
    this.renderPass = new RenderPass(options.scene, options.camera);
    this.ssaoPass = new SSAOPass(options.scene, options.camera, 1, 1);
    this.ssaoPass.kernelRadius = 12;
    this.ssaoPass.minDistance = 0.002;
    this.ssaoPass.maxDistance = 0.12;
    this.ssrPass = new SSRPass({
      renderer: options.renderer,
      scene: options.scene,
      camera: options.camera,
      width: 1,
      height: 1,
      groundReflector: null,
      selects: null
    });
    this.ssrPass.thickness = 0.018;
    this.ssrPass.maxDistance = 4;
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.42, 0.82);
    this.bokehPass = new BokehPass(options.scene, options.camera, {
      focus: 8,
      aperture: 0.000012,
      maxblur: 0.004
    });
    this.transitionPass = new ShaderPass(TransitionShader);
    this.outputPass = new OutputPass();
    this.rebuildPasses();
  }

  render(deltaSeconds: number): void {
    if (!this.disposed) this.composer.render(deltaSeconds);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const profile = QUALITY_PROFILES[this.quality];
    this.composer.setPixelRatio(Math.min(pixelRatio, profile.pixelRatio) * profile.postScale);
    this.composer.setSize(this.width, this.height);
    this.ssaoPass.setSize(this.width, this.height);
    this.ssrPass.setSize(this.width, this.height);
  }

  setQuality(level: QualityLevel): void {
    if (level === this.quality) return;
    this.quality = level;
    this.rebuildPasses();
    this.resize(this.width, this.height, window.devicePixelRatio || 1);
  }

  setFocus(target: THREE.Vector3 | null): void {
    if (this.options.reducedMotion) return;
    const uniforms = this.bokehPass.materialBokeh.uniforms;
    uniforms.focus.value = target
      ? this.options.camera.position.distanceTo(target)
      : this.options.camera.far;
  }

  setTransitionProgress(value: number): void {
    this.transitionPass.uniforms.progress.value = THREE.MathUtils.clamp(value, 0, 1);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.composer.dispose();
    this.ssaoPass.dispose();
    this.ssrPass.dispose();
    this.bloomPass.dispose();
    this.bokehPass.dispose();
    this.transitionPass.dispose();
    this.outputPass.dispose();
  }

  private rebuildPasses(): void {
    const profile = QUALITY_PROFILES[this.quality];
    const reducedMotion = this.options.reducedMotion ?? false;
    this.composer.passes.length = 0;
    this.composer.addPass(this.renderPass);
    if (profile.ssao) this.composer.addPass(this.ssaoPass);
    if (profile.ssr) this.composer.addPass(this.ssrPass);
    if (profile.bloom) this.composer.addPass(this.bloomPass);
    if (profile.depthOfField && !reducedMotion) this.composer.addPass(this.bokehPass);
    this.composer.addPass(this.transitionPass);
    this.composer.addPass(this.outputPass);
  }
}
