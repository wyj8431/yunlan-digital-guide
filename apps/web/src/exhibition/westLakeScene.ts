import * as THREE from 'three';
import { disposeObject3D } from '../lib/three/disposeObject3D';

type WestLakeSceneOptions = { host: HTMLElement };

export class WestLakeScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly observer: ResizeObserver;
  private frameId = 0;
  private disposed = false;
  private angle = 0;

  constructor(private readonly options: WestLakeSceneOptions) {
    this.scene.background = new THREE.Color('#c9dfd8');
    this.camera.position.set(10, 8, 12);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.options.host.appendChild(this.renderer.domElement);
    this.buildScene();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(options.host);
    this.resize();
    this.render();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    disposeObject3D(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private buildScene() {
    this.scene.add(new THREE.HemisphereLight('#fffbea', '#315c50', 2.6));
    const lake = new THREE.Mesh(
      new THREE.CylinderGeometry(6.8, 7.3, 0.35, 64),
      new THREE.MeshStandardMaterial({ color: '#58a7ad', roughness: 0.3, metalness: 0.08 })
    );
    lake.scale.z = 0.68;
    this.scene.add(lake);

    const landMaterial = new THREE.MeshStandardMaterial({ color: '#78966c', roughness: 0.92 });
    for (const [x, z, scale] of [
      [-5, -2.8, 2.1],
      [4.8, -3.1, 2.6],
      [5.8, 2.2, 1.8],
      [-5.6, 3, 2.4]
    ] as const) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.3, 16), landMaterial);
      hill.position.set(x, 0.95, z);
      hill.scale.set(scale, 1, scale * 0.72);
      this.scene.add(hill);
    }

    const causeway = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.28, 10.5),
      new THREE.MeshStandardMaterial({ color: '#d7c89a', roughness: 0.86 })
    );
    causeway.position.set(-1.5, 0.32, 0);
    causeway.rotation.y = -0.18;
    this.scene.add(causeway);

    const tower = new THREE.Group();
    for (let level = 0; level < 5; level += 1) {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42 - level * 0.045, 0.52 - level * 0.04, 0.48, 8),
        new THREE.MeshStandardMaterial({ color: '#b78854', roughness: 0.75 })
      );
      body.position.y = level * 0.48;
      tower.add(body);
    }
    tower.position.set(3.2, 0.35, 2.5);
    this.scene.add(tower);
  }

  private resize() {
    const width = Math.max(this.options.host.clientWidth, 1);
    const height = Math.max(this.options.host.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private render = () => {
    if (this.disposed) return;
    this.angle += 0.0015;
    this.camera.position.x = Math.cos(this.angle) * 15;
    this.camera.position.z = Math.sin(this.angle) * 15;
    this.camera.lookAt(0, 0.4, 0);
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.render);
  };
}
