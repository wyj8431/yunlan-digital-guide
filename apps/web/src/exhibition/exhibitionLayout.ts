import type { Collider } from './collision';

export const HALL_DIMENSIONS = { width: 16, depth: 20, height: 4.8 } as const;

export type ExhibitKind =
  'sand-table' | 'display-table' | 'silk-garment' | 'bicycle' | 'shuttle' | 'wall-art' | 'plant';

export type ExhibitLayoutItem = {
  id: string;
  kind: ExhibitKind;
  position: { x: number; y: number; z: number };
  size: { width: number; height: number; depth: number };
  interactive: boolean;
  blocksMovement: boolean;
  collider?: Collider;
};

function createCollider(x: number, z: number, width: number, depth: number): Collider {
  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2
  };
}

function groundedItem(
  item: Omit<ExhibitLayoutItem, 'blocksMovement' | 'collider'>
): ExhibitLayoutItem {
  return {
    ...item,
    blocksMovement: true,
    collider: createCollider(item.position.x, item.position.z, item.size.width, item.size.depth)
  };
}

export const EXHIBITION_LAYOUT: ExhibitLayoutItem[] = [
  groundedItem({
    id: 'silk-and-tea',
    kind: 'display-table',
    position: { x: -3.8, y: 0, z: -1.2 },
    size: { width: 2.8, height: 0.89, depth: 1.7 },
    interactive: true
  }),
  groundedItem({
    id: 'silk-garment',
    kind: 'silk-garment',
    position: { x: 3.8, y: 0, z: -1.2 },
    size: { width: 2.5, height: 0.89, depth: 1.5 },
    interactive: true
  }),
  groundedItem({
    id: 'west-lake-bicycle',
    kind: 'bicycle',
    position: { x: -4.3, y: 0.72, z: -5.6 },
    size: { width: 2.5, height: 1.45, depth: 1.2 },
    interactive: true
  }),
  groundedItem({
    id: 'green-mobility-car',
    kind: 'shuttle',
    position: { x: 3.6, y: 0, z: -5.6 },
    size: { width: 3.7, height: 1.59, depth: 1.9 },
    interactive: true
  }),
  {
    id: 'west-lake-wall-art',
    kind: 'wall-art',
    position: { x: 0, y: 2.45, z: -9.82 },
    size: { width: 6.6, height: 2.5, depth: 0.12 },
    interactive: true,
    blocksMovement: false
  },
  ...[
    [-6.7, -8.4],
    [6.7, -8.4],
    [-6.7, 7.8],
    [6.7, 7.8]
  ].map(([x, z], index) =>
    groundedItem({
      id: `plant-${index + 1}`,
      kind: 'plant',
      position: { x, y: 0, z },
      size: { width: 1.05, height: 2.47, depth: 1.05 },
      interactive: false
    })
  )
];

export function assertMainAisleClear(layout: ExhibitLayoutItem[], aisleWidth: number): boolean {
  const halfWidth = aisleWidth / 2;
  return layout
    .filter((item) => item.blocksMovement)
    .every(
      (item) =>
        !item.collider || item.collider.maxX <= -halfWidth || item.collider.minX >= halfWidth
    );
}

export function findExhibitLayout(id: string): ExhibitLayoutItem {
  const item = EXHIBITION_LAYOUT.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown exhibition layout item: ${id}`);
  return item;
}
