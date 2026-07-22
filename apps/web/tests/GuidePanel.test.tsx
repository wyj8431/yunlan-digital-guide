import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuidePanel } from '../src/components/GuidePanel';
import type { ScenicAreaSummary } from '../src/types/guide';

const SCENIC_NAME = '\u4e91\u5c9a\u53e4\u9547';
const SCENIC_DESCRIPTION =
  '\u4e00\u5ea7\u4ee5\u6c34\u5df7\u3001\u53e4\u6865\u3001\u8336\u574a\u3001\u706f\u5df7\u548c\u620f\u53f0\u6587\u5316\u4e3a\u7279\u8272\u7684\u865a\u62df\u53e4\u9547\u3002';
const TICKET_INFO = '\u6210\u4eba\u7968 60 \u5143';
const QUICK_QUESTION = '\u5e2e\u6211\u89c4\u5212\u4e00\u6761\u534a\u65e5\u6e38\u8def\u7ebf';
const PANEL_TITLE = '\u5bf9\u8bdd\u5bfc\u89c8';

const scenicArea: ScenicAreaSummary = {
  scenicArea: {
    id: 'yunlan-town',
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
});
