import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RootApp } from '../src/RootApp';

vi.mock('../src/App', () => ({
  App: () => <div>guide-app</div>
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
    expect(screen.queryByText('guide-app')).not.toBeInTheDocument();
  });

  it.each(['/', '/lab/lip-sync/', '/anything'])('renders the guide for %s', (pathname) => {
    window.history.pushState({}, '', pathname);

    render(<RootApp />);

    expect(screen.getByText('guide-app')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '口型与性能实验室' })).not.toBeInTheDocument();
  });
});
