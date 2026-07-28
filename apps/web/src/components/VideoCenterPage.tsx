import { AlertTriangle, ArrowLeft, Film, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loadVideos, selectVideo, type AppDispatch, type RootState } from '../store/videoStore';

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
  const { videos, selectedVideoId, status, error } = useSelector((state: RootState) => state.video);
  const selectedVideo = videos.find((video) => video.id === selectedVideoId) ?? null;

  useEffect(() => {
    void dispatch(loadVideos());
  }, [dispatch]);

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
        <p>选择一段景观影像，播放与弹幕功能将在此继续呈现。</p>
      </header>

      <section className="video-center-workspace" aria-label="视频浏览工作区">
        <aside className="video-center-list" aria-label="视频列表">
          <div className="video-center-list-heading">
            <span>全部影像</span>
            <strong>{status === 'ready' ? videos.length : '—'}</strong>
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

        <section className="video-center-selection" aria-live="polite">
          {selectedVideo ? (
            <>
              <img src={selectedVideo.coverUrl} alt="" />
              <div>
                <span>当前选择</span>
                <h2>{selectedVideo.title}</h2>
                <p>{selectedVideo.description}</p>
                <dl>
                  <div>
                    <dt>时长</dt>
                    <dd>{formatDuration(selectedVideo.durationMs)}</dd>
                  </div>
                  <div>
                    <dt>播放地址</dt>
                    <dd>已就绪</dd>
                  </div>
                </dl>
              </div>
            </>
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
