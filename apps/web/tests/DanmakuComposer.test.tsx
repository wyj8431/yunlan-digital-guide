import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DanmakuComposer } from '../src/video/DanmakuComposer';

describe('DanmakuComposer', () => {
  it('previews and submits the selected danmaku position', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onPreviewChange = vi.fn();

    render(
      <DanmakuComposer currentMs={12_000} onSubmit={onSubmit} onPreviewChange={onPreviewChange} />
    );

    fireEvent.change(screen.getByLabelText('弹幕位置'), { target: { value: 'bottom' } });
    expect(onPreviewChange).toHaveBeenLastCalledWith({
      content: '新弹幕预览',
      position: 'bottom',
      color: '#ffffff'
    });

    fireEvent.change(screen.getByLabelText('输入弹幕'), { target: { value: '西栅夜景很漂亮' } });
    fireEvent.change(screen.getByLabelText('弹幕位置'), { target: { value: 'top' } });

    expect(onPreviewChange).toHaveBeenLastCalledWith({
      content: '西栅夜景很漂亮',
      position: 'top',
      color: '#ffffff'
    });

    fireEvent.click(screen.getByRole('button', { name: '发送弹幕' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        content: '西栅夜景很漂亮',
        timestampMs: 12_000,
        position: 'top',
        color: '#ffffff'
      })
    );
    expect(onPreviewChange).toHaveBeenLastCalledWith(null);
  });
});
