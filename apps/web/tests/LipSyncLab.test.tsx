import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LipSyncLab } from '../src/lab/lip-sync/LipSyncLab';

describe('LipSyncLab', () => {
  it('renders the lab heading', () => {
    render(<LipSyncLab />);

    expect(screen.getByRole('heading', { name: '口型与性能实验室' })).toBeInTheDocument();
  });
});
