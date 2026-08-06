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

const GodRaysShader = {
  uniforms: { tDiffuse: { value: null }, lightPosition: { value: new THREE.Vector2(0.72, 0.12) } },
  vertexShader: TransitionShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 lightPosition;
    varying vec2 vUv;
    void main() {
      vec2 delta = (vUv - lightPosition) * 0.035;
      vec2 sampleUv = vUv;
      vec3 scatter = vec3(0.0);
      float decay = 1.0;
      for (int i = 0; i < 12; i++) {
        sampleUv -= delta;
        vec3 sampleColor = texture2D(tDiffuse, sampleUv).rgb;
        float luminance = max(max(sampleColor.r, sampleColor.g), sampleColor.b);
        scatter += sampleColor * smoothstep(0.72, 1.15, luminance) * decay;
        decay *= 0.89;
      }
      vec4 source = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(source.rgb + scatter * vec3(1.0, 0.84, 0.62) * 0.065, source.a);
    }
  `
};

const VolumetricFogShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, density: { value: 0.055 } },
  vertexShader: TransitionShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float density;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
    }
    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      float drift = noise(vUv * vec2(5.0, 3.0) + vec2(time * 0.018, 0.0));
      float heightFog = smoothstep(0.9, 0.08, vUv.y);
      float amount = density * heightFog * mix(0.45, 1.0, drift);
      gl_FragColor = vec4(mix(source.rgb, vec3(0.78, 0.84, 0.79), amount), source.a);
    }
  `
};

export function getPostProcessingFeatures(level: QualityLevel, reducedMotion: boolean) {
  const profile = QUALITY_PROFILES[level];
  return {
    godRays: profile.godRays && !reducedMotion,
    fog: profile.volumetricFog && !reducedMotion
  };
}

export function getPostProcessingPassNames(level: QualityLevel, reducedMotion: boolean): string[] {
  const profile = QUALITY_PROFILES[level];
  const features = getPostProcessingFeatures(level, reducedMotion);
  return [
    'render',
    ...(profile.ssao ? ['ssao'] : []),
    ...(profile.ssr ? ['ssr'] : []),
    ...(profile.bloom ? ['bloom'] : []),
    ...(profile.depthOfField && !reducedMotion ? ['depthOfField'] : []),
    ...(features.godRays ? ['godRays'] : []),
    ...(features.fog ? ['fog'] : []),
    'transition',
    'output'
  ];
}

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
  private readonly godRaysPass: ShaderPass;
  private readonly fogPass: ShaderPass;
  private readonly outputPass: OutputPass;
  private quality: QualityLevel;
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(private readonly options: PostProcessingPipelineOptions) {
    this.quality = options.quality ?? 'high';
    options.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    options.renderer.toneMappingExposure = 0.72;
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
    // Keep floor and wall reflections subtle; large image panels should stay crisp.
    this.ssrPass.thickness = 0.04;
    this.ssrPass.maxDistance = 2.4;
    this.ssrPass.opacity = 0.2;
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.42, 0.82);
    this.bokehPass = new BokehPass(options.scene, options.camera, {
      focus: 8,
      aperture: 0.000012,
      maxblur: 0.004
    });
    this.transitionPass = new ShaderPass(TransitionShader);
    this.godRaysPass = new ShaderPass(GodRaysShader);
    this.fogPass = new ShaderPass(VolumetricFogShader);
    this.outputPass = new OutputPass();
    this.rebuildPasses();
  }

  render(deltaSeconds: number): void {
    if (this.disposed) return;
    this.fogPass.uniforms.time.value += deltaSeconds;
    this.composer.render(deltaSeconds);
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

  getActivePassNames(): string[] {
    return getPostProcessingPassNames(this.quality, this.options.reducedMotion ?? false);
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
    this.godRaysPass.dispose();
    this.fogPass.dispose();
    this.outputPass.dispose();
  }

  private rebuildPasses(): void {
    const reducedMotion = this.options.reducedMotion ?? false;
    this.composer.passes.length = 0;
    const passByName = {
      render: this.renderPass,
      ssao: this.ssaoPass,
      ssr: this.ssrPass,
      bloom: this.bloomPass,
      depthOfField: this.bokehPass,
      godRays: this.godRaysPass,
      fog: this.fogPass,
      transition: this.transitionPass,
      output: this.outputPass
    };
    for (const name of getPostProcessingPassNames(this.quality, reducedMotion)) {
      this.composer.addPass(passByName[name as keyof typeof passByName]);
    }
  }
}
