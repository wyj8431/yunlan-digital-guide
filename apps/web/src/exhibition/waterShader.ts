export const WATER_VERTEX_SHADER = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float waveA = sin(position.x * 3.4 + uTime * 1.2);
    float waveB = cos(position.y * 4.1 - uTime * 0.85);
    float waveC = sin((position.x + position.y) * 6.0 + uTime * 0.55);
    vWave = (waveA + waveB + waveC) / 3.0;
    transformed.z += vWave * 0.045;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

export const WATER_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    vec2 centered = vUv - 0.5;
    float ripple = sin(length(centered) * 32.0 - uTime * 1.6) * 0.5 + 0.5;
    float shimmer = smoothstep(0.35, 0.95, ripple) * 0.22;
    vec3 color = uColor + vec3(shimmer + max(vWave, 0.0) * 0.08);
    gl_FragColor = vec4(color, 0.82);
  }
`;
