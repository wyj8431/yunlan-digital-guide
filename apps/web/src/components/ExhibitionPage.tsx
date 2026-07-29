// 3D 展馆页面管理大厅、展品详情和西湖沙盘三个交互层级。
import { ArrowLeft, Bot, ExternalLink, Map, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ExhibitionRenderer } from '../exhibition/ExhibitionRenderer';
import { WestLakeScene } from '../exhibition/westLakeScene';

type ExhibitionPageProps = { onReturnHome: () => void };
type SceneMode = 'hall' | 'lake';
type ActiveRenderer = ExhibitionRenderer | WestLakeScene;

const EXHIBITS: Record<string, { title: string; description: string; sandTable?: boolean }> = {
  'west-lake-map': {
    title: '西湖数字沙盘',
    description: '以轻量三维场景俯瞰湖岸、苏堤和雷峰塔方位。',
    sandTable: true
  },
  'silk-and-tea': {
    title: '丝茶文化',
    description: '杭州丝绸与西湖龙井共同记录了江南生活的手艺与滋味。'
  },
  'west-lake-bicycle': {
    title: '西湖绿道自行车',
    description: '绿色出行连接湖滨、北山街与杨公堤，适合慢速游览。'
  },
  'green-mobility-car': {
    title: '绿色接驳车',
    description: '景区接驳系统将公交、步行和骑行节点连成低碳游线。'
  },
  'west-lake-wall-art': {
    title: '西湖长卷',
    description: '以当代几何语言提炼三潭印月、群山与水岸的层次。'
  }
};

export function ExhibitionPage({ onReturnHome }: ExhibitionPageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ActiveRenderer | null>(null);
  const [mode, setMode] = useState<SceneMode>('hall');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renderError, setRenderError] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const selected = selectedId ? EXHIBITS[selectedId] : undefined;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setRenderError(false);
    try {
      const renderer =
        mode === 'hall'
          ? new ExhibitionRenderer({ host, onExhibitSelect: setSelectedId })
          : new WestLakeScene({ host });
      rendererRef.current = renderer;
      setTransitioning(false);
      return () => {
        if (rendererRef.current === renderer) rendererRef.current = null;
        renderer.dispose();
      };
    } catch {
      setRenderError(true);
      setTransitioning(false);
      return undefined;
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'hall') return;
    const renderer = rendererRef.current;
    if (renderer instanceof ExhibitionRenderer) {
      renderer.setInteractionEnabled(!selected);
    }
  }, [mode, selected]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  function enterLakeScene() {
    if (transitioning) return;
    setTransitioning(true);
    setSelectedId(null);
    setMode('lake');
  }

  return (
    <main className="exhibition-page">
      <div
        ref={hostRef}
        className="exhibition-canvas-host"
        aria-label={mode === 'hall' ? '西湖室内 3D 展馆' : '西湖轻量 3D 沙盘'}
      />
      {renderError && (
        <p className="exhibition-render-error" role="alert">
          3D 场景暂时无法加载，请检查浏览器图形加速设置。
        </p>
      )}
      {transitioning && (
        <div className="exhibition-transition" data-testid="scene-transition" role="status">
          正在进入西湖全景
        </div>
      )}

      <header className="exhibition-topbar">
        <button type="button" onClick={onReturnHome} aria-label="返回首页">
          <ArrowLeft aria-hidden="true" />
        </button>
        <div>
          <span>{mode === 'hall' ? '西湖文旅数字展馆' : '西湖数字沙盘'}</span>
          <h1>{mode === 'hall' ? '3D 展馆' : '湖山全景'}</h1>
        </div>
        <button className="exhibition-service" type="button" onClick={onReturnHome}>
          <Bot aria-hidden="true" />
          <span>数字人客服</span>
        </button>
      </header>

      {mode === 'hall' ? (
        <p className="exhibition-hint">WASD 移动 · 鼠标拖动视角</p>
      ) : (
        <button className="exhibition-return-hall" type="button" onClick={() => setMode('hall')}>
          <ArrowLeft aria-hidden="true" />
          返回展馆
        </button>
      )}

      {selected && (
        <aside className="exhibit-dialog" role="dialog" aria-labelledby="exhibit-dialog-title">
          <button
            className="exhibit-dialog-close"
            type="button"
            aria-label="关闭展品介绍"
            onClick={() => setSelectedId(null)}
          >
            <X aria-hidden="true" />
          </button>
          <span>展品导览</span>
          <h2 id="exhibit-dialog-title">{selected.title}</h2>
          <p>{selected.description}</p>
          <div className="exhibit-dialog-actions">
            {selected.sandTable && (
              <button type="button" onClick={enterLakeScene} disabled={transitioning}>
                <Map aria-hidden="true" />
                进入西湖沙盘
              </button>
            )}
            <a href="/videos">
              去视频中心
              <ExternalLink aria-hidden="true" />
            </a>
          </div>
        </aside>
      )}
    </main>
  );
}
