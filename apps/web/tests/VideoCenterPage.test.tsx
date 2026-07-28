import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VideoCenterPage } from '../src/components/VideoCenterPage';
import { videoReducer } from '../src/store/videoStore';

const videos = [
  {
    id: 'west-lake-dawn',
    title: '西湖晨光',
    description: '从湖畔出发的清晨漫游。',
    coverUrl: '/covers/west-lake-dawn.jpg',
    videoUrl: '/videos/west-lake-dawn.mp4',
    durationMs: 186_000
  },
  {
    id: 'canal-night',
    title: '运河夜航',
    description: '沿着水岸欣赏灯火。',
    coverUrl: '/covers/canal-night.jpg',
    videoUrl: '/videos/canal-night.mp4',
    durationMs: 203_000
  }
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function installVideoApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((request: RequestInfo | URL) => {
      const url = String(request);
      if (url === '/api/videos') return Promise.resolve(json({ videos }));
      if (url.includes('/danmaku?')) return Promise.resolve(json({ danmaku: [] }));
      const video = videos.find((item) => url.endsWith(item.id));
      return Promise.resolve(json({ video: { ...video, subtitleCues: [] } }));
    })
  );
}

function renderPage(onReturnHome = vi.fn()) {
  const store = configureStore({ reducer: { video: videoReducer } });
  render(
    <Provider store={store}>
      <VideoCenterPage onReturnHome={onReturnHome} />
    </Provider>
  );
  return { onReturnHome, store };
}

describe('VideoCenterPage', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a loading skeleton before videos are available', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined))
    );
    renderPage();

    expect(screen.getByLabelText('视频列表加载中')).toBeInTheDocument();
  });

  it('loads the selected video detail and lets visitors switch videos', async () => {
    installVideoApi();
    renderPage();

    expect(await screen.findByRole('heading', { name: '西湖晨光' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '运河夜航' }));

    expect(await screen.findByRole('heading', { name: '运河夜航' })).toBeInTheDocument();
    expect(document.querySelector('.video-center-selection')).not.toHaveAttribute('aria-live');
  });

  it('shows a per-video detail error and retries only that detail', async () => {
    let detailAttempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((request: RequestInfo | URL) => {
        const url = String(request);
        if (url === '/api/videos') return Promise.resolve(json({ videos }));
        if (url.includes('/danmaku?')) return Promise.resolve(json({ danmaku: [] }));
        detailAttempts += 1;
        return detailAttempts === 1
          ? Promise.resolve(json({ message: '视频详情暂时不可用' }, 503))
          : Promise.resolve(json({ video: { ...videos[0], subtitleCues: [] } }));
      })
    );
    renderPage();

    expect(await screen.findByText('视频详情暂时不可用（HTTP 503）')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载视频详情' }));

    expect(await screen.findByRole('heading', { name: '西湖晨光' })).toBeInTheDocument();
    expect(detailAttempts).toBe(2);
  });

  it('shows an inline danmaku error and retries the current video window', async () => {
    let danmakuAttempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((request: RequestInfo | URL) => {
        const url = String(request);
        if (url === '/api/videos') return Promise.resolve(json({ videos }));
        if (url.includes('/danmaku?')) {
          danmakuAttempts += 1;
          return danmakuAttempts === 1
            ? Promise.resolve(json({ message: '弹幕暂时不可用' }, 503))
            : Promise.resolve(json({ danmaku: [] }));
        }
        return Promise.resolve(json({ video: { ...videos[0], subtitleCues: [] } }));
      })
    );
    renderPage();

    expect(await screen.findByText('弹幕暂时不可用（HTTP 503）')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载弹幕' }));

    await waitFor(() =>
      expect(screen.queryByText('弹幕暂时不可用（HTTP 503）')).not.toBeInTheDocument()
    );
    expect(danmakuAttempts).toBe(2);
  });

  it('offers a retry after a list error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ message: '网络暂时不可用' }, 503))
      .mockImplementation((request: RequestInfo | URL) => {
        const url = String(request);
        if (url === '/api/videos') return Promise.resolve(json({ videos }));
        if (url.includes('/danmaku?')) return Promise.resolve(json({ danmaku: [] }));
        return Promise.resolve(json({ video: { ...videos[0], subtitleCues: [] } }));
      });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    expect(await screen.findByText('网络暂时不可用（HTTP 503）')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));

    expect(await screen.findByRole('heading', { name: '西湖晨光' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/videos');
  });

  it('shows an empty state when the API has no videos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ videos: [] })));
    renderPage();

    expect(await screen.findByText('暂时没有可播放的视频')).toBeInTheDocument();
  });

  it('returns to the home route through its navigation callback', async () => {
    installVideoApi();
    const { onReturnHome } = renderPage();

    await screen.findByRole('heading', { name: '西湖晨光' });
    fireEvent.click(screen.getByRole('button', { name: '返回首页' }));

    await waitFor(() => expect(onReturnHome).toHaveBeenCalledTimes(1));
  });
});
