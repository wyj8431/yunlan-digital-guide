import { useEffect, useRef, useState } from 'react';
import { AudioLines, ChevronDown, Map, Mic2, PersonStanding, RefreshCw, Route } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useXfyunVirtualHuman } from '../hooks/useXfyunVirtualHuman';
import { QUALITY_PROFILES } from '../lab/lip-sync/performance/qualityController';
import {
  createMouthMorphController,
  type MouthMorphController
} from '../lab/lip-sync/three/mouthMorphController';
import { disposeObject3D } from '../lib/three/disposeObject3D';
import { GUIDE_SPEECH_PLAYBACK_EVENT, isGuideSpeechPlaybackEvent } from '../lib/guideSpeechSync';
import type { GuideSpeechTimeline } from '../types/guide';
import type { SpeechDriver } from '../types/virtualHuman';

const DIGITAL_HUMAN_MODEL_URL = '/models/Thanh.glb';
const XFYUN_STREAM_DOM_ID = 'xfyun-virtual-human-stream';
const GUIDE_BASE_ROTATION_Y = 0.16;
const GUIDE_FOOT_Y = -0.98;
const GUIDE_STAGE_HEIGHT = 1.82;
const FALLBACK_ACTIONS = [
  { id: 'A_LH_introduced_O', label: '介绍' },
  { id: 'A_RLH_introduced_O', label: '双手介绍' },
  { id: 'A_RH_introduced_O', label: '右手介绍' },
  { id: 'A_RH_introduced1_O', label: '右手介绍2' },
  { id: 'A_RLH_welcome_O', label: '欢迎' },
  { id: 'A_RLH_emphasize_O', label: '双手强调' },
  { id: 'A_RH_emphasize_O', label: '右手强调' },
  { id: 'A_RH_emphasize2_O', label: '右手强调2' },
  { id: 'A_RH_good_O', label: '夸奖' },
  { id: 'A_RH_encourage_O', label: '加油' },
  { id: 'A_RH_hello_O', label: '打招呼' },
  { id: 'A_RH_bye_O', label: '再见' },
  { id: 'A_H_listen_C', label: '倾听点头' }
];

