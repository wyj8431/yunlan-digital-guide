import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/vmss': {
        target: 'http://vms.cn-huadong-1.xf-yun.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vmss/, '')
      }
    }
  }
});
