import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
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

  it('supports keyboard focus with the complete destination focus style', () => {
    const { container } = render(<HomeDestinationLinks />);
    const exhibitionLink = within(container).getByRole('link', { name: '3D 展馆' });

    exhibitionLink.focus();

    expect(exhibitionLink).toHaveFocus();

    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const focusRule = styles.match(
      /\.home-destination-links a:focus-visible\s*\{(?<declarations>[^}]*)\}/
    )?.groups?.declarations;

    expect(focusRule).toContain('border-color: rgba(255, 240, 168, 0.88);');
    expect(focusRule).toContain('background: #baf8dc;');
    expect(focusRule).toContain('color: #164a3b;');
    expect(focusRule).toContain('opacity: 1;');
  });

  it('shows destination links without requiring hover', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const baseRule = styles.match(/\.home-destination-link\s*\{(?<declarations>[^}]*)\}/)?.groups
      ?.declarations;

    expect(baseRule).toContain('opacity: 1;');
    expect(baseRule).toContain('border: 1px solid rgba(255, 240, 168, 0.88);');
    expect(baseRule).toContain('background: #baf8dc;');
    expect(baseRule).toContain('color: #164a3b;');
  });

  it('moves into the page grid below the title on narrow screens', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const narrowScreenRule = styles.match(
      /@media \(max-width: 760px\)\s*\{\s*\.home-destination-links\s*\{(?<declarations>[^}]*)\}/
    )?.groups?.declarations;

    expect(narrowScreenRule).toContain('position: static;');
    expect(narrowScreenRule).toContain('grid-column: 1;');
    expect(narrowScreenRule).toContain('width: 100%;');
    expect(narrowScreenRule).toContain('justify-content: flex-end;');
  });
});
