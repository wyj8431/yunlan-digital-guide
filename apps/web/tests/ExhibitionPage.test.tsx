import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const rendererState = vi.hoisted(() => ({
  hallDispose: vi.fn(),
  lakeDispose: vi.fn(),
  setInteractionEnabled: vi.fn(),
  selectExhibit: null as null | ((id: string) => void)
}));

vi.mock('../src/exhibition/ExhibitionRenderer', () => ({
  ExhibitionRenderer: class {
    constructor(options: { host: HTMLElement; onExhibitSelect: (id: string) => void }) {
      options.host.appendChild(document.createElement('canvas'));
      rendererState.selectExhibit = options.onExhibitSelect;
    }
    dispose = rendererState.hallDispose;
    setInteractionEnabled = rendererState.setInteractionEnabled;
  }
}));

vi.mock('../src/exhibition/westLakeScene', () => ({
  WestLakeScene: class {
    constructor(options: { host: HTMLElement }) {
      options.host.appendChild(document.createElement('canvas'));
    }
    dispose = rendererState.lakeDispose;
  }
}));

import { ExhibitionPage } from '../src/components/ExhibitionPage';

describe('ExhibitionPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    rendererState.selectExhibit = null;
  });

  it('mounts the full-bleed hall and disposes it on unmount', () => {
    const { unmount } = render(<ExhibitionPage onReturnHome={vi.fn()} />);

    expect(screen.getByLabelText('西湖室内 3D 展馆').querySelector('canvas')).not.toBeNull();
    expect(screen.getByText('WASD 移动 · 鼠标拖动视角')).toBeInTheDocument();

    unmount();
    expect(rendererState.hallDispose).toHaveBeenCalledTimes(1);
  });

  it('shows accessible exhibit details with a video-center link', () => {
    render(<ExhibitionPage onReturnHome={vi.fn()} />);

    act(() => rendererState.selectExhibit?.('west-lake-bicycle'));

    expect(screen.getByRole('dialog', { name: '西湖绿道自行车' })).toBeInTheDocument();
    expect(rendererState.setInteractionEnabled).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('link', { name: '去视频中心' })).toHaveAttribute('href', '/videos');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(rendererState.setInteractionEnabled).toHaveBeenLastCalledWith(true);
  });

  it('switches from the sand table to West Lake and returns to the hall', () => {
    render(<ExhibitionPage onReturnHome={vi.fn()} />);
    act(() => rendererState.selectExhibit?.('west-lake-map'));

    fireEvent.click(screen.getByRole('button', { name: '进入西湖沙盘' }));
    expect(rendererState.hallDispose).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('西湖轻量 3D 沙盘').querySelector('canvas')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '返回展馆' }));
    expect(rendererState.lakeDispose).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('西湖室内 3D 展馆')).toBeInTheDocument();
  });

  it('provides home and digital-human customer-service actions', () => {
    const onReturnHome = vi.fn();
    render(<ExhibitionPage onReturnHome={onReturnHome} />);

    fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
    fireEvent.click(screen.getByRole('button', { name: '数字人客服' }));
    expect(onReturnHome).toHaveBeenCalledTimes(2);
  });
});
