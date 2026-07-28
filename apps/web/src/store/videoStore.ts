import {
  configureStore,
  createAsyncThunk,
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit';
import { fetchDanmaku, fetchVideo, fetchVideos, postDanmaku } from '../api/videoApi';
import type { CreateDanmakuInput, Danmaku, VideoDetail, VideoSummary } from '../types/video';

export type VideoLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export type VideoState = {
  videos: VideoSummary[];
  selectedVideoId: string | null;
  detailsByVideoId: Record<string, VideoDetail | undefined>;
  danmakuByVideoId: Record<string, Danmaku[] | undefined>;
  detailStatusByVideoId: Record<string, VideoLoadStatus | undefined>;
  detailErrorByVideoId: Record<string, string | null | undefined>;
  danmakuStatusByVideoId: Record<string, VideoLoadStatus | undefined>;
  danmakuErrorByVideoId: Record<string, string | null | undefined>;
  status: VideoLoadStatus;
  error: string | null;
};

const initialState: VideoState = {
  videos: [],
  selectedVideoId: null,
  detailsByVideoId: {},
  danmakuByVideoId: {},
  detailStatusByVideoId: {},
  detailErrorByVideoId: {},
  danmakuStatusByVideoId: {},
  danmakuErrorByVideoId: {},
  status: 'idle',
  error: null
};

export const loadVideos = createAsyncThunk('video/loadVideos', async () => {
  const response = await fetchVideos();
  return response.videos;
});

export const loadVideoDetail = createAsyncThunk(
  'video/loadVideoDetail',
  async (videoId: string) => {
    const response = await fetchVideo(videoId);
    return response.video;
  }
);

export const loadDanmaku = createAsyncThunk(
  'video/loadDanmaku',
  async ({ videoId, fromMs, toMs }: { videoId: string; fromMs: number; toMs: number }) => {
    const response = await fetchDanmaku(videoId, fromMs, toMs);
    return { videoId, danmaku: response.danmaku };
  }
);

export const sendDanmaku = createAsyncThunk(
  'video/sendDanmaku',
  async ({ videoId, input }: { videoId: string; input: CreateDanmakuInput }) => {
    const response = await postDanmaku(videoId, input);
    return response.danmaku;
  }
);

const videoSlice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    selectVideo(state, action: PayloadAction<string>) {
      state.selectedVideoId = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadVideos.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadVideos.fulfilled, (state, action) => {
        state.videos = action.payload;
        state.status = 'ready';
        state.error = null;
        state.selectedVideoId = action.payload.some((video) => video.id === state.selectedVideoId)
          ? state.selectedVideoId
          : (action.payload[0]?.id ?? null);
      })
      .addCase(loadVideos.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message ?? '视频列表加载失败，请稍后重试。';
      })
      .addCase(loadVideoDetail.pending, (state, action) => {
        const videoId = action.meta.arg;
        state.detailStatusByVideoId[videoId] = 'loading';
        state.detailErrorByVideoId[videoId] = null;
      })
      .addCase(loadVideoDetail.fulfilled, (state, action) => {
        state.detailsByVideoId[action.payload.id] = action.payload;
        state.detailStatusByVideoId[action.payload.id] = 'ready';
        state.detailErrorByVideoId[action.payload.id] = null;
      })
      .addCase(loadVideoDetail.rejected, (state, action) => {
        const videoId = action.meta.arg;
        state.detailStatusByVideoId[videoId] = 'error';
        state.detailErrorByVideoId[videoId] = action.error.message ?? '视频详情加载失败，请重试。';
      })
      .addCase(loadDanmaku.pending, (state, action) => {
        const videoId = action.meta.arg.videoId;
        state.danmakuStatusByVideoId[videoId] = 'loading';
        state.danmakuErrorByVideoId[videoId] = null;
      })
      .addCase(loadDanmaku.fulfilled, (state, action) => {
        state.danmakuByVideoId[action.payload.videoId] = action.payload.danmaku;
        state.danmakuStatusByVideoId[action.payload.videoId] = 'ready';
        state.danmakuErrorByVideoId[action.payload.videoId] = null;
      })
      .addCase(loadDanmaku.rejected, (state, action) => {
        const videoId = action.meta.arg.videoId;
        state.danmakuStatusByVideoId[videoId] = 'error';
        state.danmakuErrorByVideoId[videoId] = action.error.message ?? '弹幕加载失败，请重试。';
      })
      .addCase(sendDanmaku.fulfilled, (state, action) => {
        const existing = state.danmakuByVideoId[action.payload.videoId] ?? [];
        state.danmakuByVideoId[action.payload.videoId] = [...existing, action.payload].sort(
          (left, right) => left.timestampMs - right.timestampMs || left.id - right.id
        );
      });
  }
});

export const { selectVideo } = videoSlice.actions;
export const videoReducer = videoSlice.reducer;

export const store = configureStore({
  reducer: {
    video: videoReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
