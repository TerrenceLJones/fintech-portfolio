import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvatarCropDialog } from './AvatarCropDialog';

const SRC = 'data:image/png;base64,AAAA';

describe('AvatarCropDialog (AC-05)', () => {
  it('renders the crop UI with a zoom control when open', () => {
    render(<AvatarCropDialog open src={SRC} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Crop your photo' })).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom')).toBeInTheDocument();
    expect(screen.getByAltText('Avatar preview')).toHaveAttribute('src', SRC);
  });

  it('confirms with a cropped image (falling back to the source when canvas is unavailable)', async () => {
    const onConfirm = vi.fn();
    render(<AvatarCropDialog open src={SRC} onConfirm={onConfirm} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save photo' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(typeof onConfirm.mock.calls[0]?.[0]).toBe('string');
  });

  it('cancels without confirming', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<AvatarCropDialog open src={SRC} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
