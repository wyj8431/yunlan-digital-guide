// 提供景区概要和完整详情的只读接口。
import Router from '@koa/router';
import { getScenicAreaSummary } from './scenic-data.js';
import { ScenicLiveService } from './scenic-live.service.js';

const WUZHEN_SCENIC_AREA_ID = 'wuzhen-scenic-area';

export async function getOfficialNoticePluginResponse(
  service: ScenicLiveService,
  spotId: string
): Promise<{ status: number; body: Record<string, string> }> {
  if (spotId !== WUZHEN_SCENIC_AREA_ID) {
    return {
      status: 404,
      body: {
        code: 'OFFICIAL_NOTICE_SPOT_NOT_FOUND',
        message: 'Only the registered Wuzhen scenic-area identifier is available.'
      }
    };
  }

  const summary = await service.getSummary();
  const officialInfo = summary.officialInfo;
  const sourceUrl =
    officialInfo?.sourceUrl ?? summary.scenicArea.sourceUrl ?? 'https://www.ewuzhen.com/';
  const updatedAt =
    officialInfo?.updatedAt ??
    summary.scenicArea.sourceUpdatedAt ??
    officialInfo?.checkedAt ??
    new Date().toISOString();
  const content = officialInfo?.notices.length
    ? officialInfo.notices.join('\n')
    : 'No current official notice is available. Confirm live visitor information on the official site.';

  return {
    status: 200,
    body: {
      title: `${summary.scenicArea.name} official notices`,
      content,
      sourceUrl,
      updatedAt,
      status: officialInfo?.status ?? 'unconfigured'
    }
  };
}

export function createScenicRouter(
  service = new ScenicLiveService({ feedUrl: '', fallback: getScenicAreaSummary })
): Router {
  const router = new Router();

  router.get('/api/scenic-area', async (ctx) => {
    ctx.body = await service.getSummary();
  });

  router.get('/api/coze/plugins/official-notices/:spotId', async (ctx) => {
    const response = await getOfficialNoticePluginResponse(service, ctx.params.spotId);
    ctx.status = response.status;
    ctx.body = response.body;
  });

  return router;
}
