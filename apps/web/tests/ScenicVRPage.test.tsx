import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScenicVRPage } from '../src/components/ScenicVRPage';

afterEach(cleanup);

describe('ScenicVRPage', () => {
  it('renders an immersive scenic panorama with view controls', () => {
    const { container } = render(
      <ScenicVRPage
        spotId="water-market"
        onBack={vi.fn()}
        onOpenScenic={vi.fn()}
      />
    );

    const page = container.querySelector('.scenic-vr-page');
    expect(page).toBeInTheDocument();
    expect(page).toHaveClass('scenic-vr-page--clean');
    expect(screen.getByRole('heading', { name: '水上集市' })).toBeInTheDocument();
    expect(screen.getByLabelText('水上集市 360 度 VR 全景场景')).toBeInTheDocument();
    expect(page).toHaveStyle({
      backgroundImage: expect.stringContaining('/images/wuzhen-water-town-bg.jpg')
    });
    expect(container.querySelector('.scenic-vr-canvas')).toHaveClass('scenic-vr-canvas--immersive');
    expect(screen.getByRole('button', { name: '返回景点列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '放大视野' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置视角' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '缩小视野' })).toBeInTheDocument();
  });
});
