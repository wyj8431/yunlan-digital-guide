import { Html, useAnimations, useGLTF } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const HISTORY_CULTURAL_HALL_MODEL = '/wuzhen/wuzhen_history_cultural_hall_reference.glb';

function AnimatedHistoryCulturalHallModel() {
  const root = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(HISTORY_CULTURAL_HALL_MODEL);
  const { actions } = useAnimations(animations, root);

  useEffect(() => {
    Object.values(actions).forEach((action) => action?.reset().play());
    return () => Object.values(actions).forEach((action) => action?.stop());
  }, [actions]);

  return <group ref={root}><primitive object={scene} /></group>;
}

function HistoryHallExit() {
  const exitBackplate = useRef<THREE.Mesh>(null!);

  return <group position={[0, 0, -15.42]}>
    <mesh ref={exitBackplate} position={[0, 3.5, -0.08]}>
      <boxGeometry args={[6.8, 7, 0.08]} />
      <meshStandardMaterial color="#071c26" emissive="#00bfd7" emissiveIntensity={1.7} transparent opacity={0.82} roughness={0.18} metalness={0.42} />
    </mesh>
    <mesh castShadow position={[-3.45, 3.5, 0]}>
      <boxGeometry args={[0.36, 7.3, 0.42]} />
      <meshStandardMaterial color="#8d6832" emissive="#10b8c8" emissiveIntensity={1.2} roughness={0.25} metalness={0.7} />
    </mesh>
    <mesh castShadow position={[3.45, 3.5, 0]}>
      <boxGeometry args={[0.36, 7.3, 0.42]} />
      <meshStandardMaterial color="#8d6832" emissive="#10b8c8" emissiveIntensity={1.2} roughness={0.25} metalness={0.7} />
    </mesh>
    <mesh castShadow position={[0, 7, 0]}>
      <boxGeometry args={[7.26, 0.36, 0.42]} />
      <meshStandardMaterial color="#8d6832" emissive="#10b8c8" emissiveIntensity={1.2} roughness={0.25} metalness={0.7} />
    </mesh>
    <mesh position={[0, 0.09, 0]}>
      <boxGeometry args={[7.26, 0.2, 0.7]} />
      <meshStandardMaterial color="#be9653" emissive="#087f91" emissiveIntensity={1} roughness={0.3} metalness={0.55} />
    </mesh>
    <pointLight color="#4ee8ff" intensity={16} distance={16} position={[0, 4.5, 2]} />
    <Html position={[0, 8.15, 0.16]} center distanceFactor={8} transform occlude={false}>
      <div className="wuzhen-history-exit-label" data-zone="history-exit">
        <strong>出口 · 返回主展厅</strong>
        <span>RETURN TO ATRIUM</span>
      </div>
    </Html>
  </group>;
}

export function HistoryCulturalHallScene() {
  return <>
    <color attach="background" args={['#05070d']} />
    <fog attach="fog" args={['#05070d', 21, 50]} />
    <ambientLight color="#ffd5ac" intensity={1.05} />
    <pointLight color="#ff7b39" intensity={28} distance={30} position={[0, 5, -12]} />
    <pointLight color="#256ce0" intensity={18} distance={28} position={[0, 8, 8]} />
    <AnimatedHistoryCulturalHallModel />
    <HistoryHallExit />
  </>;
}

useGLTF.preload(HISTORY_CULTURAL_HALL_MODEL);
