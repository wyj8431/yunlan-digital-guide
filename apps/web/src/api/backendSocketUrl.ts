// 根据页面协议和主机推导后端 WebSocket 地址，兼容本地开发与部署环境。
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export function createBackendWebSocketUrl(pathname: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const isLocalFrontend =
    LOCAL_HOSTNAMES.has(window.location.hostname) && window.location.port !== '8787';
  const host = isLocalFrontend ? `${window.location.hostname}:8787` : window.location.host;

  return `${protocol}//${host}${pathname}`;
}