type DigitalHumanStageProps = {
  speaking: boolean;
  answerText?: string;
  speechTimeline?: GuideSpeechTimeline | null;
  onSpeechDriverChange?: (driver: SpeechDriver) => void;
  onNavigate?: (view: 'narration' | 'map' | 'itinerary' | 'voice') => void;
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

export function getTimelineMouthOpen(
  timeline: GuideSpeechTimeline | null,
  elapsedMs: number
): number {
  if (!timeline || elapsedMs < 0 || elapsedMs > timeline.durationMs + 120) {
    return 0;
  }

  const cue = timeline.visemes.find((item) => elapsedMs >= item.startMs && elapsedMs <= item.endMs);

  if (!cue) {
    return 0;
  }

  const cueDurationMs = Math.max(1, cue.endMs - cue.startMs);
  const progress = Math.min(1, Math.max(0, (elapsedMs - cue.startMs) / cueDurationMs));
  const ease = Math.sin(progress * Math.PI);

  return cue.mouthOpen * (0.55 + ease * 0.45);
}

export function DigitalHumanStage({
  speaking,
  answerText,
  speechTimeline,
  onSpeechDriverChange,
  onNavigate
}: DigitalHumanStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const virtualHuman = useXfyunVirtualHuman({
    answerText,
    streamDomId: XFYUN_STREAM_DOM_ID,
    onSpeechDriverChange
  });
  const effectiveSpeaking = virtualHuman.speaking || speaking;
  const onlineHumanPending = virtualHuman.status === 'loading';
  const onlineHumanUnavailable = virtualHuman.status === 'error' && virtualHuman.config?.enabled;
  const speakingRef = useRef(effectiveSpeaking);
  const speechTimelineRef = useRef<GuideSpeechTimeline | null>(null);
  const speechTimelineStartedAtRef = useRef<number | null>(null);
  const [modelState, setModelState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState(FALLBACK_ACTIONS[0].id);
  const [actionMessage, setActionMessage] = useState('');
  const [wakeHintVisible, setWakeHintVisible] = useState(true);
  const actionOptions =
    virtualHuman.config?.enabled && virtualHuman.config.actions.length > 0
      ? virtualHuman.config.actions
      : FALLBACK_ACTIONS;
  const onlineHumanName =
    virtualHuman.config?.enabled && virtualHuman.config.provider === 'mofa-xingyun'
      ? '魔珐星云数字人'
      : '讯飞虚拟人';
  const shouldShowWakeButton =
    virtualHuman.active &&
    virtualHuman.config?.enabled &&
    virtualHuman.config.provider === 'mofa-xingyun' &&
    wakeHintVisible;
  const selectedAction =
    actionOptions.find((action) => action.id === selectedActionId) ?? actionOptions[0];

  useEffect(() => {
    speakingRef.current = effectiveSpeaking;
  }, [effectiveSpeaking]);

  useEffect(() => {
    speechTimelineRef.current = speechTimeline ?? null;
    speechTimelineStartedAtRef.current =
      speechTimeline && typeof performance !== 'undefined' ? performance.now() : null;
  }, [speechTimeline]);

  useEffect(() => {
    const handlePlayback = (event: Event) => {
      if (!isGuideSpeechPlaybackEvent(event)) {
        return;
      }

      const timeline = speechTimelineRef.current;

      if (!timeline || timeline.text !== event.detail.text || typeof performance === 'undefined') {
        return;
      }

      if (event.detail.phase === 'start') {
        speechTimelineStartedAtRef.current = performance.now();
      } else {
        speechTimelineStartedAtRef.current = null;
      }
    };

    window.addEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, handlePlayback);
    return () => {
      window.removeEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, handlePlayback);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let disposed = false;
    let frameId: number | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let modelRoot: THREE.Object3D | null = null;
    let mouthController: MouthMorphController | null = null;
    let modelBaseY = 0;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(32, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0.18, 5.15);
    camera.lookAt(0, -0.05, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, QUALITY_PROFILES.medium.pixelRatioCap)
    );
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

    const floorGlow = new THREE.Mesh(
      new THREE.CircleGeometry(1.46, 128),
      new THREE.MeshBasicMaterial({
        color: '#78fff3',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      })
    );
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.y = -1.045;
    scene.add(floorGlow);

    const floorRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.46, 0.018, 12, 128),
      new THREE.MeshBasicMaterial({
        color: '#fff0a8',
        transparent: true,
        opacity: 0.62
      })
    );
    floorRing.rotation.x = Math.PI / 2;
    floorRing.position.y = -1.038;
    scene.add(floorRing);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.88, 1.94, 96),
      new THREE.MeshBasicMaterial({
        color: '#f7edb7',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.52
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
        mouthController = createMouthMorphController(model);

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

    function scheduleFrame() {
      if (disposed || document.hidden || frameId !== null) {
        return;
      }

      frameId = requestAnimationFrame(render);
    }

    function stopFrameLoop() {
      if (frameId === null) {
        return;
      }

      cancelAnimationFrame(frameId);
      frameId = null;
    }

    function render() {
      frameId = null;

      if (disposed || document.hidden) {
        return;
      }

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      mixer?.update(delta);

      if (modelRoot) {
        const timeline = speechTimelineRef.current;
        const timelineStartedAt = speechTimelineStartedAtRef.current;
        const timelineElapsedMs =
          timelineStartedAt === null || typeof performance === 'undefined'
            ? 0
            : performance.now() - timelineStartedAt;
        const timelineMouthOpen = getTimelineMouthOpen(timeline, timelineElapsedMs);
        const speakingMotion =
          timelineMouthOpen > 0
            ? timelineMouthOpen * 0.026
            : speakingRef.current
              ? Math.sin(elapsed * 7.5) * 0.018
              : 0;

        mouthController?.setOpen(timelineMouthOpen);
        modelRoot.rotation.y = GUIDE_BASE_ROTATION_Y + Math.sin(elapsed * 0.52) * 0.045;
        modelRoot.position.y = modelBaseY + Math.sin(elapsed * 1.15) * 0.006 + speakingMotion;
      }

      halo.rotation.z = elapsed * 0.16;
      renderer.render(scene, camera);
      scheduleFrame();
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stopFrameLoop();
        return;
      }

      scheduleFrame();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stageHost);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    resize();
    render();

    return () => {
      disposed = true;
      stopFrameLoop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver.disconnect();
      mouthController?.reset();
      mixer?.stopAllAction();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, []);

  async function handleActionSelect(actionId: string) {
    const action = actionOptions.find((item) => item.id === actionId);
    setSelectedActionId(actionId);
    setActionsOpen(false);
    setActionMessage('');

    if (!virtualHuman.active) {
      setActionMessage('讯飞虚拟人接入后可切换动作。');
      return;
    }

    try {
      await virtualHuman.triggerAction(actionId);
      setActionMessage(action ? `${action.label}动作已切换` : '动作已切换');
    } catch {
      setActionMessage('当前数字人暂不支持该动作。');
    }
  }

  async function handleWakeAvatar() {
    setWakeHintVisible(false);
    setActionMessage('');

    try {
      await virtualHuman.triggerAction('onlineMode');
    } catch {
      setWakeHintVisible(true);
      setActionMessage('点击右侧上线互动后可唤醒数字人。');
    }
  }

  return (
    <div
      className={`digital-human-stage ${effectiveSpeaking ? 'is-speaking' : 'is-idle'} ${
        virtualHuman.active
          ? 'has-online-human'
          : onlineHumanPending
            ? 'is-online-human-connecting'
            : onlineHumanUnavailable
              ? 'is-online-human-unavailable'
              : 'has-local-human'
      }`}
      aria-label="乌镇景区年轻数字导游舞台"
    >
      <div className="guide-identity">
        <span>年轻导游</span>
        <strong>乌镇景区</strong>
      </div>

      <div className="model-stage">
        <div className="xfyun-stream-host" aria-label="线上数字人画面">
          <div id={XFYUN_STREAM_DOM_ID} className="online-stream-mount" />
        </div>
        <div ref={hostRef} className="model-host" />
        {shouldShowWakeButton ? (
          <button type="button" className="avatar-wake-button" onClick={handleWakeAvatar}>
            <PersonStanding size={18} aria-hidden="true" />
            <span>点击唤醒数字人</span>
          </button>
        ) : null}
        <div className="model-status">
          <span>
            {virtualHuman.active
              ? onlineHumanName
              : onlineHumanPending || onlineHumanUnavailable
                ? onlineHumanName
                : modelState === 'ready'
                  ? '3D 数字人模型'
                  : modelState === 'error'
                    ? '模型加载失败'
                    : '正在加载3D数字人'}
          </span>
          <strong>
            {onlineHumanPending
              ? '接入中'
              : onlineHumanUnavailable
                ? '接入异常'
                : effectiveSpeaking
                  ? '讲解中'
                  : '待机中'}
          </strong>
          <small>{virtualHuman.message}</small>
          {onlineHumanUnavailable ? (
            <button
              type="button"
              className="xfyun-retry-button"
              onClick={virtualHuman.retry}
              aria-label="重新接入讯飞虚拟人"
            >
              <RefreshCw size={14} aria-hidden="true" />
              <span>重新接入讯飞</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="stage-holo-tools">
        <button
          type="button"
          className="stage-holo-tool stage-holo-tool--narration"
          onClick={() => onNavigate?.('narration')}
        >
          <AudioLines size={18} />
          <span>实时讲解</span>
          <small>Real-time</small>
        </button>
        <button
          type="button"
          className="stage-holo-tool stage-holo-tool--map"
          onClick={() => onNavigate?.('map')}
        >
          <Map size={18} />
          <span>全景地图</span>
          <small>Map</small>
        </button>
        <button
          type="button"
          className="stage-holo-tool stage-holo-tool--route"
          onClick={() => onNavigate?.('itinerary')}
        >
          <Route size={18} />
          <span>智能路线</span>
          <small>Route</small>
        </button>
        <button
          type="button"
          className="stage-holo-tool stage-holo-tool--voice"
          onClick={() => onNavigate?.('voice')}
        >
          <Mic2 size={18} />
          <span>语音交互</span>
          <small>Voice</small>
        </button>
      </div>

      <div className="avatar-action-switcher">
        <button
          type="button"
          className="avatar-action-trigger"
          aria-expanded={actionsOpen}
          aria-controls="avatar-action-menu"
          disabled={virtualHuman.acting}
          onClick={() => setActionsOpen((open) => !open)}
        >
          <PersonStanding size={18} aria-hidden="true" />
          <span>{virtualHuman.acting ? '切换中' : selectedAction.label}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>

        {actionsOpen ? (
          <div id="avatar-action-menu" className="avatar-action-menu" role="menu">
            {actionOptions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={action.id === selectedAction.id ? 'is-selected' : ''}
                role="menuitem"
                onClick={() => void handleActionSelect(action.id)}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}

        {actionMessage ? <small>{actionMessage}</small> : null}
      </div>

      <div className="stage-caption">
        {effectiveSpeaking ? '正在讲解乌镇景区' : '乌镇景区数字导游'}
      </div>
    </div>
  );
}
