import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuidePanel } from '../src/components/GuidePanel';
import type { ScenicAreaSummary } from '../src/types/guide';

const SCENIC_NAME = '乌镇景区';
const SCENIC_DESCRIPTION = '乌镇位于浙江省嘉兴市桐乡市，是典型江南水乡古镇。';
const TICKET_INFO = '西栅 150 元';
const QUICK_QUESTION = '帮我规划一条乌镇半日游路线';
const PANEL_TITLE = '\u5bf9\u8bdd\u5bfc\u89c8';

const scenicArea: ScenicAreaSummary = {
  scenicArea: {
    id: 'wuzhen-scenic-area',
    name: SCENIC_NAME,
    description: SCENIC_DESCRIPTION,
    openingHours: '09:00-21:00',
    ticketInfo: TICKET_INFO
  },
  spots: [],
  routes: [],
  services: [],
  quickQuestions: [QUICK_QUESTION]
};

describe('GuidePanel', () => {
  it('renders chat controls and submits quick questions', () => {
    const onAsk = vi.fn();

    render(
      <GuidePanel
        scenicArea={scenicArea}
        messages={[]}
        loading={false}
        error={null}
        onAsk={onAsk}
      />
    );

    expect(screen.getByRole('heading', { name: PANEL_TITLE })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: QUICK_QUESTION }));

    expect(onAsk).toHaveBeenCalledWith(QUICK_QUESTION);
  });

  it('shows stop and resend controls for an active or cancelled answer', () => {
    const onStopGenerating = vi.fn();
    const onResend = vi.fn();
    const { rerender } = render(
      <GuidePanel
        scenicArea={scenicArea}
        messages={[]}
        loading
        error={null}
        onAsk={vi.fn()}
        onStopGenerating={onStopGenerating}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '停止生成' }));
    expect(onStopGenerating).toHaveBeenCalledOnce();

    rerender(
      <GuidePanel
        scenicArea={scenicArea}
        messages={[]}
        loading={false}
        error={null}
        onAsk={vi.fn()}
        onResend={onResend}
        canResend
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '重新生成' }));
    expect(onResend).toHaveBeenCalledOnce();
  });
});
