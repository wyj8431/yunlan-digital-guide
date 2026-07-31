// 将归一化嘴部信号映射到模型可用的 morph target 权重。
import * as THREE from 'three';

type MorphBinding = {
  influences: number[];
  index: number;
};

export type MouthMorphController = {
  bindingCount: number;
  setOpen: (value: number) => void;
  reset: () => void;
};

function clampMouthOpen(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function createMouthMorphController(root: THREE.Object3D): MouthMorphController {
  const bindings: MorphBinding[] = [];

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const dictionary = object.morphTargetDictionary;
    const influences = object.morphTargetInfluences;

    if (!dictionary || !influences) {
      return;
    }

    for (const name of ['jawOpen', 'mouthOpen']) {
      const index = dictionary[name];

      if (typeof index === 'number') {
        bindings.push({ influences, index });
      }
    }
  });

  const setOpen = (value: number) => {
    const normalized = clampMouthOpen(value);

    for (const binding of bindings) {
      binding.influences[binding.index] = normalized;
    }
  };

  return {
    bindingCount: bindings.length,
    setOpen,
    reset: () => setOpen(0)
  };
}
