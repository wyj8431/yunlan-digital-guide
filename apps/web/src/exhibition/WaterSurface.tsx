import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WATER_FRAGMENT_SHADER, WATER_VERTEX_SHADER } from './waterShader';

type WaterSurfaceProps = {
  color: string;
  position?: [number, number, number];
  radius?: number;
};

export function WaterSurface({ color, position = [0, 0.05, -6.8], radius = 2.95 }: WaterSurfaceProps) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) }
    }),
    []
  );

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = clock.getElapsedTime();
    material.current.uniforms.uColor.value.set(color);
  });

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[radius, 64]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={WATER_VERTEX_SHADER}
        fragmentShader={WATER_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
