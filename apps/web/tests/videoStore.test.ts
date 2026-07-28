import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadVideos, selectVideo, videoReducer } from '../src/store/videoStore';

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

function createStore() {
  return configureStore({ reducer: { video: videoReducer } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('videoStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads videos and selects the first item after a successful response', async () => {
    const response = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response.promise)
    );
    const store = createStore();

    const pending = store.dispatch(loadVideos());
    expect(store.getState().video.status).toBe('loading');

    response.resolve(
      new Response(JSON.stringify({ videos }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    await pending;

    expect(store.getState().video).toMatchObject({
      videos,
      selectedVideoId: 'west-lake-dawn',
      status: 'ready',
      error: null
    });
  });

  it('preserves a readable HTTP error when loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: '视频服务暂时不可用' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    const store = createStore();

    await store.dispatch(loadVideos());

    expect(store.getState().video).toMatchObject({
      status: 'error',
      error: '视频服务暂时不可用（HTTP 503）'
    });
  });

  it('keeps an explicit video selection', () => {
    const store = createStore();
    store.dispatch(selectVideo('canal-night'));

    expect(store.getState().video.selectedVideoId).toBe('canal-night');
  });
});
