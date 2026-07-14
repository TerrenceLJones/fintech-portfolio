import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepUpChallengeModal } from './StepUpChallengeModal';
import type { StepUpChallengeController } from './use-step-up-challenge';

function controller(overrides: Partial<StepUpChallengeController> = {}): StepUpChallengeController {
  return {
    intentId: 'pi_1',
    destinationMasked: '•••-•••-4417',
    method: 'otp_sms',
    code: '',
    changeCode: vi.fn(),
    submit: vi.fn(),
    onComplete: vi.fn(),
    requestResend: vi.fn(),
    errorKind: null,
    isVerifying: false,
    isResending: false,
    resendReady: false,
    secondsToResend: 24,
    otpLength: 6,
    ...overrides,
  };
}

function renderModal(ctrl: StepUpChallengeController, onOpenChange = vi.fn()) {
  return render(<StepUpChallengeModal open onOpenChange={onOpenChange} controller={ctrl} />);
}

describe('StepUpChallengeModal', () => {
  it('shows the OTP entry with the masked destination and the resend countdown', () => {
    renderModal(controller());
    expect(screen.getByRole('heading', { name: /verify it's you/i })).toBeInTheDocument();
    expect(screen.getByText(/code sent to •••-•••-4417/i)).toBeInTheDocument();
    expect(screen.getByText('Resend in 0:24')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
  });

  it('gives the title an explicit text color so it stays readable in the portal (a11y)', () => {
    // The modal renders in a Radix portal outside the themed subtree, so a title with no color class
    // would inherit dark-on-dark. It must carry text-cl-text.
    renderModal(controller());
    expect(screen.getByRole('heading', { name: /verify it's you/i })).toHaveClass('text-cl-text');
  });

  it('shows the wrong-code message and flags the cells invalid (AC-04)', () => {
    renderModal(controller({ errorKind: 'incorrect', code: '301298' }));
    expect(
      screen.getByText(
        "We couldn't verify your identity. Try again or use a different verification method.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')[0]).toHaveAttribute('aria-invalid', 'true');
    // The alternative method is offered immediately, without waiting out the timer.
    expect(screen.getByRole('button', { name: /use a different method/i })).toBeInTheDocument();
  });

  it('shows the expiry notice distinctly from a wrong code (AC-06)', () => {
    renderModal(controller({ errorKind: 'expired' }));
    expect(screen.getByText("That code expired. We've sent a new one.")).toBeInTheDocument();
    // Not the auth-failure copy.
    expect(screen.queryByText(/couldn't verify your identity/i)).not.toBeInTheDocument();
  });

  it('renders a distinct connection-lost recovery, not an auth failure (AC-07)', () => {
    renderModal(controller({ errorKind: 'network' }));
    expect(screen.getByRole('heading', { name: /connection lost/i })).toBeInTheDocument();
    expect(
      screen.getByText('We lost connection during verification. Try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/couldn't verify your identity/i)).not.toBeInTheDocument();
  });

  it('activates Resend and "Try another method" once the timer elapses (AC-05)', async () => {
    const requestResend = vi.fn();
    const user = userEvent.setup();
    renderModal(controller({ resendReady: true, requestResend }));

    expect(screen.queryByText(/resend in/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /didn't get the code\? resend/i }));
    expect(requestResend).toHaveBeenCalledWith();

    await user.click(screen.getByRole('button', { name: /try another method/i }));
    // Switches channel away from the current SMS method.
    expect(requestResend).toHaveBeenLastCalledWith('otp_email');
  });

  it('treats closing the modal as an abandonment signal', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderModal(controller(), onOpenChange);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
