import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LipSyncLab } from '../src/lab/lip-sync/LipSyncLab';

vi.mock('../src/lab/lip-sync/components/LipSyncStage', () => ({
  LipSyncStage: () => <section aria-label="本地 3D 数字人口型预览" />
}));

vi.mock('../src/lab/lip-sync/components/XfyunLabStage', () => ({
  XfyunLabStage: () => <section aria-label="xfyun-online-avatar-preview" />
}));

describe('LipSyncLab', () => {
  it('renders the lab controls, stage, and metrics workspace', () => {
    const { container } = render(<LipSyncLab />);

    expect(screen.getByRole('heading', { name: '口型与性能实验室' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回导游' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '预置音频' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '本地文件' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '音频 URL' })).toBeInTheDocument();
    expect(screen.getByLabelText('灵敏度')).toBeInTheDocument();
    expect(screen.getByLabelText('噪声阈值')).toBeInTheDocument();
    expect(screen.getByLabelText('最大开口')).toBeInTheDocument();
    expect(screen.getByLabelText('张口速度')).toBeInTheDocument();
    expect(screen.getByLabelText('闭口速度')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '渲染质量' })).toBeInTheDocument();
    expect(screen.getByLabelText('自动质量调节')).toBeInTheDocument();
    expect(screen.getByLabelText('本地 3D 数字人口型预览')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '播放状态' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '性能指标' })).toBeInTheDocument();
    expect(container.querySelector('.lip-sync-panel .lip-sync-panel')).not.toBeInTheDocument();
  });

  it('switches to the XFYUN online avatar without rendering local audio controls', () => {
    const { container } = render(<LipSyncLab />);
    const scope = within(container);

    fireEvent.click(scope.getByRole('button', { name: '讯飞在线模型' }));

    expect(scope.getByLabelText('xfyun-online-avatar-preview')).toBeInTheDocument();
    expect(
      scope.getByText('讯飞 VMS 负责形象渲染、语音播放和口型。该模式不会同时播放本地音频。')
    ).toBeInTheDocument();
    expect(scope.queryByRole('button', { name: '播放' })).not.toBeInTheDocument();
  });
});
