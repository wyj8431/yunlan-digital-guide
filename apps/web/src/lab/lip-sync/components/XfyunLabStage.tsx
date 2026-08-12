import { FormEvent, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { useXfyunVirtualHuman } from '../../../hooks/useXfyunVirtualHuman';

const STREAM_DOM_ID = 'xfyun-lip-sync-lab-stream';
const DEFAULT_SCRIPT = '欢迎来到乌镇。这里是讯飞在线数字人实验模式。';

type XfyunLabStageProps = {
  onUseLocalFallback: () => void;
};

export function XfyunLabStage({ onUseLocalFallback }: XfyunLabStageProps) {
  const [draft, setDraft] = useState(DEFAULT_SCRIPT);
  const [submittedText, setSubmittedText] = useState('');
  const virtualHuman = useXfyunVirtualHuman({
    answerText: submittedText,
    streamDomId: STREAM_DOM_ID
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextText = draft.trim();

    if (!nextText) {
      return;
    }

    setSubmittedText(`${nextText}\n`);
  }

  const isUnavailable = virtualHuman.status === 'error' || virtualHuman.status === 'fallback';

  return (
    <section className="xfyun-lab-stage" aria-label="讯飞在线数字人预览">
      <div className="xfyun-lab-stage__stream-shell">
        <div id={STREAM_DOM_ID} className="xfyun-lab-stage__stream" />
        <div className="xfyun-lab-stage__status" role="status">
          <strong>
            {virtualHuman.active
              ? '讯飞在线数字人已连接'
              : virtualHuman.status === 'loading'
                ? '正在连接讯飞在线数字人'
                : isUnavailable
                  ? '讯飞在线数字人不可用'
                  : '等待讯飞在线数字人'}
          </strong>
          <span>{virtualHuman.message}</span>
          {isUnavailable ? (
            <div className="xfyun-lab-stage__status-actions">
              <button type="button" onClick={virtualHuman.retry}>
                <RefreshCw aria-hidden="true" size={16} />
                重试连接
              </button>
              <button type="button" onClick={onUseLocalFallback}>
                切回本地模型
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <form className="xfyun-lab-stage__script" onSubmit={handleSubmit}>
        <label htmlFor="xfyun-lab-script">讯飞讲解文本</label>
        <textarea
          id="xfyun-lab-script"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          disabled={!virtualHuman.active}
        />
        <button
          type="submit"
          disabled={!virtualHuman.active || !draft.trim() || virtualHuman.speaking}
        >
          <Send aria-hidden="true" size={16} />
          {virtualHuman.speaking ? '讯飞数字人讲解中' : '由讯飞数字人讲解'}
        </button>
      </form>
    </section>
  );
}
