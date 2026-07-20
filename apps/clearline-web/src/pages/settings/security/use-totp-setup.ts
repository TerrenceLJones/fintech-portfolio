import { useState } from 'react';
import {
  VerifyTotpSetupError,
  useStartTotpSetup,
  useVerifyTotpSetup,
} from '@clearline/data-access-security';

/** The three phases of the design §19.2 TOTP flow: generate → verify → complete. */
export type TotpStep = 'generate' | 'verify' | 'complete';

/**
 * The generate → verify → complete controller for authenticator-app setup (US-CW-035 AC-03/04/05).
 * The repo models multi-phase flows as `use-*` hooks (see use-step-up-challenge), not XState machines
 * — this is that pattern. It cannot reach `complete` without a server-verified correct code (AC-05):
 * `verify` only advances on the mutation's success. The secret + otpauth URI come from the server once
 * (AC-03) and are rendered to a QR client-side; backup codes arrive at completion and are shown once.
 */
export function useTotpSetup() {
  const startSetup = useStartTotpSetup();
  const verifyMutation = useVerifyTotpSetup();
  const [step, setStep] = useState<TotpStep | null>(null); // null = the flow is closed
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  /** Open the flow and request a fresh secret (AC-03). */
  function begin() {
    setCode('');
    setVerifyError(null);
    setBackupCodes([]);
    setStep('generate');
    startSetup.mutate();
  }

  /** Advance from the QR to the code-entry step. */
  function toVerify() {
    setCode('');
    setVerifyError(null);
    setStep('verify');
  }

  /**
   * Submit a code; advances to `complete` only on a server-verified correct code (AC-04/05). Accepts an
   * explicit value so `OtpInput`'s `onComplete(fullCode)` can auto-submit without racing the `code`
   * state update (which lags a render behind the final keystroke).
   */
  function verify(codeOverride?: string) {
    const submitted = codeOverride ?? code;
    setVerifyError(null);
    verifyMutation.mutate(submitted, {
      onSuccess: (result) => {
        setBackupCodes(result.backupCodes);
        setStep('complete');
      },
      onError: (error) => {
        setCode('');
        setVerifyError(
          error instanceof VerifyTotpSetupError && error.code === 'incorrect_code'
            ? 'Incorrect code — check your authenticator app and try again.'
            : 'Something went wrong. Please try again.',
        );
      },
    });
  }

  /** Close the flow and reset the underlying mutations. */
  function close() {
    setStep(null);
    startSetup.reset();
    verifyMutation.reset();
  }

  return {
    step,
    secret: startSetup.data?.secret ?? null,
    otpauthUri: startSetup.data?.otpauthUri ?? null,
    isStarting: startSetup.isPending,
    isVerifying: verifyMutation.isPending,
    code,
    setCode,
    verify,
    verifyError,
    backupCodes,
    begin,
    toVerify,
    close,
  };
}

export type TotpSetupController = ReturnType<typeof useTotpSetup>;
