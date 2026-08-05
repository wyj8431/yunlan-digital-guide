import { Environment, Html } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { getExhibitFocusTarget, HOME_CAMERA_POSITION, type CameraFocusTarget } from './cameraFocus';
import { HALL_BOUNDS, HALL_COLLIDERS, PLAYER_RADIUS, resolveMovement } from './collision';
import { getInitialRenderDprCap, getNextRenderDpr } from './renderQuality';
import { EXHIBITION_TOUR_DWELL_MS, EXHIBITION_TOUR_ORDER, getNextTourExhibit } from './exhibitionTour';
import { HALL_ZONES, type HallZone, type HallZoneId } from './zones';
import { FutureWuzhenScene } from './FutureWuzhenScene';
import { HistoryCulturalHallScene } from './HistoryCulturalHallScene';
import {
  FUTURE_WUZHEN_BOUNDS,
  isFuturePortalEntry,
  isFutureReturnPortalEntry,
  isHistoryPortalEntry,
  isHistoryReturnPortalEntry,
  type ExhibitionSceneId
} from './futurePortal';

export { HALL_ZONES, type HallZone, type HallZoneId } from './zones';

export type HallExhibitId = 'tea-set' | 'silk-garment' | 'shuttle' | 'carved-window';

export type HallExhibit = {
  id: HallExhibitId;
  zoneId: HallZoneId;
  title: string;
  subtitle: string;
  description: string;
  asset: string;
  position: [number, number, number];
  targetHeight: number;
  rotation?: [number, number, number];
};

export type ExhibitionTelemetry = {
  position: [number, number, number];
  zoneId: HallZoneId;
};

export const EXHIBIT_PEDESTAL_TOP_Y = 0.9;

export const HALL_EXHIBITS: HallExhibit[] = [
  { id: 'tea-set', zoneId: 'heritage', title: '乌镇茶礼', subtitle: 'WUZHEN TEA CEREMONY', description: '一盏茶连接水乡待客之道，也让江南日常成为可以被细看和聆听的展品。', asset: '', position: [-8, EXHIBIT_PEDESTAL_TOP_Y, -6], targetHeight: 2.15, rotation: [0, 0.45, 0] },
  { id: 'silk-garment', zoneId: 'architecture', title: '水乡衣裳', subtitle: 'SILK GARMENT', description: '轻盈的丝料与克制的纹样，记录了乌镇街巷里延续至今的生活审美。', asset: '', position: [8, EXHIBIT_PEDESTAL_TOP_Y, -6], targetHeight: 3.2, rotation: [0, -0.32, 0] },
  { id: 'shuttle', zoneId: 'heritage', title: '蓝印花布织梭', subtitle: 'INDIGO WEAVING SHUTTLE', description: '织梭穿过经纬，留下蓝印花布的节奏。它是乌镇工艺从图案走向布面的关键一环。', asset: '', position: [-8, EXHIBIT_PEDESTAL_TOP_Y, 4], targetHeight: 1.4, rotation: [0, 0.18, 0] },
  { id: 'carved-window', zoneId: 'architecture', title: '乌镇木雕花窗', subtitle: 'JIANGNAN CARVED WINDOW', description: '花窗以木作框景，将街巷、庭院和水岸的光影收进江南建筑的细部。', asset: '', position: [8, EXHIBIT_PEDESTAL_TOP_Y, 4], targetHeight: 2.7, rotation: [0, -0.2, 0] },
];

type ThreeExhibitionProps = {
  weather: 'sun' | 'night' | 'rain';
  activeExhibitId: HallExhibitId | null;
  onSelectExhibit: (id: HallExhibitId) => void;
};

function ExhibitPedestal({ position }: { position: [number, number, number] }) {
  return <group position={[position[0], 0, position[2]]}>
    <mesh castShadow receiveShadow position={[0, 0.09, 0]}>
      <boxGeometry args={[4.05, 0.18, 3.05]} />
      <meshStandardMaterial color="#8f6e48" roughness={0.5} metalness={0.2} />
    </mesh>
    <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
      <boxGeometry args={[3.58, 0.72, 2.58]} />
      <meshStandardMaterial color="#334845" roughness={0.7} metalness={0.1} />
    </mesh>
    <mesh castShadow receiveShadow position={[0, 0.84, 0]}>
      <boxGeometry args={[3.78, 0.12, 2.8]} />
      <meshStandardMaterial color="#b18d5a" roughness={0.42} metalness={0.28} />
    </mesh>
    <mesh receiveShadow position={[0, 0.91, 0]}>
      <boxGeometry args={[3.48, 0.025, 2.52]} />
      <meshStandardMaterial color="#172e2d" roughness={0.64} metalness={0.08} />
    </mesh>
  </group>;
}

