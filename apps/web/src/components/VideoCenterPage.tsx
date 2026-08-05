// 视频中心页面协调视频选择、播放器、弹幕设置和各类加载状态。
import { AlertTriangle, ArrowLeft, Film, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadDanmaku,
  loadVideoDetail,
  loadVideos,
  selectVideo,
  sendDanmaku,
  type AppDispatch,
  type RootState
} from '../store/videoStore';
import type { CreateDanmakuInput } from '../types/video';
import type { DanmakuPreferences } from '../video/danmakuPreferences';
import {
  defaultDanmakuPreferences,
  loadDanmakuPreferences,
  saveDanmakuPreferences
} from '../video/danmakuPreferences';
import { DanmakuComposer } from '../video/DanmakuComposer';
import { VideoPlayer } from '../video/VideoPlayer';

type VideoCenterPageProps = {
  onReturnHome: () => void;
};

function formatDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1_000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function VideoCenterPage({ onReturnHome }: VideoCenterPageProps) {
  const dispatch = useDispatch<AppDispatch>();
  const {
    videos,
    selectedVideoId,
    detailsByVideoId,
    danmakuByVideoId,
    detailStatusByVideoId,
    detailErrorByVideoId,
    danmakuStatusByVideoId,
    danmakuErrorByVideoId,
    status,
    error
  } = useSelector((state: RootState) => state.video);
  const [preferences, setPreferences] = useState<DanmakuPreferences>(defaultDanmakuPreferences);
  const [currentMs, setCurrentMs] = useState(0);
  const [danmakuPreview, setDanmakuPreview] = useState<Pick<
    CreateDanmakuInput,
    'content' | 'position' | 'color'
  > | null>(null);
  const selectedVideo = videos.find((video) => video.id === selectedVideoId) ?? null;
  const selectedDetail = selectedVideoId ? detailsByVideoId[selectedVideoId] : undefined;
  const selectedDetailStatus = selectedVideoId
    ? (detailStatusByVideoId[selectedVideoId] ?? 'idle')
    : 'idle';
  const selectedDetailError = selectedVideoId ? detailErrorByVideoId[selectedVideoId] : undefined;
  const selectedDanmakuStatus = selectedVideoId
    ? (danmakuStatusByVideoId[selectedVideoId] ?? 'idle')
    : 'idle';
  const selectedDanmakuError = selectedVideoId ? danmakuErrorByVideoId[selectedVideoId] : undefined;

  useEffect(() => {
    setPreferences(loadDanmakuPreferences());
    void dispatch(loadVideos());
  }, [dispatch]);

  useEffect(() => {
    if (!selectedVideoId) return;
    setCurrentMs(0);
    setDanmakuPreview(null);
    void dispatch(loadVideoDetail(selectedVideoId));
  }, [dispatch, selectedVideoId]);

  useEffect(() => {
    if (!selectedDetail) return;
    void dispatch(
      loadDanmaku({ videoId: selectedDetail.id, fromMs: 0, toMs: selectedDetail.durationMs })
    );
  }, [dispatch, selectedDetail]);

  function updatePreferences(next: DanmakuPreferences) {
    setPreferences(next);
    saveDanmakuPreferences(next);
  }

  return (
    <main className="video-center-page">
      <header className="video-center-header">
        <button className="video-center-back" type="button" onClick={onReturnHome}>
          <ArrowLeft aria-hidden="true" size={17} />
          返回首页
        </button>
        <div>
          <span>影像导览</span>
          <h1>视频中心</h1>
        </div>
        <p>选择一段景观影像，以视频时间轴同步浏览字幕、弹幕与现场留言。</p>
      </header>

      <section className="video-center-workspace" aria-label="视频浏览工作区">
        <aside className="video-center-list" aria-label="视频列表">
          <div className="video-center-list-heading">
            <span>全部影像</span>
            <strong>{status === 'ready' ? videos.length : '...'}</strong>
          </div>

          {status === 'loading' ? (
            <div className="video-center-skeleton" aria-label="视频列表加载中">
              <span />
              <span />
              <span />
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="video-center-feedback" role="alert">
              <AlertTriangle aria-hidden="true" size={21} />
              <p>{error}</p>
              <button type="button" onClick={() => void dispatch(loadVideos())}>
                <RefreshCw aria-hidden="true" size={16} />
                重新加载
              </button>
            </div>
          ) : null}

          {status === 'ready' && videos.length === 0 ? (
            <div className="video-center-feedback">
              <Film aria-hidden="true" size={22} />
              <p>暂时没有可播放的视频</p>
            </div>
          ) : null}

          {status === 'ready' && videos.length > 0 ? (
            <div className="video-center-items">
              {videos.map((video) => (
                <button
                  key={video.id}
                  className={video.id === selectedVideoId ? 'is-selected' : undefined}
                  type="button"
                  aria-label={video.title}
                  aria-pressed={video.id === selectedVideoId}
                  onClick={() => dispatch(selectVideo(video.id))}
                >
                  <img src={video.coverUrl} alt="" />
                  <span>
                    <strong>{video.title}</strong>
                    <small>{formatDuration(video.durationMs)}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <section className="video-center-selection">
          {selectedDetailStatus === 'error' && !selectedDetail ? (
            <div className="video-center-selection-empty video-center-error-state" role="alert">
              <AlertTriangle aria-hidden="true" size={32} />
              <p>{selectedDetailError}</p>
              <button
                type="button"
                onClick={() => selectedVideoId && void dispatch(loadVideoDetail(selectedVideoId))}
              >
                <RefreshCw aria-hidden="true" size={16} />
                重新加载视频详情
              </button>
            </div>
          ) : selectedDetail ? (
            <>
              <VideoPlayer
                video={selectedDetail}
                danmaku={danmakuByVideoId[selectedDetail.id] ?? []}
                preferences={preferences}
                onClockChange={setCurrentMs}
                danmakuPreview={danmakuPreview}
              />
              <div className="video-center-controls">
                <div className="video-center-copy">
                  <span>当前影像</span>
                  <h2>{selectedDetail.title}</h2>
                  <p>{selectedDetail.description}</p>
                  <dl>
                    <div>
                      <dt>时长</dt>
                      <dd>{formatDuration(selectedDetail.durationMs)}</dd>
                    </div>
                    <div>
                      <dt>字幕</dt>
                      <dd>{selectedDetail.subtitleCues.length} 条预置时间轴</dd>
                    </div>
                  </dl>
                  {selectedDetailStatus === 'error' ? (
                    <div className="video-inline-error" role="alert">
                      <span>{selectedDetailError}</span>
                      <button
                        type="button"
                        onClick={() => void dispatch(loadVideoDetail(selectedDetail.id))}
                      >
                        重新加载视频详情
                      </button>
                    </div>
                  ) : null}
                </div>

                {selectedDanmakuStatus === 'error' ? (
                  <div className="video-inline-error" role="alert">
                    <span>{selectedDanmakuError}</span>
                    <button
                      type="button"
                      onClick={() =>
                        void dispatch(
                          loadDanmaku({
                            videoId: selectedDetail.id,
                            fromMs: 0,
                            toMs: selectedDetail.durationMs
                          })
                        )
                      }
                    >
                      重新加载弹幕
                    </button>
                  </div>
                ) : null}

                <DanmakuComposer
                  key={selectedDetail.id}
                  currentMs={currentMs}
                  onPreviewChange={setDanmakuPreview}
                  onSubmit={async (input) => {
                    await dispatch(sendDanmaku({ videoId: selectedDetail.id, input })).unwrap();
                  }}
                />

                <section className="danmaku-preferences" aria-label="弹幕显示设置">
                  <div className="danmaku-preferences-heading">
                    <SlidersHorizontal aria-hidden="true" size={15} />
                    <span>弹幕显示</span>
                  </div>
                  <label>
                    速度
                    <input
                      aria-label="弹幕速度"
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.25"
                      value={preferences.speed}
                      onChange={(event) =>
                        updatePreferences({ ...preferences, speed: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    字号
                    <input
                      aria-label="弹幕字号"
                      type="range"
                      min="14"
                      max="28"
                      step="1"
                      value={preferences.fontSize}
                      onChange={(event) =>
                        updatePreferences({ ...preferences, fontSize: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    透明度
                    <input
                      aria-label="弹幕透明度"
                      type="range"
                      min="0.3"
                      max="1"
                      step="0.1"
                      value={preferences.opacity}
                      onChange={(event) =>
                        updatePreferences({ ...preferences, opacity: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label>
                    密度
                    <input
                      aria-label="弹幕密度"
                      type="range"
                      min="1"
                      max="6"
                      step="1"
                      value={preferences.density}
                      onChange={(event) =>
                        updatePreferences({ ...preferences, density: Number(event.target.value) })
                      }
                    />
                  </label>
                </section>
              </div>
            </>
          ) : selectedVideo || selectedDetailStatus === 'loading' ? (
            <div className="video-center-selection-empty">
              <Film aria-hidden="true" size={32} />
              <p>正在准备视频、预置字幕与弹幕时间轴</p>
            </div>
          ) : (
            <div className="video-center-selection-empty">
              <Film aria-hidden="true" size={32} />
              <p>从左侧选择一段景观影像</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
