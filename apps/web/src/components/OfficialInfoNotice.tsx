import { CircleAlert } from 'lucide-react';
import type { ScenicOfficialInfo } from '../types/guide';

type OfficialInfoNoticeProps = {
  info?: ScenicOfficialInfo;
};

const STATUS_LABELS: Record<ScenicOfficialInfo['status'], string> = {
  live: '已同步官方信息',
  stale: '官方信息暂未刷新，显示最近一次结果',
  fallback: '官方源暂时不可用，显示本地资料',
  unconfigured: '尚未配置官方数据源，请以景区当天公告为准'
};

export function OfficialInfoNotice({ info }: OfficialInfoNoticeProps) {
  const status = info?.status ?? 'unconfigured';
  const notice =
    info?.notices[0] ?? '票价、开放时间、预约规则和交通班次可能变化，请以景区官方当天公告为准。';
  const checkedAt = info?.checkedAt ? new Date(info.checkedAt).toLocaleString() : null;

  return (
    <section className="tourism-passport-warning" data-official-info-status={status}>
      <CircleAlert size={20} aria-hidden="true" />
      <div>
        <h3>官方信息</h3>
        <p>{notice}</p>
        <small>
          {STATUS_LABELS[status]}
          {info?.sourceName ? ` · ${info.sourceName}` : ''}
          {checkedAt ? ` · ${checkedAt}` : ''}
        </small>
        {info?.sourceUrl ? (
          <a href={info.sourceUrl} target="_blank" rel="noreferrer">
            查看官方来源
          </a>
        ) : null}
      </div>
    </section>
  );
}
