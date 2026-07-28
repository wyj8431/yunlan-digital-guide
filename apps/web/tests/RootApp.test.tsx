import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RootApp } from '../src/RootApp';
import type { TourismView } from '../src/routing/appRoute';

vi.mock('../src/App', () => ({
  App: ({
    activeView,
    onNavigate
  }: {
    activeView: TourismView;
    onNavigate: (view: TourismView) => void;
  }) => (
    <div>
      <span>guide-app-{activeView}</span>
      <button type="button" onClick={() => onNavigate('map')}>
        go-map
      </button>
    </div>
  )
}));

vi.mock('../src/lab/lip-sync/components/LipSyncStage', () => ({
  LipSyncStage: () => <section aria-label="本地 3D 数字人口型预览" />
}));

describe('RootApp', () => {
  afterEach(() => {
    cleanup();
    window.history.pushState({}, '', '/');
  });

  it('renders the lip sync lab for the exact lab route', () => {
    window.history.pushState({}, '', '/lab/lip-sync');

    render(<RootApp />);

    expect(screen.getByRole('heading', { name: '口型与性能实验室' })).toBeInTheDocument();
    expect(screen.queryByText(/guide-app-/)).not.toBeInTheDocument();
  });

  it.each([
    ['/', 'explore'],
    ['/home', 'home'],
    ['/guide', 'guide'],
    ['/itinerary', 'itinerary'],
    ['/history', 'history'],
    ['/profile', 'profile']
  ])('renders the %s tourism route as %s', (pathname, view) => {
    window.history.pushState({}, '', pathname);

    render(<RootApp />);

    expect(screen.getByText(`guide-app-${view}`)).toBeInTheDocument();
  });

  it('pushes a new URL when the app requests navigation', () => {
    window.history.pushState({}, '', '/');
    render(<RootApp />);

    fireEvent.click(screen.getByRole('button', { name: 'go-map' }));

    expect(window.location.pathname).toBe('/map');
    expect(screen.getByText('guide-app-map')).toBeInTheDocument();
  });

  it('updates the rendered page when browser history changes', () => {
    window.history.pushState({}, '', '/home');
    render(<RootApp />);

    act(() => {
      window.history.pushState({}, '', '/profile');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByText('guide-app-profile')).toBeInTheDocument();
  });
});
