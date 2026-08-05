import * as THREE from 'three';
import { ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react';

type PanoramaViewerProps = {
  source: string;
  cubeSource?: string;
  fallbackSource?: string;
  alt: string;
  projectLabel: string;
  originalUrl: string;
  credit: string;
  navigationTargets: Array<{ label: string; x: number; y: number; targetIndex: number }>;
  onNavigate: (targetIndex: number) => void;
};

type DragState = { pointerId: number; startX: number; startY: number; startYaw: number; startPitch: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function PanoramaViewer({ source, cubeSource, fallbackSource, alt, projectLabel, originalUrl, credit, navigationTargets, onNavigate }: PanoramaViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const arrowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dragRef = useRef<DragState | null>(null);
  const viewRef = useRef({ yaw: 0, pitch: 0, fov: 58 });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    setStatus('loading');
    setUsingFallback(false);
    viewRef.current = { yaw: 0, pitch: 0, fov: 58 };
    if (typeof ResizeObserver === 'undefined' || /jsdom/i.test(navigator.userAgent)) {
      setStatus('error');
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setStatus('error');
      return;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 1100);
    const geometry = new THREE.SphereGeometry(100, 64, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const panoramaMesh = new THREE.Mesh(geometry, material);
    scene.add(panoramaMesh);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x071b20, 1);
    renderer.domElement.className = 'building-vr-canvas';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', alt);
    mount.appendChild(renderer.domElement);

    const resize = () => {
      const width = mount.clientWidth || window.innerWidth;
      const height = mount.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const loader = new THREE.TextureLoader();
    const applyTexture = (texture: THREE.Texture, fallback: boolean) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      material.map = texture;
      material.needsUpdate = true;
      setUsingFallback(fallback);
      setStatus('ready');
    };
    const loadFallback = () => {
      if (!fallbackSource || fallbackSource === source) {
        setStatus('error');
        return;
      }
      loader.load(fallbackSource, (texture) => applyTexture(texture, true), undefined, () => setStatus('error'));
    };
    if (cubeSource) {
      new THREE.CubeTextureLoader().load(
        ['right', 'left', 'up', 'down', 'front', 'back'].map((face) => `${cubeSource}/${face}`),
        (cubeTexture) => {
          cubeTexture.colorSpace = THREE.SRGBColorSpace;
          scene.background = cubeTexture;
          panoramaMesh.visible = false;
          setUsingFallback(false);
          setStatus('ready');
        },
        undefined,
        loadFallback
      );
    } else {
      loader.load(source, (texture) => applyTexture(texture, false), undefined, loadFallback);
    }

    const markerPositions = navigationTargets.map((target) => {
      const verticalFov = THREE.MathUtils.degToRad(58);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (16 / 9));
      const yaw = (target.x / 100 - 0.5) * horizontalFov;
      const pitch = (0.5 - target.y / 100) * verticalFov;
      return new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch) * 99,
        Math.sin(pitch) * 99,
        -Math.cos(yaw) * Math.cos(pitch) * 99
      );
    });
    const cameraForward = new THREE.Vector3();
    const projectedMarker = new THREE.Vector3();
    const updateArrowPositions = () => {
      camera.getWorldDirection(cameraForward);
      markerPositions.forEach((markerPosition, index) => {
        const arrow = arrowRefs.current[index];
        if (!arrow) return;
        const facingCamera = cameraForward.dot(markerPosition.clone().normalize()) > 0.08;
        projectedMarker.copy(markerPosition).project(camera);
        const visible = facingCamera && Math.abs(projectedMarker.x) < 1.12 && Math.abs(projectedMarker.y) < 1.12;
        arrow.style.visibility = visible ? 'visible' : 'hidden';
        arrow.style.pointerEvents = visible ? 'auto' : 'none';
        if (visible) {
          arrow.style.left = `${(projectedMarker.x * 0.5 + 0.5) * 100}%`;
          arrow.style.top = `${(-projectedMarker.y * 0.5 + 0.5) * 100}%`;
        }
      });
    };

    let animationFrame = 0;
    const render = () => {
      const view = viewRef.current;
      camera.fov = view.fov;
      camera.rotation.order = 'YXZ';
      camera.rotation.y = view.yaw;
      camera.rotation.x = view.pitch;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      updateArrowPositions();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      material.map?.dispose();
      if (scene.background instanceof THREE.Texture) scene.background.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [alt, cubeSource, fallbackSource, source]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const view = viewRef.current;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startYaw: view.yaw, startPitch: view.pitch };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    viewRef.current.yaw = drag.startYaw - (event.clientX - drag.startX) * 0.005;
    viewRef.current.pitch = clamp(drag.startPitch - (event.clientY - drag.startY) * 0.005, -1.2, 1.2);
  };
  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    viewRef.current.fov = clamp(viewRef.current.fov + event.deltaY * 0.04, 42, 82);
  };

  return (
    <div ref={mountRef} className={`building-vr-panorama building-vr-panorama--${status}`} data-panorama-source="verified-real-panorama" data-panorama-projection="equirectangular-sphere" data-panorama-url={source} data-panorama-fallback={fallbackSource} data-panorama-is-fallback={usingFallback} aria-label={`${alt} - real 360 panorama`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={releasePointer} onPointerCancel={releasePointer} onWheel={handleWheel}>
      <div className="building-vr-panorama-topline"><span>{projectLabel}</span><small>拖动浏览，滚轮缩放</small></div>
      {status === 'loading' && <span className="building-vr-panorama-status">正在加载实景全景</span>}
      {status === 'error' && <div className="building-vr-panorama-status building-vr-panorama-error"><span>全景暂时无法加载</span><a href={originalUrl} target="_blank" rel="noreferrer">在 360Cities 查看 <ExternalLink size={14} /></a></div>}
      {navigationTargets.map((target, index) => <button key={`${target.label}-${target.x}-${target.y}`} ref={(element) => { arrowRefs.current[index] = element; }} type="button" className="building-vr-scene-arrow" style={{ '--scene-arrow-rotation': `${index === 0 ? 90 : index === 1 ? 0 : -18}deg`, visibility: 'hidden' } as CSSProperties} aria-label={`前往${target.label}`} title={`前往${target.label}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onNavigate(target.targetIndex)}><span aria-hidden="true" /></button>)}
      <span className="building-vr-panorama-credit">{credit} 实景全景</span>
    </div>
  );
}
