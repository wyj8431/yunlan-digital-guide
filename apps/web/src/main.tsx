// 浏览器入口：挂载 React 根组件并初始化全局样式。
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RootApp } from './RootApp';
import { store } from './store/videoStore';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <RootApp />
    </Provider>
  </StrictMode>
);
