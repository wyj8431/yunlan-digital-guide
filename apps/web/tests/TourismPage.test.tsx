import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourismPage } from '../src/components/TourismPage';
import type { ScenicAreaSummary } from '../src/types/guide';

const scenicArea: ScenicAreaSummary = {
  scenicArea: {
    id: 'wuzhen',
    name: '乌镇景区',
    description: '江南水乡古镇',
    openingHours: '09:00-21:00',
    ticketInfo: '成人票 150 元',
    location: '浙江省嘉兴市桐乡市'
  },
  spots: [{ id: 'west-gate', name: '西栅', summary: '适合夜游的水乡街区' }],
  routes: [{ id: 'route-1', name: '西栅半日游', duration: '4 小时', description: '沿河漫游' }],
  services: [{ id: 'boat', name: '摇橹船', type: '交通', description: '水上游览' }],
  quickQuestions: ['乌镇怎么玩？']
};

afterEach(cleanup);

describe('TourismPage', () => {
  it('renders the map as a dedicated page instead of an Explore overlay', () => {
    const onNavigate = vi.fn();
    const onAsk = vi.fn();

    const { container } = render(
      <TourismPage
        view="map"
        scenicArea={scenicArea}
        routeCards={[]}
        latestAnswer=""
        voice={{ status: 'idle', transcript: '', error: null }}
        onNavigate={onNavigate}
        onAsk={onAsk}
        onToggleVoice={vi.fn()}
      />
    );

    expect(container.querySelector('main[data-tourism-page="map"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '活体运河地图' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回探索' })).toBeInTheDocument();
    expect(container.querySelector('.holo-view-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /西栅/ }));

    expect(onAsk).toHaveBeenCalledWith('介绍一下西栅，并推荐附近游玩路线。');
    expect(onNavigate).toHaveBeenCalledWith('explore');
  });

  it('turns the home page into a departure observatory with actionable trip modes', () => {
    render(
      <TourismPage
        view="home"
        scenicArea={scenicArea}
        routeCards={[]}
        latestAnswer=""
        voice={{ status: 'idle', transcript: '', error: null }}
        onNavigate={vi.fn()}
        onAsk={vi.fn()}
        onToggleVoice={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: '今天，从水上醒来' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /半日漫游/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /夜游西栅/ })).toBeInTheDocument();
    expect(screen.getByText('出发前请核验官方票务与当日开放信息')).toBeInTheDocument();
  });

  it('offers complete tourism decision prompts on the guide page', () => {
    const onAsk = vi.fn();
    const onNavigate = vi.fn();

    render(
      <TourismPage
        view="guide"
        scenicArea={scenicArea}
        routeCards={[]}
        latestAnswer=""
        voice={{ status: 'idle', transcript: '', error: null }}
        onNavigate={onNavigate}
        onAsk={onAsk}
        onToggleVoice={vi.fn()}
      />
    );

    expect(screen.getByText('全球景区都可以问')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /住东栅还是西栅/ }));

    expect(onAsk).toHaveBeenCalledWith('住东栅还是西栅更方便？请比较住宿体验和交通。');
    expect(onNavigate).toHaveBeenCalledWith('explore');
  });

  it('switches map travel layers without leaving the map page', () => {
    const onNavigate = vi.fn();

    render(
      <TourismPage
        view="map"
        scenicArea={scenicArea}
        routeCards={[]}
        latestAnswer=""
        voice={{ status: 'idle', transcript: '', error: null }}
        onNavigate={onNavigate}
        onAsk={vi.fn()}
        onToggleVoice={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '摇橹船图层' }));

    expect(screen.getByText(/优先连接码头与临水景点/)).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('keeps voice interaction on the voice page so recognition state remains visible', () => {
    const onNavigate = vi.fn();
    const onToggleVoice = vi.fn();

    render(
      <TourismPage
        view="voice"
        scenicArea={scenicArea}
        routeCards={[]}
        latestAnswer=""
        voice={{ status: 'idle', transcript: '', error: null }}
        onNavigate={onNavigate}
        onAsk={vi.fn()}
        onToggleVoice={onToggleVoice}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '开始语音提问' }));

    expect(onToggleVoice).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByText('你可以这样问')).toBeInTheDocument();
  });

  it('presents narration chapters and a session-based travel passport', () => {
    const { rerender } = render(
      <TourismPage
        view="narration"
        scenicArea={scenicArea}
        routeCards={[]}
        latestAnswer=""
        voice={{ status: 'idle', transcript: '', error: null }}
        onNavigate={vi.fn()}
        onAsk={vi.fn()}
        onToggleVoice={vi.fn()}
      />
    );

    expect(screen.getByText('水路形成')).toBeInTheDocument();
    expect(screen.getByText('商贸生活')).toBeInTheDocument();
    expect(screen.getByText('当代夜游')).toBeInTheDocument();

    rerender(
      <TourismPage
        view="profile"
        scenicArea={scenicArea}
        routeCards={[]}
        latestAnswer=""
        voice={{ status: 'idle', transcript: '', error: null }}
        onNavigate={vi.fn()}
        onAsk={vi.fn()}
        onToggleVoice={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: '本次乌镇旅程' })).toBeInTheDocument();
    expect(screen.getByText('出发准备')).toBeInTheDocument();
    expect(screen.getByText('官方信息')).toBeInTheDocument();
  });
});
