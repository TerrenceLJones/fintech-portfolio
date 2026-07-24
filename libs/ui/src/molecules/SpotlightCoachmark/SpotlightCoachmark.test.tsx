import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpotlightCoachmark } from './SpotlightCoachmark';

function renderSpotlight(onDismiss = vi.fn()) {
  const anchorRef = createRef<HTMLButtonElement>();
  render(
    <div>
      <button ref={anchorRef}>New expense</button>
      <SpotlightCoachmark
        anchorRef={anchorRef}
        title="Start here"
        body="Log your first purchase and send it for approval."
        onDismiss={onDismiss}
      />
    </div>,
  );
  return { onDismiss };
}

describe('SpotlightCoachmark', () => {
  it('names the action with icon + text, carrying its meaning without colour alone (US-CW-046 AC-04)', () => {
    renderSpotlight();
    expect(screen.getByText('Start here')).toBeInTheDocument();
    expect(
      screen.getByText('Log your first purchase and send it for approval.'),
    ).toBeInTheDocument();
  });

  it('is an accessible dialog labelled by its title, and does not trap focus', () => {
    renderSpotlight();
    expect(screen.getByRole('dialog', { name: 'Start here' })).toBeInTheDocument();
  });

  it('dismisses on its close control (AC-02)', async () => {
    const { onDismiss } = renderSpotlight();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('dismisses on Escape (AC-04)', async () => {
    const { onDismiss } = renderSpotlight();
    await userEvent.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
