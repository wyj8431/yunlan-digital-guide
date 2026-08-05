import { useAnimations, useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const FUTURE_WUZHEN_MODEL = '/wuzhen/future_wuzhen_grand_hall.glb';

function AnimatedFutureWuzhenModel() {
  const root = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(FUTURE_WUZHEN_MODEL);
  const keyAnimations = useMemo(
    () => animations.filter(({ name }) => name.startsWith('Awaken_Chamber_Orbit_Rig') || name.startsWith('Moon_Gate_')),
    [animations]
  );
  const { actions } = useAnimations(keyAnimations, root);

  useEffect(() => {
    Object.values(actions).forEach((action) => action?.reset().play());
    return () => Object.values(actions).forEach((action) => action?.stop());
  }, [actions]);

  return <group ref={root}><primitive object={scene} /></group>;
}

export function FutureWuzhenScene() {
  return <>
    <color attach="background" args={['#01070d']} />
    <fog attach="fog" args={['#01070d', 19, 49]} />
    <ambientLight color="#76d6ff" intensity={0.28} />
    <AnimatedFutureWuzhenModel />
  </>;
}

useGLTF.preload(FUTURE_WUZHEN_MODEL);