function ProceduralTeaSet({ exhibit, active, onSelect }: { exhibit: HallExhibit; active: boolean; onSelect: (id: HallExhibitId) => void }) {
  const group = useRef<THREE.Group>(null);
  const hover = useRef(false);
  const displayScale = exhibit.targetHeight / 1.34;

  useFrame((_, delta) => {
    if (!group.current) return;
    const emphasis = active || hover.current ? 1.05 : 1;
    group.current.scale.lerp(new THREE.Vector3(emphasis, emphasis, emphasis), Math.min(delta * 7, 1));
  });

  const select = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(exhibit.id); };

  return <group ref={group} position={exhibit.position} rotation={exhibit.rotation} scale={displayScale} onClick={select}
    onPointerOver={(event) => { event.stopPropagation(); hover.current = true; document.body.style.cursor = 'pointer'; }}
    onPointerOut={() => { hover.current = false; document.body.style.cursor = 'default'; }}>
    <mesh castShadow receiveShadow position={[0.08, 0.53, 0]} scale={[1, 0.72, 1]}>
      <sphereGeometry args={[0.58, 32, 24]} />
      <meshStandardMaterial color="#9fbeb4" roughness={0.28} metalness={0.08} />
    </mesh>
    <mesh castShadow receiveShadow position={[0.08, 1.02, 0]}>
      <cylinderGeometry args={[0.4, 0.45, 0.1, 28]} />
      <meshStandardMaterial color="#c8ddd2" roughness={0.22} metalness={0.06} />
    </mesh>
    <mesh castShadow receiveShadow position={[0.08, 1.2, 0]}>
      <sphereGeometry args={[0.11, 20, 16]} />
      <meshStandardMaterial color="#d9e9dd" roughness={0.24} metalness={0.05} />
    </mesh>
    <mesh castShadow receiveShadow position={[0.77, 0.62, 0]} rotation={[0, 0, -Math.PI / 2]}>
      <coneGeometry args={[0.22, 0.82, 24]} />
      <meshStandardMaterial color="#a8c8bd" roughness={0.28} metalness={0.06} />
    </mesh>
    <mesh castShadow receiveShadow position={[-0.62, 0.6, 0]}>
      <torusGeometry args={[0.37, 0.07, 16, 28]} />
      <meshStandardMaterial color="#8eb3a8" roughness={0.3} metalness={0.08} />
    </mesh>
    <mesh castShadow receiveShadow position={[-0.78, 0.08, 0.05]}>
      <cylinderGeometry args={[0.38, 0.42, 0.07, 28]} />
      <meshStandardMaterial color="#d6e5d9" roughness={0.22} metalness={0.05} />
    </mesh>
    <mesh castShadow receiveShadow position={[-0.78, 0.31, 0.05]}>
      <cylinderGeometry args={[0.23, 0.26, 0.42, 28]} />
      <meshStandardMaterial color="#8fbab0" roughness={0.28} metalness={0.08} />
    </mesh>
    <pointLight color={active ? '#e7fff1' : '#bbdfcf'} intensity={active ? 8 : 4.2} distance={5.5} position={[0, 1.7, 1]} />
  </group>;
}

function ProceduralSilkGarment({ exhibit, active, onSelect }: { exhibit: HallExhibit; active: boolean; onSelect: (id: HallExhibitId) => void }) {
  const group = useRef<THREE.Group>(null);
  const hover = useRef(false);
  const displayScale = exhibit.targetHeight / 2.65;

  useFrame((_, delta) => {
    if (!group.current) return;
    const emphasis = active || hover.current ? 1.05 : 1;
    group.current.scale.lerp(new THREE.Vector3(emphasis, emphasis, emphasis), Math.min(delta * 7, 1));
  });

  const select = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(exhibit.id); };

  return <group ref={group} position={exhibit.position} rotation={exhibit.rotation} scale={displayScale} onClick={select}
    onPointerOver={(event) => { event.stopPropagation(); hover.current = true; document.body.style.cursor = 'pointer'; }}
    onPointerOut={() => { hover.current = false; document.body.style.cursor = 'default'; }}>
    <mesh castShadow receiveShadow position={[0, 1.16, 0]} rotation={[0, Math.PI / 4, 0]}>
      <cylinderGeometry args={[0.7, 1.02, 2.3, 4]} />
      <meshStandardMaterial color="#365c78" roughness={0.35} metalness={0.08} />
    </mesh>
    <mesh castShadow receiveShadow position={[0, 2.3, 0]}>
      <boxGeometry args={[2.05, 0.14, 0.24]} />
      <meshStandardMaterial color="#d4b779" roughness={0.3} metalness={0.42} />
    </mesh>
    <mesh castShadow receiveShadow position={[0, 2.52, 0]}>
      <cylinderGeometry args={[0.08, 0.08, 1.75, 16]} />
      <meshStandardMaterial color="#624632" roughness={0.42} metalness={0.18} />
    </mesh>
    <mesh receiveShadow position={[0, 1.32, 0.78]}>
      <boxGeometry args={[1.5, 0.13, 0.08]} />
      <meshStandardMaterial color="#cfb36e" roughness={0.28} metalness={0.36} />
    </mesh>
    <mesh receiveShadow position={[0, 0.75, 0.87]}>
      <boxGeometry args={[1.78, 0.11, 0.08]} />
      <meshStandardMaterial color="#c6d6d3" roughness={0.3} metalness={0.2} />
    </mesh>
    <pointLight color={active ? '#ffe0a1' : '#f0c77c'} intensity={active ? 8 : 4.2} distance={6} position={[0, 2.25, 1.1]} />
  </group>;
}

