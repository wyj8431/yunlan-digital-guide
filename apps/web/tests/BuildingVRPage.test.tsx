import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuildingVRPage, BUILDING_VR_DATA } from '../src/components/BuildingVRPage';

vi.mock('../src/hooks/useSpeechSynthesis', () => ({
  useSpeechSynthesis: () => ({ supported: true, speaking: false, speak: vi.fn(), stop: vi.fn() })
}));

afterEach(cleanup);

describe('BuildingVRPage', () => {
  it('restores five building views with fifteen unique Wuzhen panoramas', () => {
    const buildings = Object.values(BUILDING_VR_DATA);
    const panoramaIds = buildings.flatMap((building) => building.hotspots.map((hotspot) => hotspot.panoramaId));
    expect(buildings).toHaveLength(5);
    expect(panoramaIds).toHaveLength(15);
    expect(new Set(panoramaIds).size).toBe(15);
    expect(panoramaIds.every((id) => id.includes('wuzhen') || id.includes('jiaxing'))).toBe(true);
  });

  it('renders the real panorama route surface', () => {
    render(<BuildingVRPage spotId="xizha-street" onReturnMap={vi.fn()} />);
    expect(screen.getByRole('main')).toHaveClass('building-vr-page--xizha');
    expect(screen.getByLabelText(/real 360 panorama/)).toHaveAttribute('data-panorama-source', 'verified-real-panorama');
    expect(screen.getByLabelText(/real 360 panorama/)).toHaveAttribute('data-panorama-url', expect.stringContaining('/api/panoramas/'));
    expect(document.querySelectorAll('.building-vr-scene-arrow')).toHaveLength(3);
    expect(screen.getByLabelText(/real 360 panorama/)).toHaveAttribute('data-panorama-fallback', '/images/wuzhen-real/aerial-2023.jpg');
  });
});
