import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DigitalHumanStageProps = {
  speaking: boolean;
};

export function DigitalHumanStage({ speaking }: DigitalHumanStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const speakingRef = useRef(speaking);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dbe6db');

    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 1.45, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight('#fff7e8', '#66806f', 2.4));

    const keyLight = new THREE.DirectionalLight('#ffffff', 2.2);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.48, 1.15, 8, 18),
      new THREE.MeshStandardMaterial({ color: '#6f8b72', roughness: 0.72 })
    );
    body.position.y = 0.72;
    scene.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 32, 32),
      new THREE.MeshStandardMaterial({ color: '#f0c7a5', roughness: 0.62 })
    );
    head.position.y = 1.63;
    scene.add(head);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2f2a25', roughness: 0.8 })
    );
    hair.position.y = 1.7;
    scene.add(hair);

    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.035, 0.018),
      new THREE.MeshStandardMaterial({ color: '#7f3a32' })
    );
    mouth.position.set(0, 1.49, 0.36);
    scene.add(mouth);

    const sash = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.12, 0.04),
      new THREE.MeshStandardMaterial({ color: '#b98f4f', roughness: 0.68 })
    );
    sash.position.set(0, 1.08, 0.5);
    scene.add(sash);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 0.08, 48),
      new THREE.MeshStandardMaterial({ color: '#b8c7b3', roughness: 0.9 })
    );
    base.position.y = -0.05;
    scene.add(base);

    let frameId = 0;
    const clock = new THREE.Clock();

    const stageHost = host;

    function resize() {
      const width = Math.max(stageHost.clientWidth, 1);
      const height = Math.max(stageHost.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    function render() {
      const elapsed = clock.getElapsedTime();
      const idleBob = Math.sin(elapsed * 1.4) * 0.025;
      body.position.y = 0.72 + idleBob;
      head.position.y = 1.63 + idleBob;
      hair.position.y = 1.7 + idleBob;
      sash.position.y = 1.08 + idleBob;
      mouth.position.y = 1.49 + idleBob;
      mouth.scale.y = speakingRef.current ? 1 + Math.abs(Math.sin(elapsed * 16)) * 4.4 : 1;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stageHost);
    resize();
    render();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="digital-human-stage">
      <div ref={hostRef} className="three-host" />
      <div className="stage-caption">{speaking ? '正在讲解云岚古镇' : '云岚古镇数字导游'}</div>
    </div>
  );
}
