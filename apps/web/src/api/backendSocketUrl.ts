const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export function createBackendWebSocketUrl(pathname: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const isLocalFrontend =
    LOCAL_HOSTNAMES.has(window.location.hostname) && window.location.port !== '8787';
  const host = isLocalFrontend ? `${window.location.hostname}:8787` : window.location.host;

  return `${protocol}//${host}${pathname}`;
}
