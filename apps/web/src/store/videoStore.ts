import {
  configureStore,
  createAsyncThunk,
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit';
import { fetchVideos } from '../api/videoApi';
import type { VideoSummary } from '../types/video';

export type VideoLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export type VideoState = {
  videos: VideoSummary[];
  selectedVideoId: string | null;
  status: VideoLoadStatus;
  error: string | null;
};

const initialState: VideoState = {
  videos: [],
  selectedVideoId: null,
  status: 'idle',
  error: null
};

export const loadVideos = createAsyncThunk('video/loadVideos', async () => {
  const response = await fetchVideos();
  return response.videos;
});

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