function ProceduralCarvedWindow({ exhibit, active, onSelect }: { exhibit: HallExhibit; active: boolean; onSelect: (id: HallExhibitId) => void }) {
  const group = useRef<THREE.Group>(null);
  const hover = useRef(false);
  const displayScale = exhibit.targetHeight / 2.55;
  const timber = '#704832';
  const lattice = '#c4a166';

  useFrame((_, delta) => {
    if (!group.current) return;
    const emphasis = active || hover.current ? 1.05 : 1;
    group.current.scale.lerp(new THREE.Vector3(emphasis, emphasis, emphasis), Math.min(delta * 7, 1));
  });

  const select = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(exhibit.id); };

  return <group ref={group} position={exhibit.position} rotation={exhibit.rotation} scale={displayScale} onClick={select}
    onPointerOver={(event) => { event.stopPropagation(); hover.current = true; document.body.style.cursor = 'pointer'; }}
    onPointerOut={() => { hover.current = false; document.body.style.cursor = 'default'; }}>
    <mesh castShadow receiveShadow position={[0, 1.28, -0.02]}>
      <boxGeometry args={[1.7, 2.42, 0.13]} />
      <meshStandardMaterial color="#193837" roughness={0.72} metalness={0.08} />
    </mesh>
    <mesh castShadow receiveShadow position={[-0.95, 1.28, 0]}><boxGeometry args={[0.16, 2.58, 0.2]} /><meshStandardMaterial color={timber} roughness={0.42} metalness={0.16} /></mesh>
    <mesh castShadow receiveShadow position={[0.95, 1.28, 0]}><boxGeometry args={[0.16, 2.58, 0.2]} /><meshStandardMaterial color={timber} roughness={0.42} metalness={0.16} /></mesh>
    <mesh castShadow receiveShadow position={[0, 0.08, 0]}><boxGeometry args={[2.04, 0.16, 0.2]} /><meshStandardMaterial color={timber} roughness={0.42} metalness={0.16} /></mesh>
    <mesh castShadow receiveShadow position={[0, 2.48, 0]}><boxGeometry args={[2.04, 0.16, 0.2]} /><meshStandardMaterial color={timber} roughness={0.42} metalness={0.16} /></mesh>
    {[-0.48, 0, 0.48].map((x) => <mesh key={`vertical-${x}`} castShadow receiveShadow position={[x, 1.28, 0.1]}><boxGeometry args={[0.08, 2.05, 0.11]} /><meshStandardMaterial color={lattice} roughness={0.34} metalness={0.38} /></mesh>)}
    {[0.58, 1.28, 1.98].map((y) => <mesh key={`horizontal-${y}`} castShadow receiveShadow position={[0, y, 0.1]}><boxGeometry args={[1.55, 0.08, 0.11]} /><meshStandardMaterial color={lattice} roughness={0.34} metalness={0.38} /></mesh>)}
    <mesh castShadow receiveShadow position={[0, 1.28, 0.12]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[1.28, 0.075, 0.1]} /><meshStandardMaterial color="#d1b373" roughness={0.3} metalness={0.42} /></mesh>
    <mesh castShadow receiveShadow position={[0, 1.28, 0.12]} rotation={[0, 0, -Math.PI / 4]}><boxGeometry args={[1.28, 0.075, 0.1]} /><meshStandardMaterial color="#d1b373" roughness={0.3} metalness={0.42} /></mesh>
    <pointLight color={active ? '#ffe0a1' : '#e5bd76'} intensity={active ? 8 : 4.2} distance={5.5} position={[0, 1.5, 0.9]} />
  </group>;
}

function ProceduralShuttle({ exhibit, active, onSelect }: { exhibit: HallExhibit; active: boolean; onSelect: (id: HallExhibitId) => void }) {
  const group = useRef<THREE.Group>(null);
  const hover = useRef(false);
  const verticalScale = exhibit.targetHeight / 0.5;
  const footprintScale = Math.min(verticalScale * 0.76, 1.55);

  useFrame((_, delta) => {
    if (!group.current) return;
    const emphasis = active || hover.current ? 1.05 : 1;
    group.current.scale.lerp(new THREE.Vector3(emphasis, emphasis, emphasis), Math.min(delta * 7, 1));
  });

  const select = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(exhibit.id); };

  return (
    <group ref={group} position={exhibit.position} rotation={exhibit.rotation} scale={[footprintScale, verticalScale, footprintScale]} onClick={select}
      onPointerOver={(event) => { event.stopPropagation(); hover.current = true; document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { hover.current = false; document.body.style.cursor = 'default'; }}>
      <mesh castShadow receiveShadow position={[0, 0.26, 0]}>
        <boxGeometry args={[1.35, 0.2, 0.38]} />
        <meshStandardMaterial color="#7c4e2d" roughness={0.48} metalness={0.08} />
      </mesh>
      <mesh castShadow receiveShadow position={[-0.86, 0.26, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.25, 0.5, 12]} />
        <meshStandardMaterial color="#a9713d" roughness={0.42} metalness={0.06} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.86, 0.26, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.25, 0.5, 12]} />
        <meshStandardMaterial color="#a9713d" roughness={0.42} metalness={0.06} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.38, 0]}>
        <boxGeometry args={[0.84, 0.045, 0.23]} />
        <meshStandardMaterial color="#315d5a" roughness={0.4} metalness={0.12} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.43, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 1.25, 12]} />
        <meshStandardMaterial color="#d6b477" roughness={0.3} metalness={0.55} />
      </mesh>
      <pointLight color={active ? '#ffe1a5' : '#f1be68'} intensity={active ? 8 : 3.5} distance={4.5} position={[0, 0.7, 0]} />
    </group>
  );
}

