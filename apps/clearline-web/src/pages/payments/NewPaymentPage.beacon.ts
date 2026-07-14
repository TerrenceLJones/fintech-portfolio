import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import {
  SEED_RECIPIENTS,
  SEED_SOURCE_ACCOUNT,
  STEP_UP_OTP_EXPIRED,
  STEP_UP_OTP_VALID,
  STEP_UP_THRESHOLD_MINOR_UNITS,
} from '@clearline/mock-backend/fixtures';
import { money } from '../../dev/beacon/shared';

const stepUpThreshold = money({ amountMinorUnits: STEP_UP_THRESHOLD_MINOR_UNITS, currency: 'USD' });

/** The full account number behind a seed recipient — the page only ever shows the masked form. */
const acctOf = (id: string) => SEED_RECIPIENTS.find((r) => r.id === id)?.accountNumber ?? '';

// The mock resolves a hand-entered recipient by account number alone (routing is collected but not
// matched), so any routing number works and the account number decides the outcome.
const SAMPLE_ROUTING = '021000021';
// Not present in SEED_RECIPIENTS, so it fails resolution → "recipient not found".
const UNKNOWN_ACCOUNT = '000555123';

/**
 * New-payment guide. The recipient cards are already on the page, so instead of re-listing them the
 * Beacon surfaces what the page hides — the full account/routing numbers needed to hand-enter a
 * recipient via “Recipient not listed?”, and which account resolves vs. fails.
 */
export const newPaymentBeacon: DemoBeaconPageConfig = {
  pageId: 'payments.new',
  title: 'New payment',
  summary:
    'Pick a recipient from the list on the page, or add one by hand with the account details below.',
  sections: [
    {
      // The data the page doesn't expose: full account numbers (page shows only ••NNNN) + a routing
      // number, so a tester can drive the "Recipient not listed? Enter account details" form.
      kind: 'copyable',
      title: 'Add a recipient by hand',
      items: [
        {
          label: 'Routing #',
          value: SAMPLE_ROUTING,
          hint: 'Any routing number works — the mock matches on account number only.',
        },
        {
          label: 'Unknown acct',
          value: UNKNOWN_ACCOUNT,
          hint: 'Not on file → “recipient not found” (US-CW-008 AC-03).',
        },
        {
          label: 'Acme acct',
          value: acctOf('rec_acme'),
          hint: 'Resolves to Acme Corp — a clean payment.',
        },
        {
          label: 'Shadow acct',
          value: acctOf('rec_shadow'),
          hint: 'Resolves to Shadow Holdings → compliance hold (“Pending review”).',
        },
      ],
    },
    {
      // The demo OTP codes the page (and a real SMS) would never expose, so a tester can drive the
      // step-up challenge deterministically (US-CW-010).
      kind: 'copyable',
      title: 'Step-up (3DS) test codes',
      items: [
        {
          label: 'Valid OTP',
          value: STEP_UP_OTP_VALID,
          hint: `Verifies the challenge and sends the payment. Triggered above ${stepUpThreshold}.`,
        },
        {
          label: 'Expired OTP',
          value: STEP_UP_OTP_EXPIRED,
          hint: '“That code expired. We’ve sent a new one.” — old code invalidated server-side (AC-06).',
        },
        {
          label: 'Wrong OTP',
          value: '111111',
          hint: 'Any other 6 digits → “We couldn’t verify your identity.” (AC-04).',
        },
      ],
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'happy',
          title: 'Send a clean payment (happy path)',
          steps: [
            { text: 'Click **Acme Corp** in the recipient list.' },
            { text: 'Enter amount **$5,000** — under balance and daily limit.' },
            { text: 'Review the summary, then Send — it moves to the status page.' },
          ],
        },
        {
          id: 'step-up',
          title: 'Trigger step-up authentication',
          steps: [
            { text: 'Click **Acme Corp**, then enter **$12,000** — above the step-up threshold.' },
            { text: 'Review & send, confirm — a “Verify it’s you” challenge appears.' },
            {
              text: `Enter the **Valid OTP** (${STEP_UP_OTP_VALID}) to finish, or the **Expired** / **Wrong** codes above to see recovery.`,
            },
            {
              text: 'Or **close the challenge** → return banner + Retry, with the same key preserved.',
            },
          ],
        },
        {
          id: 'manual',
          title: 'Add a recipient by hand',
          steps: [
            { text: 'Click **“Recipient not listed? Enter account details”**.' },
            {
              text: 'Copy the **Routing #** and **Unknown acct** above → Review → “recipient not found”.',
            },
            {
              text: 'Swap in **Acme acct** to see a hand-entered number resolve to a known payee.',
            },
          ],
        },
      ],
    },
    {
      kind: 'text',
      title: 'Recipient behaviors',
      body: 'From the card list: **Globex** (EUR) → cross-currency FX panel. **Shadow** → compliance hold. **Vertex** (closed) and **Operating** (your own account) → blocked.',
    },
    {
      kind: 'text',
      title: 'Amount blocks',
      body: `Daily limit is **${money(SEED_SOURCE_ACCOUNT.dailyLimit)}** (spent $0 so far) — enter more than that to trip the daily-limit block, or more than the available balance to trip insufficient funds (US-CW-008 AC-01/AC-02).`,
    },
  ],
};
