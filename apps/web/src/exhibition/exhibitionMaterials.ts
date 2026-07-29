import * as THREE from 'three';

export const EXHIBITION_COLORS = {
  wall: '#edf0e8',
  ceiling: '#f8f5ec',
  floor: '#70877b',
  darkGreen: '#173f35',
  mint: '#a9d8b8',
  gold: '#c5a35a',
  lake: '#73aeb2',
  ink: '#253632',
  white: '#f8faf5',
  foliage: '#5e9870',
  car: '#497c68'
} as const;

export function createHallMaterials() {
  return {
    wall: new THREE.MeshStandardMaterial({ color: EXHIBITION_COLORS.wall, roughness: 0.84 }),
    ceiling: new THREE.MeshStandardMaterial({ color: EXHIBITION_COLORS.ceiling, roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ color: EXHIBITION_COLORS.floor, roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: '#4c352a', roughness: 0.76 }),
    metal: new THREE.MeshStandardMaterial({
      color: EXHIBITION_COLORS.darkGreen,
      roughness: 0.58,
      metalness: 0.28
    }),
    water: new THREE.MeshPhysicalMaterial({
      color: EXHIBITION_COLORS.lake,
      roughness: 0.24,
      transparent: true,
      opacity: 0.78
    })
  };
}

export type HallMaterials = ReturnType<typeof createHallMaterials>;