function WallInformationPanels() {
  const timelineMarks = [-2.7, -1.35, 0, 1.35, 2.7];
  const historyPanel = useRef<THREE.Mesh>(null!);
  const waterwayPanel = useRef<THREE.Mesh>(null!);
  return <>
    <group position={[-14.72, 3.75, -3.2]} rotation={[0, Math.PI / 2, 0]}>
      <mesh ref={historyPanel} castShadow receiveShadow>
        <boxGeometry args={[7.8, 2.85, 0.12]} />
        <meshStandardMaterial color="#233c3a" roughness={0.7} metalness={0.08} />
      </mesh>
      <mesh position={[0, -0.42, 0.08]}>
        <boxGeometry args={[6.7, 0.06, 0.04]} />
        <meshStandardMaterial color="#c3a064" roughness={0.34} metalness={0.52} />
      </mesh>
      {timelineMarks.map((x) => <mesh key={x} position={[x, -0.42, 0.09]}>
        <boxGeometry args={[0.06, 0.38, 0.04]} />
        <meshStandardMaterial color="#c3a064" roughness={0.34} metalness={0.52} />
      </mesh>)}
      <mesh position={[-1.9, 0.32, 0.08]}>
        <boxGeometry args={[1.72, 0.72, 0.04]} />
        <meshStandardMaterial color="#c9bda6" roughness={0.78} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.32, 0.08]}>
        <boxGeometry args={[1.72, 0.72, 0.04]} />
        <meshStandardMaterial color="#b7c8ba" roughness={0.78} metalness={0.02} />
      </mesh>
      <mesh position={[1.9, 0.32, 0.08]}>
        <boxGeometry args={[1.72, 0.72, 0.04]} />
        <meshStandardMaterial color="#c9bda6" roughness={0.78} metalness={0.02} />
      </mesh>
      <Html position={[0, 0.96, 0.1]} center transform occlude={[historyPanel]}>
        <div className="wuzhen-zone-portal-label" data-zone="history-wall">
          <strong>乌镇历史时间轴</strong>
          <span>WUZHEN TIMELINE</span>
        </div>
      </Html>
    </group>
    <group position={[14.72, 3.75, -3.2]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh ref={waterwayPanel} castShadow receiveShadow>
        <boxGeometry args={[7.8, 2.85, 0.12]} />
        <meshStandardMaterial color="#233c3a" roughness={0.7} metalness={0.08} />
      </mesh>
      <mesh position={[0, -0.38, 0.08]} rotation={[0, 0.12, 0]}>
        <boxGeometry args={[6.55, 0.08, 0.05]} />
        <meshStandardMaterial color="#6aa8a4" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[-0.65, 0.02, 0.08]} rotation={[0, -0.52, 0]}>
        <boxGeometry args={[4.8, 0.08, 0.05]} />
        <meshStandardMaterial color="#6aa8a4" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[1.2, 0.5, 0.08]} rotation={[0, 0.7, 0]}>
        <boxGeometry args={[2.6, 0.08, 0.05]} />
        <meshStandardMaterial color="#6aa8a4" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[-2.1, 0.7, 0.08]}>
        <boxGeometry args={[0.9, 0.06, 0.04]} />
        <meshStandardMaterial color="#c3a064" roughness={0.34} metalness={0.52} />
      </mesh>
      <mesh position={[2.1, -0.78, 0.08]}>
        <boxGeometry args={[0.9, 0.06, 0.04]} />
        <meshStandardMaterial color="#c3a064" roughness={0.34} metalness={0.52} />
      </mesh>
      <Html position={[0, 0.96, 0.1]} center transform occlude={[waterwayPanel]}>
        <div className="wuzhen-zone-portal-label" data-zone="waterway-wall">
          <strong>水系与桥梁关系</strong>
          <span>WATERWAYS / BRIDGES</span>
        </div>
      </Html>
    </group>
  </>;
}

function EntranceGuideKiosk() {
  return <group position={[-5.4, 1.55, 8.85]}>
    <mesh castShadow receiveShadow position={[0, 0, 0]}>
      <boxGeometry args={[3.15, 2.45, 0.24]} />
      <meshStandardMaterial color="#263d3b" roughness={0.55} metalness={0.18} />
    </mesh>
    <mesh receiveShadow position={[0, 0.08, 0.15]}>
      <boxGeometry args={[2.72, 1.62, 0.04]} />
      <meshStandardMaterial color="#101b1b" emissive="#163c38" emissiveIntensity={0.35} roughness={0.46} metalness={0.22} />
    </mesh>
    <mesh receiveShadow position={[-0.8, -0.55, 0.18]}>
      <boxGeometry args={[0.58, 0.12, 0.04]} />
      <meshStandardMaterial color="#c3a064" roughness={0.34} metalness={0.52} />
    </mesh>
    <mesh receiveShadow position={[0, -0.55, 0.18]}>
      <boxGeometry args={[0.58, 0.12, 0.04]} />
      <meshStandardMaterial color="#6aa8a4" roughness={0.3} metalness={0.1} />
    </mesh>
    <mesh receiveShadow position={[0.8, -0.55, 0.18]}>
      <boxGeometry args={[0.58, 0.12, 0.04]} />
      <meshStandardMaterial color="#b7c8ba" roughness={0.78} metalness={0.02} />
    </mesh>
    <mesh castShadow receiveShadow position={[0, -1.28, 0.06]}>
      <boxGeometry args={[3.45, 0.18, 0.72]} />
      <meshStandardMaterial color="#8f6e48" roughness={0.5} metalness={0.28} />
    </mesh>
    <pointLight color="#d7e4d1" intensity={1.2} distance={4.5} position={[0, 0.4, 0.8]} />
    <Html position={[0, 1.02, 0.2]} center transform>
      <div className="wuzhen-zone-portal-label" data-zone="guide-kiosk">
        <strong>展厅导览</strong>
        <span>HALL GUIDE</span>
      </div>
    </Html>
  </group>;
}

