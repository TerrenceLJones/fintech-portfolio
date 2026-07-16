import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectionErrorBoundary } from './SectionErrorBoundary';

function Boom(): never {
  throw new Error('render exploded');
}

describe('SectionErrorBoundary', () => {
  it('catches a child render error and shows the scoped retry card, isolated from the app (AC-05)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <SectionErrorBoundary title="Top vendors">
        <Boom />
      </SectionErrorBoundary>,
    );
    expect(screen.getByText('Top vendors')).toBeInTheDocument();
    expect(screen.getByText("This section couldn't load.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });

  it('renders its children when they do not throw', () => {
    render(
      <SectionErrorBoundary title="Top vendors">
        <div>section content</div>
      </SectionErrorBoundary>,
    );
    expect(screen.getByText('section content')).toBeInTheDocument();
  });

  it('calls onReset when Retry is pressed so the caller can re-fetch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReset = vi.fn();
    render(
      <SectionErrorBoundary title="Top vendors" onReset={onReset}>
        <Boom />
      </SectionErrorBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
