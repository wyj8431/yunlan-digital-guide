// 弹幕编辑器管理内容、位置、颜色以及提交中的禁用状态。
import { Send } from 'lucide-react';
import { useState, type CSSProperties, type FormEvent } from 'react';
import type { CreateDanmakuInput, DanmakuColor, DanmakuPosition } from '../types/video';

type DanmakuComposerProps = {
  currentMs: number;
  disabled?: boolean;
  onSubmit: (input: CreateDanmakuInput) => Promise<void>;
  onPreviewChange?: (
    preview: Pick<CreateDanmakuInput, 'content' | 'position' | 'color'> | null
  ) => void;
};

const colors: DanmakuColor[] = ['#ffffff', '#f5d76e', '#aee7ff', '#ffc0cb'];

export function DanmakuComposer({
  currentMs,
  disabled,
  onSubmit,
  onPreviewChange
}: DanmakuComposerProps) {
  const [content, setContent] = useState('');
  const [position, setPosition] = useState<DanmakuPosition>('scroll');
  const [color, setColor] = useState<DanmakuColor>('#ffffff');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updatePreview(
    nextContent: string,
    nextPosition: DanmakuPosition,
    nextColor: DanmakuColor,
    showPlaceholder = false
  ) {
    const trimmed = nextContent.trim();
    const previewContent = trimmed || (showPlaceholder ? '新弹幕预览' : '');
    onPreviewChange?.(
      previewContent ? { content: previewContent, position: nextPosition, color: nextColor } : null
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ content: trimmed, timestampMs: Math.round(currentMs), position, color });
      setContent('');
      onPreviewChange?.(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '发送弹幕失败，请稍后再试。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="danmaku-composer" onSubmit={submit}>
      <input
        aria-label="输入弹幕"
        value={content}
        maxLength={80}
        disabled={disabled || submitting}
        placeholder="发一条弹幕"
        onChange={(event) => {
          const nextContent = event.target.value;
          setContent(nextContent);
          updatePreview(nextContent, position, color);
        }}
      />
      <select
        aria-label="弹幕位置"
        value={position}
        disabled={disabled || submitting}
        onChange={(event) => {
          const nextPosition = event.target.value as DanmakuPosition;
          setPosition(nextPosition);
          updatePreview(content, nextPosition, color, true);
        }}
      >
        <option value="scroll">滚动</option>
        <option value="top">顶部</option>
        <option value="bottom">底部</option>
      </select>
      <div className="danmaku-colors" aria-label="弹幕颜色">
        {colors.map((candidate) => (
          <button
            key={candidate}
            aria-label={`选择${candidate}颜色`}
            aria-pressed={color === candidate}
            className={color === candidate ? 'is-selected' : undefined}
            type="button"
            style={{ '--swatch-color': candidate } as CSSProperties}
            disabled={disabled || submitting}
            onClick={() => {
              setColor(candidate);
              updatePreview(content, position, candidate);
            }}
          />
        ))}
      </div>
      <button
        aria-label="发送弹幕"
        type="submit"
        disabled={disabled || submitting || !content.trim()}
      >
        <Send aria-hidden="true" size={16} />
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