function GalleryOpening({ zone }: { zone: HallZone }) {
  const width = 4.35;
  const height = 4.15;
  return <group position={zone.position}>
    <mesh castShadow receiveShadow position={[-(width + 0.22) / 2, height / 2, 0.03]}>
      <boxGeometry args={[0.22, height + 0.12, 0.38]} />
      <meshStandardMaterial color="#463a31" roughness={0.46} metalness={0.24} />
    </mesh>
    <mesh castShadow receiveShadow position={[(width + 0.22) / 2, height / 2, 0.03]}>
      <boxGeometry args={[0.22, height + 0.12, 0.38]} />
      <meshStandardMaterial color="#463a31" roughness={0.46} metalness={0.24} />
    </mesh>
    <mesh castShadow receiveShadow position={[0, height + 0.06, 0.03]}>
      <boxGeometry args={[width + 0.44, 0.24, 0.38]} />
      <meshStandardMaterial color="#463a31" roughness={0.46} metalness={0.24} />
    </mesh>
    <mesh receiveShadow position={[0, height + 0.2, 0.04]}>
      <boxGeometry args={[width + 0.12, 0.07, 0.42]} />
      <meshStandardMaterial color="#c3a064" roughness={0.36} metalness={0.52} />
    </mesh>
    <mesh receiveShadow position={[0, 0.05, 0.18]}>
      <boxGeometry args={[width + 0.38, 0.1, 0.74]} />
      <meshStandardMaterial color="#8f6e48" roughness={0.5} metalness={0.28} />
    </mesh>
    <pointLight color="#d7bd83" intensity={0.85} distance={4.6} position={[0, height - 0.38, 0.4]} />
    <Html position={[0, height + 0.5, 0.12]} center distanceFactor={7} transform occlude={false}>
      <div className="wuzhen-zone-portal-label" data-zone={zone.id}>
        <strong>{zone.title}</strong>
        <span>{zone.subtitle}</span>
      </div>
    </Html>
  </group>;
}

function RearPortals() {
  return <>{HALL_ZONES.filter((zone) => zone.id !== 'entrance').map((zone) => <GalleryOpening key={zone.id} zone={zone} />)}</>;
}

function HallShell({ weather }: Pick<ThreeExhibitionProps, 'weather'>) {
  const palette = {
    sun: { sky: '#789092', wall: '#d6d2c8', floor: '#2b3b3a', band: '#29413f', trim: '#a98b5c', light: '#fff1d0' },
    night: { sky: '#132129', wall: '#7f8782', floor: '#1d2c2d', band: '#1e3436', trim: '#9e875e', light: '#b9ddff' },
    rain: { sky: '#6c7c7c', wall: '#b3b9b3', floor: '#293a3b', band: '#2d4442', trim: '#9d8967', light: '#e1eef1' }
  }[weather];
  return <>
    <color attach="background" args={[palette.sky]} /><fog attach="fog" args={[palette.sky, 17, 48]} />
    <ambientLight intensity={weather === 'night' ? 0.68 : 1.2} />
    <directionalLight castShadow color={palette.light} intensity={weather === 'night' ? 1.15 : 2.4} position={[-9, 11, 8]} shadow-mapSize={[1024, 1024]} />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[30, 34]} /><meshStandardMaterial color={palette.floor} roughness={0.68} metalness={0.12} /></mesh>
    <mesh receiveShadow position={[0, 0.018, -1.6]}><boxGeometry args={[7.2, 0.035, 30.2]} /><meshStandardMaterial color="#344b47" roughness={0.64} metalness={0.1} /></mesh>
    <mesh receiveShadow position={[-3.72, 0.037, -1.6]}><boxGeometry args={[0.06, 0.025, 30.2]} /><meshStandardMaterial color={palette.trim} roughness={0.38} metalness={0.48} /></mesh>
    <mesh receiveShadow position={[3.72, 0.037, -1.6]}><boxGeometry args={[0.06, 0.025, 30.2]} /><meshStandardMaterial color={palette.trim} roughness={0.38} metalness={0.48} /></mesh>
    {[-14.22, -7.5, 0, 7.5, 14.22].map((x, index) => <mesh key={`rear-wall-${x}`} receiveShadow position={[x, 3.5, -18]}>
      <boxGeometry args={[index === 0 || index === 4 ? 1.56 : 3.14, 7, 0.22]} />
      <meshStandardMaterial color={palette.wall} roughness={0.86} />
    </mesh>)}
    <mesh receiveShadow position={[0, 5.58, -18]}><boxGeometry args={[30, 2.84, 0.22]} /><meshStandardMaterial color={palette.wall} roughness={0.86} /></mesh>
    <mesh receiveShadow position={[-15, 3.5, -1.5]}><boxGeometry args={[0.22, 7, 33]} /><meshStandardMaterial color={palette.wall} roughness={0.86} /></mesh>
    <mesh receiveShadow position={[15, 3.5, -1.5]}><boxGeometry args={[0.22, 7, 33]} /><meshStandardMaterial color={palette.wall} roughness={0.86} /></mesh>
    {[-14.22, -7.5, 0, 7.5, 14.22].map((x, index) => <mesh key={`rear-band-${x}`} receiveShadow position={[x, 1.12, -17.84]}>
      <boxGeometry args={[index === 0 || index === 4 ? 1.56 : 3.14, 2.24, 0.08]} />
      <meshStandardMaterial color={palette.band} roughness={0.7} metalness={0.08} />
    </mesh>)}
    <mesh receiveShadow position={[-14.84, 1.12, -1.5]}><boxGeometry args={[0.08, 2.24, 32.3]} /><meshStandardMaterial color={palette.band} roughness={0.7} metalness={0.08} /></mesh>
    <mesh receiveShadow position={[14.84, 1.12, -1.5]}><boxGeometry args={[0.08, 2.24, 32.3]} /><meshStandardMaterial color={palette.band} roughness={0.7} metalness={0.08} /></mesh>
    <mesh receiveShadow position={[0, 2.28, -17.78]}><boxGeometry args={[29.65, 0.07, 0.12]} /><meshStandardMaterial color={palette.trim} roughness={0.38} metalness={0.48} /></mesh>
    <mesh receiveShadow position={[-14.78, 2.28, -1.5]}><boxGeometry args={[0.12, 0.07, 32.35]} /><meshStandardMaterial color={palette.trim} roughness={0.38} metalness={0.48} /></mesh>
    <mesh receiveShadow position={[14.78, 2.28, -1.5]}><boxGeometry args={[0.12, 0.07, 32.35]} /><meshStandardMaterial color={palette.trim} roughness={0.38} metalness={0.48} /></mesh>
    <mesh position={[0, 6.95, -1.5]}><boxGeometry args={[30, 0.12, 33]} /><meshStandardMaterial color="#e5ddcf" roughness={0.9} /></mesh>
  </>;
}

