import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomeDestinationLinks } from '../src/components/HomeDestinationLinks';

describe('HomeDestinationLinks', () => {
  it('renders direct links to the exhibition and video center', () => {
    render(<HomeDestinationLinks />);

    expect(screen.getByRole('link', { name: '3D 展馆' })).toHaveAttribute('href', '/exhibition');
    expect(screen.getByRole('link', { name: '视频中心' })).toHaveAttribute('href', '/videos');
  });

  it('keeps the destination icons decorative for screen readers', () => {
    const { container } = render(<HomeDestinationLinks />);
    const icons = container.querySelectorAll<SVGElement>('[data-testid="destination-icon"]');

    expect(icons).toHaveLength(2);
    icons.forEach((icon) => expect(icon).toHaveAttribute('aria-hidden', 'true'));
  });
});
