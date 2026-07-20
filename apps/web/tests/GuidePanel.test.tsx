import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuidePanel } from '../src/components/GuidePanel';
import type { ScenicAreaSummary } from '../src/types/guide';

const scenicArea: ScenicAreaSummary = {
  scenicArea: {
    id: 'yunlan-town',
    name: '云岚古镇',
    description: '一座以水巷、古桥、茶坊、灯巷和戏台文化为特色的虚拟古镇。',
    openingHours: '09:00-21:00',
    ticketInfo: '成人票 60 元'
  },
  spots: [],
  routes: [],
  services: [],
  quickQuestions: ['帮我规划一条半日游路线']
};

describe('GuidePanel', () => {
  it('renders scenic info and submits quick questions', () => {
    const onAsk = vi.fn();

    render(
      <GuidePanel
        scenicArea={scenicArea}
        messages={[]}
        routeCards={[]}
        loading={false}
        error={null}
        onAsk={onAsk}
      />
    );

    expect(screen.getByRole('heading', { name: '云岚古镇' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '帮我规划一条半日游路线' }));

    expect(onAsk).toHaveBeenCalledWith('帮我规划一条半日游路线');
  });
});