function ExhibitFocus({ activeExhibitId }: { activeExhibitId: HallExhibitId | null }) {
  const { camera } = useThree();
  const focusObject = useMemo(() => new THREE.Object3D(), []);
  const focusPosition = useMemo(() => new THREE.Vector3(), []);
  const focusTarget = useMemo(() => new THREE.Vector3(), []);
  const transitionActive = useRef(false);
  const focus = useMemo<CameraFocusTarget | null>(() => {
    const exhibit = HALL_EXHIBITS.find((candidate) => candidate.id === activeExhibitId);
    return exhibit ? getExhibitFocusTarget(exhibit) : null;
  }, [activeExhibitId]);

  useEffect(() => {
    transitionActive.current = focus !== null;
  }, [focus]);

  useFrame((_, delta) => {
    if (!focus || !transitionActive.current) return;
    focusPosition.set(...focus.position);
    focusTarget.set(...focus.target);
    focusObject.position.copy(focusPosition);
    focusObject.lookAt(focusTarget);

    const alpha = 1 - Math.exp(-Math.min(delta, 0.1) * 5.5);
    camera.position.lerp(focusPosition, alpha);
    camera.quaternion.slerp(focusObject.quaternion, alpha);

    if (camera.position.distanceTo(focusPosition) < 0.025 && camera.quaternion.angleTo(focusObject.quaternion) < 0.012) {
      transitionActive.current = false;
    }
  });

  return null;
}

function AutoTourFocus({ exhibitId, onNext }: { exhibitId: HallExhibitId; onNext: (id: HallExhibitId) => void }) {
  const { camera } = useThree();
  const focusObject = useMemo(() => new THREE.Object3D(), []);
  const focusPosition = useMemo(() => new THREE.Vector3(), []);
  const focusTarget = useMemo(() => new THREE.Vector3(), []);
  const transitionActive = useRef(true);
  const settledAt = useRef<number | null>(null);
  const focus = useMemo(() => getExhibitFocusTarget(HALL_EXHIBITS.find((item) => item.id === exhibitId)!), [exhibitId]);

  useEffect(() => {
    transitionActive.current = true;
    settledAt.current = null;
  }, [exhibitId]);

  useFrame((_, delta) => {
    focusPosition.set(...focus.position);
    focusTarget.set(...focus.target);
    focusObject.position.copy(focusPosition);
    focusObject.lookAt(focusTarget);

    if (transitionActive.current) {
      const alpha = 1 - Math.exp(-Math.min(delta, 0.1) * 5.5);
      camera.position.lerp(focusPosition, alpha);
      camera.quaternion.slerp(focusObject.quaternion, alpha);
      if (camera.position.distanceTo(focusPosition) < 0.025 && camera.quaternion.angleTo(focusObject.quaternion) < 0.012) {
        transitionActive.current = false;
        settledAt.current = performance.now();
      }
      return;
    }

    if (settledAt.current !== null && performance.now() - settledAt.current >= EXHIBITION_TOUR_DWELL_MS) {
      settledAt.current = null;
      onNext(getNextTourExhibit(exhibitId));
    }
  });

  return null;
}

function MouseLookController({ onUserInteraction }: { onUserInteraction?: () => void }) {
  const { camera, gl } = useThree();
  const dragging = useRef(false);
  const previousPointer = useRef({ x: 0, y: 0 });
  const rotation = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

  useEffect(() => {
    const element = gl.domElement;
    const updateRotation = (movementX: number, movementY: number) => {
      rotation.setFromQuaternion(camera.quaternion, 'YXZ');
      rotation.y -= movementX * 0.0035;
      rotation.x = THREE.MathUtils.clamp(rotation.x - movementY * 0.0035, -1.24, 1.24);
      camera.quaternion.setFromEuler(rotation);
      element.dataset.viewYaw = rotation.y.toFixed(3);
      element.dataset.viewPitch = rotation.x.toFixed(3);
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      onUserInteraction?.();
      dragging.current = true;
      previousPointer.current = { x: event.clientX, y: event.clientY };
      element.setPointerCapture?.(event.pointerId);
      element.style.cursor = 'grabbing';
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      const movementX = event.movementX || event.clientX - previousPointer.current.x;
      const movementY = event.movementY || event.clientY - previousPointer.current.y;
      previousPointer.current = { x: event.clientX, y: event.clientY };
      updateRotation(movementX, movementY);
    };
    const pointerUp = (event: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
      element.style.cursor = 'grab';
    };

    element.style.cursor = 'grab';
    element.style.touchAction = 'none';
    element.addEventListener('pointerdown', pointerDown);
    element.addEventListener('pointermove', pointerMove);
    element.addEventListener('pointerup', pointerUp);
    element.addEventListener('pointercancel', pointerUp);
    return () => {
      element.removeEventListener('pointerdown', pointerDown);
      element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('pointerup', pointerUp);
      element.removeEventListener('pointercancel', pointerUp);
      element.style.cursor = '';
      element.style.touchAction = '';
    };
  }, [camera, gl, onUserInteraction, rotation]);

  return null;
}

