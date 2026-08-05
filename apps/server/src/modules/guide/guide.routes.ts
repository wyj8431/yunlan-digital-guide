// 导游 HTTP 路由负责参数校验，并把领域错误映射为稳定响应。
import Router from '@koa/router';
import { readEnv } from '../../config/env.js';
import {
  getScenicAreaSummary,
  loadScenicData,
  mergeScenicDataWithSummary
} from '../scenic/scenic-data.js';
import { ScenicLiveService } from '../scenic/scenic-live.service.js';
import { formatGuideKnowledgeContext, retrieveGuideKnowledge } from './guide-retrieval.js';
import { GuideAttachmentError, normalizeGuideAttachment } from './guide-attachment.js';
import { destinationGuidePlanRecords } from './guide-knowledge-data.js';
import { findProvinceTourismRecord, provinceTourismRecords } from './province-tourism-data.js';
import { createGuideExport, GuideExportError } from './guide-export.js';
import {
  createGuideResponse,
  GuideServiceError,
  normalizeGuideHistory,
  normalizeGuideImage
} from './guide.service.js';

type ChatRequestBody = {
  message?: unknown;
  attachment?: unknown;
  image?: unknown;
  history?: unknown;
};

type ExportRequestBody = {
  content?: unknown;
  format?: unknown;
  title?: unknown;
};

export function createGuideRouter(
  scenicLiveService = new ScenicLiveService({ feedUrl: '', fallback: getScenicAreaSummary })
): Router {
  const router = new Router();

  const loadGuideScenicData = async () =>
    mergeScenicDataWithSummary(loadScenicData(), await scenicLiveService.getSummary());

  router.get('/api/destinations', (ctx) => {
    ctx.body = {
      destinations: destinationGuidePlanRecords.map((record) => ({
        id: record.destination,
        name: record.destination,
        summary: record.sections[0]
      }))
    };
  });

  router.get('/api/destinations/:destination', (ctx) => {
    const record = destinationGuidePlanRecords.find(
      (candidate) => candidate.destination === ctx.params.destination
    );

    if (!record) {
      ctx.status = 404;
      ctx.body = { code: 'DESTINATION_NOT_FOUND', message: '没有找到这个目的地。' };
      return;
    }

    ctx.body = record;
  });

  router.get('/api/provinces', (ctx) => {
    ctx.body = {
      provinces: provinceTourismRecords.map((record) => ({
        name: record.province,
        summary: record.summary,
        spotCount: record.highlights.length,
        featuredSpots: record.highlights.slice(0, 6).map((spot) => spot.name)
      }))
    };
  });

  router.get('/api/provinces/:province', (ctx) => {
    const record = findProvinceTourismRecord(ctx.params.province);

    if (!record) {
      ctx.status = 404;
      ctx.body = {
        code: 'PROVINCE_NOT_FOUND',
        message: '没有找到这个省份的旅游资料。'
      };
      return;
    }

    ctx.body = record;
  });

  router.get('/api/guide/retrieval', async (ctx) => {
    const rawQuery = ctx.query.query;
    const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';

    if (!query) {
      ctx.status = 400;
      ctx.body = { code: 'EMPTY_QUERY', message: '请输入要检索的景区旅游问题。' };
      return;
    }

    const results = retrieveGuideKnowledge(query, await loadGuideScenicData());

    ctx.body = {
      query,
      results,
      context: formatGuideKnowledgeContext(results)
    };
  });

  router.post('/api/guide/chat', async (ctx) => {
    const body = ctx.request.body as ChatRequestBody | undefined;
    const message = typeof body?.message === 'string' ? body.message : '';

    try {
      const scenicData = await loadGuideScenicData();
      ctx.body = await createGuideResponse({
        message,
        attachment:
          body?.attachment !== undefined
            ? normalizeGuideAttachment(body.attachment)
            : normalizeGuideImage(body?.image),
        history: normalizeGuideHistory(body?.history),
        scenicData,
        env: readEnv()
      });
    } catch (caught) {
      if (caught instanceof GuideServiceError || caught instanceof GuideAttachmentError) {
        ctx.status = caught.status;
        ctx.body = { code: caught.code, message: caught.message };
        return;
      }

      ctx.status = 500;
      ctx.body = { code: 'INTERNAL_ERROR', message: '服务暂时不可用，请稍后再试。' };
    }
  });

  router.post('/api/guide/export', async (ctx) => {
    const body = (ctx.request.body ?? {}) as ExportRequestBody;

    try {
      const exported = await createGuideExport(body);
      ctx.set('Content-Type', exported.contentType);
      ctx.set(
        'Content-Disposition',
        `attachment; filename="guide-answer.${exported.extension}"; filename*=UTF-8''${encodeURIComponent(exported.filename)}`
      );
      ctx.set('Content-Length', String(exported.buffer.byteLength));
      ctx.body = exported.buffer;
    } catch (caught) {
      if (caught instanceof GuideExportError) {
        ctx.status = caught.status;
        ctx.body = { code: caught.code, message: caught.message };
        return;
      }

      ctx.status = 500;
      ctx.body = { code: 'EXPORT_FAILED', message: '文件生成失败，请稍后重试。' };
    }
  });

  return router;
}
