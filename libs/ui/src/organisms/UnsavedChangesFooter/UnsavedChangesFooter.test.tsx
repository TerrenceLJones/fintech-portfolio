import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnsavedChangesFooter } from './UnsavedChangesFooter';

describe('UnsavedChangesFooter (AC-02)', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <UnsavedChangesFooter visible={false} onSave={() => {}} onDiscard={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Save/Discard and fires their handlers when visible', async () => {
    const onSave = vi.fn();
    const onDiscard = vi.fn();
    render(<UnsavedChangesFooter visible onSave={onSave} onDiscard={onDiscard} />);

    expect(screen.getByRole('region', { name: 'Unsaved changes' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('blocks the actions while saving', async () => {
    const onDiscard = vi.fn();
    render(<UnsavedChangesFooter visible saving onSave={() => {}} onDiscard={onDiscard} />);
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onDiscard).not.toHaveBeenCalled();
  });
});