function PlayerMovement({
  disabled,
  scene,
  onUserInteraction,
  onEnterHistory,
  onEnterFuture,
  onReturnHall
}: {
  disabled: boolean;
  scene: ExhibitionSceneId;
  onUserInteraction?: () => void;
  onEnterHistory: () => void;
  onEnterFuture: () => void;
  onReturnHall: () => void;
}) {
  const { camera } = useThree();
  const pressed = useRef(new Set<string>());
  const forward = useMemo(() => new THREE.Vector3(), []); const right = useMemo(() => new THREE.Vector3(), []);
  const move = useCallback((x: number, z: number, delta: number) => {
    if (!x && !z) return;
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();
    const motion = forward.multiplyScalar(-z).add(right.multiplyScalar(x)).normalize().multiplyScalar(delta * 3.15);
    const bounds = scene === 'hall' ? HALL_BOUNDS : FUTURE_WUZHEN_BOUNDS;
    const colliders = scene === 'hall' ? HALL_COLLIDERS : [];
    const next = resolveMovement(camera.position, { x: motion.x, z: motion.z }, colliders, bounds, PLAYER_RADIUS);
    if (scene === 'hall' && isHistoryPortalEntry(next)) {
      onEnterHistory();
      return;
    }
    if (scene === 'hall' && isFuturePortalEntry(next)) {
      onEnterFuture();
      return;
    }
    if (scene === 'history' && isHistoryReturnPortalEntry(next)) {
      onReturnHall();
      return;
    }
    if (scene === 'future' && isFutureReturnPortalEntry(next)) {
      onReturnHall();
      return;
    }
    camera.position.set(next.x, 1.65, next.z);
  }, [camera, forward, onEnterFuture, onEnterHistory, onReturnHall, right, scene]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      pressed.current.add(event.code);
      if (disabled) return;
      const z = Number(event.code === 'KeyS' || event.code === 'ArrowDown') - Number(event.code === 'KeyW' || event.code === 'ArrowUp');
      const x = Number(event.code === 'KeyD' || event.code === 'ArrowRight') - Number(event.code === 'KeyA' || event.code === 'ArrowLeft');
      if (x || z) {
        onUserInteraction?.();
        event.preventDefault();
        move(x, z, 0.075);
      }
    };
    const up = (event: KeyboardEvent) => pressed.current.delete(event.code);
    const clear = () => pressed.current.clear();
    window.addEventListener('keydown', down, { capture: true });
    window.addEventListener('keyup', up, { capture: true });
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down, { capture: true });
      window.removeEventListener('keyup', up, { capture: true });
      window.removeEventListener('blur', clear);
    };
  }, [disabled, move, onUserInteraction]);
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const keys = pressed.current;
      if (disabled) {
        keys.clear();
      } else {
        const z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
        const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
        if (x || z) {
          move(x, z, 0.05);
        }
      }
    }, 50);
    return () => window.clearInterval(intervalId);
  }, [disabled, move]);
  return null;
}

function AdaptiveRenderQuality({ maxDpr }: { maxDpr: number }) {
  const frameWindow = useRef({ elapsed: 0, frames: 0 });
  const { gl, setDpr } = useThree();

  useFrame((_, delta) => {
    const window = frameWindow.current;
    window.elapsed += Math.min(delta, 0.1);
    window.frames += 1;
    if (window.elapsed < 1.4) return;

    const averageFrameMs = (window.elapsed / window.frames) * 1000;
    const nextDpr = getNextRenderDpr(gl.getPixelRatio(), averageFrameMs, maxDpr);
    if (nextDpr !== gl.getPixelRatio()) setDpr(nextDpr);
    frameWindow.current = { elapsed: 0, frames: 0 };
  });

  return null;
}

function VisibilityFrameLoop() {
  const { invalidate, setFrameloop } = useThree();

  useEffect(() => {
    const updateFrameLoop = () => {
      setFrameloop(document.hidden ? 'never' : 'always');
      if (!document.hidden) invalidate();
    };

    updateFrameLoop();
    document.addEventListener('visibilitychange', updateFrameLoop);
    return () => document.removeEventListener('visibilitychange', updateFrameLoop);
  }, [invalidate, setFrameloop]);

  return null;
}

