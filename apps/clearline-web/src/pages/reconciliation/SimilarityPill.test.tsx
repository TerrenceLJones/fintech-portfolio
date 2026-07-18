import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimilarityPill } from './SimilarityPill';

describe('SimilarityPill', () => {
  it('spells out the score and label in text (never color alone) — WCAG AC-01', () => {
    render(<SimilarityPill percent={92} />);
    expect(screen.getByText(/92%/)).toBeInTheDocument();
    expect(screen.getByText(/match/)).toBeInTheDocument();
  });

  it('pairs the score with an icon so the fuzzy-match cue is not carried by color alone', () => {
    const { container } = render(<SimilarityPill percent={92} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('honours a custom label', () => {
    render(<SimilarityPill percent={80} label="similarity" />);
    expect(screen.getByText(/similarity/)).toBeInTheDocument();
  });
});
