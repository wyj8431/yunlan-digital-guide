import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useXfyunVirtualHuman } from '../hooks/useXfyunVirtualHuman';
import type { SpeechDriver } from '../types/virtualHuman';

const DIGITAL_HUMAN_MODEL_URL = '/models/Thanh.glb';
const XFYUN_STREAM_DOM_ID = 'xfyun-virtual-human-stream';
const GUIDE_BASE_ROTATION_Y = 0.16;
const GUIDE_FOOT_Y = -0.98;
const GUIDE_STAGE_HEIGHT = 1.82;

type DigitalHumanStageProps = {
  speaking: boolean;
  answerText?: string;
  onSpeechDriverChange?: (driver: SpeechDriver) => void;
};

function fitModelToStage(model: THREE.Object3D) {
  const bounds = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  bounds.getCenter(center);
  bounds.getSize(size);

  const scale = GUIDE_STAGE_HEIGHT / Math.max(size.y, 1);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, GUIDE_FOOT_Y - bounds.min.y * scale, -center.z * scale);
}

export function DigitalHumanStage({
  speaking,
  answerText,
  onSpeechDriverChange
}: DigitalHumanStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const virtualHuman = useXfyunVirtualHuman({
    answerText,
    streamDomId: XFYUN_STREAM_DOM_ID,
    onSpeechDriverChange
  });
  const effectiveSpeaking = virtualHuman.speaking || speaking;
  const speakingRef = useRef(effectiveSpeaking);
  const [modelState, setModelState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    speakingRef.current = effectiveSpeaking;
  }, [effectiveSpeaking]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let disposed = false;
    let frameId = 0;
    let mixer: THREE.AnimationMixer | null = null;
    let modelRoot: THREE.Object3D | null = null;
    let modelBaseY = 0;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(32, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0.18, 5.15);
    camera.lookAt(0, -0.05, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight('#fff3df', '#606c38', 2.4));

    const keyLight = new THREE.DirectionalLight('#ffffff', 3.2);
    keyLight.position.set(2.4, 4.2, 3.2);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#c08e3a', 1.8);
    rimLight.position.set(-3.2, 2.4, -2.2);
    scene.add(rimLight);

    const fillLight = new THREE.AmbientLight('#e8dcc7', 0.7);
    scene.add(fillLight);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.82, 0.12, 80),
      new THREE.MeshStandardMaterial({ color: '#8b9d83', roughness: 0.82 })
    );
    floor.position.y = -1.04;
    floor.receiveShadow = true;
    scene.add(floor);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.88, 1.94, 96),
      new THREE.MeshBasicMaterial({
        color: '#e8dcc7',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45
      })
    );
    halo.position.set(0, 0.08, -0.54);
    scene.add(halo);

    const loader = new GLTFLoader();
    loader.load(
      DIGITAL_HUMAN_MODEL_URL,
      (gltf) => {
        if (disposed) {
          return;
        }

        const model = gltf.scene;
        fitModelToStage(model);
        model.rotation.y = GUIDE_BASE_ROTATION_Y;
        modelBaseY = model.position.y;
        model.traverse((item) => {
          if (item instanceof THREE.Mesh) {
            item.castShadow = true;
            item.receiveShadow = true;
          }
        });

        scene.add(model);
        modelRoot = model;

        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
        }

        setModelState('ready');
      },
      undefined,
      () => {
        if (!disposed) {
          setModelState('error');
        }
      }
    );

    const clock = new THREE.Clock();
    const stageHost = host;

    function resize() {
      const width = Math.max(stageHost.clientWidth, 1);
      const height = Math.max(stageHost.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    function render() {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      mixer?.update(delta);

      if (modelRoot) {
        const speakingMotion = speakingRef.current ? Math.sin(elapsed * 7.5) * 0.018 : 0;
        modelRoot.rotation.y = GUIDE_BASE_ROTATION_Y + Math.sin(elapsed * 0.52) * 0.045;
        modelRoot.position.y = modelBaseY + Math.sin(elapsed * 1.15) * 0.006 + speakingMotion;
      }

      halo.rotation.z = elapsed * 0.16;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stageHost);
    resize();
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mixer?.stopAllAction();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className={`digital-human-stage ${effectiveSpeaking ? 'is-speaking' : 'is-idle'} ${
        virtualHuman.active ? 'has-xfyun-human' : 'has-local-human'
      }`}
      aria-label="云岚古镇年轻数字导游舞台"
    >
      <div className="guide-identity">
        <span>年轻导游</span>
        <strong>云岚古镇</strong>
      </div>

      <div className="model-stage">
        <div
          id={XFYUN_STREAM_DOM_ID}
          className="xfyun-stream-host"
          aria-label="讯飞在线虚拟人画面"
        />
        <div ref={hostRef} className="model-host" />
        <div className="model-status">
          <span>
            {virtualHuman.active
              ? '讯飞虚拟人'
              : modelState === 'ready'
                ? '3D 数字人模型'
                : modelState === 'error'
                  ? '模型加载失败'
                  : '正在加载3D数字人'}
          </span>
          <strong>{effectiveSpeaking ? '讲解中' : '待机中'}</strong>
          <small>{virtualHuman.message}</small>
        </div>
      </div>

      <div className="stage-caption">
        {effectiveSpeaking ? '正在讲解云岚古镇' : '云岚古镇数字导游'}
      </div>
    </div>
  );
}