function HallScene({ weather, activeExhibitId, onSelectExhibit, tourExhibitId, onTourStep, focusExhibitId, maxDpr }: ThreeExhibitionProps & { maxDpr: number; tourExhibitId: HallExhibitId | null; onTourStep: (id: HallExhibitId) => void; focusExhibitId: HallExhibitId | null }) {
  return <><HallShell weather={weather} /><Suspense fallback={null}><Environment files="/exhibition/environment/hall.hdr" /></Suspense>
    <RearPortals />
    <WallInformationPanels />
    <EntranceGuideKiosk />
    {HALL_EXHIBITS.map((exhibit) => <group key={exhibit.id}><ExhibitPedestal position={exhibit.position} />
      {exhibit.id === 'tea-set' ? <ProceduralTeaSet exhibit={exhibit} active={activeExhibitId === exhibit.id} onSelect={onSelectExhibit} /> : null}
      {exhibit.id === 'silk-garment' ? <ProceduralSilkGarment exhibit={exhibit} active={activeExhibitId === exhibit.id} onSelect={onSelectExhibit} /> : null}
      {exhibit.id === 'shuttle' ? <ProceduralShuttle exhibit={exhibit} active={activeExhibitId === exhibit.id} onSelect={onSelectExhibit} /> : null}
      {exhibit.id === 'carved-window' ? <ProceduralCarvedWindow exhibit={exhibit} active={activeExhibitId === exhibit.id} onSelect={onSelectExhibit} /> : null}
    </group>)}
    <AdaptiveRenderQuality maxDpr={maxDpr} /><VisibilityFrameLoop />
    {tourExhibitId ? <AutoTourFocus exhibitId={tourExhibitId} onNext={onTourStep} /> : <ExhibitFocus activeExhibitId={focusExhibitId} />}
  </>;
}

function SceneEntryCamera({ scene }: { scene: ExhibitionSceneId }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (scene === 'future') {
      camera.position.set(0, 2.35, 13.4);
      target.set(0, 3.2, 0);
    } else if (scene === 'history') {
      camera.position.set(0, 4.8, 16.2);
      target.set(0, 4.15, -1.3);
    } else {
      camera.position.set(...HOME_CAMERA_POSITION);
      target.set(0, 1.65, -3.5);
    }
    camera.lookAt(target);
  }, [camera, scene, target]);

  return null;
}

export function ThreeExhibition(props: ThreeExhibitionProps) {
  const { onSelectExhibit } = props;
  const [scene, setScene] = useState<ExhibitionSceneId>('hall');
  const [tourExhibitId, setTourExhibitId] = useState<HallExhibitId | null>(null);
  const [focusExhibitId, setFocusExhibitId] = useState<HallExhibitId | null>(null);
  const stopTour = useCallback(() => {
    setTourExhibitId(null);
    setFocusExhibitId(null);
  }, []);
  const selectExhibit = useCallback((id: HallExhibitId) => {
    stopTour();
    setFocusExhibitId(null);
    onSelectExhibit(id);
  }, [onSelectExhibit, stopTour]);
  const startOrStopTour = useCallback(() => {
    if (tourExhibitId) {
      setTourExhibitId(null);
      setFocusExhibitId(null);
      return;
    }
    const first = EXHIBITION_TOUR_ORDER[0];
    setFocusExhibitId(first);
    setTourExhibitId(first);
    onSelectExhibit(first);
  }, [onSelectExhibit, tourExhibitId]);
  const advanceTour = useCallback((id: HallExhibitId) => {
    setFocusExhibitId(id);
    onSelectExhibit(id);
    setTourExhibitId(id);
  }, [onSelectExhibit]);
  const enterFuture = useCallback(() => {
    stopTour();
    setScene('future');
  }, [stopTour]);
  const enterHistory = useCallback(() => {
    stopTour();
    setScene('history');
  }, [stopTour]);
  const returnToHall = useCallback(() => setScene('hall'), []);
  useEffect(() => {
    const handleTourKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyT' || event.repeat) return;
      event.preventDefault();
      startOrStopTour();
    };
    window.addEventListener('keydown', handleTourKey);
    return () => window.removeEventListener('keydown', handleTourKey);
  }, [startOrStopTour]);
  const maxDpr = useMemo(() => getInitialRenderDprCap({
    devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
    viewportWidth: typeof window === 'undefined' ? 1280 : window.innerWidth,
    hardwareConcurrency: typeof navigator === 'undefined' ? undefined : navigator.hardwareConcurrency
  }), []);
  const cameraConfig = useMemo(() => ({ position: HOME_CAMERA_POSITION, fov: 68, near: 0.1, far: 60 }), []);
  const rendererConfig = useMemo(() => ({
    antialias: maxDpr >= 1.4,
    powerPreference: 'high-performance' as const,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: scene === 'future' ? 0.38 : scene === 'history' ? 0.62 : 1.05
  }), [maxDpr, scene]);
  return <div className="wuzhen-exhibition-canvas" data-scene={scene}><Canvas shadows dpr={[1, maxDpr]} camera={cameraConfig} gl={rendererConfig}>
    <MouseLookController onUserInteraction={stopTour} />
    <PlayerMovement disabled={false} scene={scene} onUserInteraction={stopTour} onEnterHistory={enterHistory} onEnterFuture={enterFuture} onReturnHall={returnToHall} />
    <SceneEntryCamera scene={scene} />
    {scene === 'hall'
      ? <HallScene {...props} onSelectExhibit={selectExhibit} tourExhibitId={tourExhibitId} onTourStep={advanceTour} focusExhibitId={focusExhibitId} maxDpr={maxDpr} />
      : scene === 'history'
        ? <><HistoryCulturalHallScene /><AdaptiveRenderQuality maxDpr={maxDpr} /><VisibilityFrameLoop /></>
        : <><FutureWuzhenScene /><AdaptiveRenderQuality maxDpr={maxDpr} /><VisibilityFrameLoop /></>}
  </Canvas></div>;
}
