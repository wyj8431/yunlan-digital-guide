// 提供 OpenAPI JSON 和可直接浏览的接口文档页面。
import Router from '@koa/router';
import { createOpenApiDocument } from './openapi.js';

function renderDocsHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>乌镇景区 AI 数字导游 API 文档</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, "Microsoft YaHei", Arial, sans-serif; }
      body { margin: 0; background: #0b0b0a; color: #f4f1ec; }
      header { padding: 28px 36px; border-bottom: 1px solid #2c2925; background: #141210; position: sticky; top: 0; z-index: 2; }
      h1 { margin: 0 0 8px; font-size: 26px; }
      p { color: #b9b1a8; line-height: 1.7; }
      a { color: #ff8a3d; text-decoration: none; }
      main { max-width: 1120px; margin: 0 auto; padding: 28px 36px 60px; }
      .meta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 14px; }
      .chip { border: 1px solid #3a342f; border-radius: 999px; padding: 7px 12px; color: #d7d0c8; background: #1e1a17; }
      section { margin: 22px 0; }
      .path { border: 1px solid #302c28; border-radius: 8px; background: #151311; margin: 14px 0; overflow: hidden; }
      .path-head { display: flex; gap: 14px; align-items: center; padding: 14px 16px; border-bottom: 1px solid #302c28; }
      .method { min-width: 58px; text-align: center; font-weight: 800; border-radius: 6px; padding: 5px 8px; color: #10100f; }
      .GET { background: #7dd3fc; }
      .POST { background: #86efac; }
      code { color: #f8d7b0; font-family: "JetBrains Mono", Consolas, monospace; }
      .path-body { padding: 14px 16px 18px; }
      .tag { color: #ff8a3d; font-weight: 700; }
      pre { overflow: auto; background: #0e0d0c; border: 1px solid #2d2925; border-radius: 8px; padding: 12px; color: #ddd4ca; }
      details { margin-top: 10px; }
      summary { cursor: pointer; color: #f2c28f; }
      @media (max-width: 720px) { header, main { padding-left: 18px; padding-right: 18px; } .path-head { align-items: flex-start; flex-direction: column; } }
    </style>
  </head>
  <body>
    <header>
      <h1>乌镇景区 AI 数字导游 API 文档</h1>
      <p>在线接口文档由后端实时生成，包含 REST 接口和 WebSocket 协议说明。</p>
      <div class="meta">
        <span class="chip">OpenAPI 3.1</span>
        <a class="chip" href="/api/docs/openapi.json">查看 JSON</a>
        <a class="chip" href="/api/health">健康检查</a>
      </div>
    </header>
    <main id="app"><p>正在加载接口文档...</p></main>
    <script>
      const app = document.getElementById('app');
      const methodOrder = ['get', 'post', 'put', 'patch', 'delete'];
      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
      }
      function renderOperation(path, method, operation) {
        const responses = Object.entries(operation.responses || {}).map(([status, response]) => '<li><code>' + status + '</code> ' + escapeHtml(response.description || '') + '</li>').join('');
        const requestBody = operation.requestBody ? '<details><summary>请求体</summary><pre>' + escapeHtml(JSON.stringify(operation.requestBody.content || operation.requestBody, null, 2)) + '</pre></details>' : '';
        const parameters = operation.parameters ? '<details><summary>参数</summary><pre>' + escapeHtml(JSON.stringify(operation.parameters, null, 2)) + '</pre></details>' : '';
        return '<article class="path"><div class="path-head"><span class="method ' + method.toUpperCase() + '">' + method.toUpperCase() + '</span><code>' + escapeHtml(path) + '</code></div><div class="path-body"><div class="tag">' + escapeHtml((operation.tags || [])[0] || 'API') + '</div><h2>' + escapeHtml(operation.summary || path) + '</h2><p>' + escapeHtml(operation.description || '') + '</p>' + parameters + requestBody + '<h3>响应</h3><ul>' + responses + '</ul></div></article>';
      }
      fetch('/api/docs/openapi.json').then((res) => res.json()).then((spec) => {
        const tags = '<section><h2>接口分组</h2>' + spec.tags.map((tag) => '<p><strong>' + escapeHtml(tag.name) + '</strong>：' + escapeHtml(tag.description || '') + '</p>').join('') + '</section>';
        const paths = Object.entries(spec.paths).flatMap(([path, item]) => methodOrder.filter((method) => item[method]).map((method) => renderOperation(path, method, item[method]))).join('');
        app.innerHTML = tags + '<section><h2>接口列表</h2>' + paths + '</section>';
      }).catch((error) => {
        app.innerHTML = '<p>接口文档加载失败：' + escapeHtml(error.message) + '</p>';
      });
    </script>
  </body>
</html>`;
}

export function createDocsRouter(): Router {
  const router = new Router();

  router.get('/api/docs/openapi.json', (ctx) => {
    ctx.body = createOpenApiDocument(ctx.origin);
  });

  router.get('/api/docs', (ctx) => {
    ctx.type = 'html';
    ctx.body = renderDocsHtml();
  });

  return router;
}
