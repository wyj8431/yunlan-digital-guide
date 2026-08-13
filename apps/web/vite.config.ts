import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api/platform': {
        target: 'http://localhost:8080'
      },
      '/api/tickets': {
        target: 'http://localhost:8080'
      },
      '/api/learning': {
        target: 'http://localhost:8080'
      },
      '/api/alerts': {
        target: 'http://localhost:8080'
      },
      '/api': {
        target: 'http://localhost:8787',
        ws: true
      },
      '/vmss': {
        target: 'http://vms.cn-huadong-1.xf-yun.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vmss/, '')
      }
    }
  }
});
