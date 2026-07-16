import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { loadControls } from '../../dev/beacon/shared';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Card-detail guide, parameterised by the card being viewed. The live feed and declines are
 * server-scripted events with no real card network behind them, so the Beacon exposes them as
 * on-demand actions: stream an approved charge (AC-02), stage each of the three declines (AC-03/04/07),
 * and drop the WebSocket to see the reconnect/backoff (AC-06). Each action drives a DEV-gated control
 * on the mock backend, so nothing here ships to production.
 */
export function cardDetailBeacon(cardId: string): DemoBeaconPageConfig {
  return {
    pageId: 'cards.detail',
    title: 'Card detail · live feed',
    summary:
      'The remaining limit is **derived** from a real-time WebSocket feed — never stored. Use the actions below to stream authorizations and declines onto this card and watch the feed react.',
    sections: [
      {
        kind: 'actions',
        title: 'Stream activity',
        actions: [
          {
            id: 'charge',
            label: 'Stream an approved charge ($150 · Notion)',
            description:
              'An in-policy Software charge — it approves and the derived remaining limit moves (AC-02).',
            run: async () => {
              const { simulateCardChargeForE2E } = await loadControls();
              simulateCardChargeForE2E(cardId);
            },
          },
          {
            id: 'decline-mcc',
            label: 'Stream an MCC decline (Vista Grill · Restaurants)',
            description:
              'A restaurant charge on a Software/Office-only card — declined “MCC restricted” (AC-03).',
            run: async () => {
              const { simulateCardDeclineForE2E } = await loadControls();
              simulateCardDeclineForE2E(cardId, 'mcc');
            },
          },
          {
            id: 'decline-limit',
            label: 'Stream an over-limit decline (GitHub)',
            description:
              'A charge above the remaining derived limit — declined “insufficient limit” (AC-04).',
            run: async () => {
              const { simulateCardDeclineForE2E } = await loadControls();
              simulateCardDeclineForE2E(cardId, 'limit');
            },
          },
          {
            id: 'decline-security',
            label: 'Stream a security-gated decline (lost/stolen)',
            description:
              'The card is flagged lost/stolen — the cardholder sees only the generic message; the true reason is never shown (AC-07).',
            run: async () => {
              const { simulateCardDeclineForE2E } = await loadControls();
              simulateCardDeclineForE2E(cardId, 'security');
            },
          },
          {
            id: 'drop-feed',
            label: 'Drop the WebSocket',
            description:
              'Force-closes the feed socket so you see the “Reconnecting…” banner and exponential backoff (AC-06).',
            run: async () => {
              const { simulateCardFeedDropForE2E } = await loadControls();
              simulateCardFeedDropForE2E(cardId);
            },
          },
        ],
      },
      {
        kind: 'flows',
        title: 'Try this',
        flows: [
          {
            id: 'freeze',
            title: 'Freeze the card',
            steps: [
              { text: 'Click **Freeze card** — the card immediately stops authorizing.' },
              {
                text: 'Now **Stream an approved charge** — it’s declined because the freeze takes effect at the authorization layer, not just in the UI (AC-05).',
              },
              {
                text: 'The frozen state reads through a snowflake **glyph + “Frozen” label**, never colour alone.',
              },
            ],
          },
        ],
      },
      {
        kind: 'text',
        title: 'Why declines stay neutral',
        body: 'Whether a decline is lost, stolen, or fraud, the cardholder sees the **same** generic message — revealing the specific reason would tip off a bad actor. Support and risk see the true reason server-side (US-CW-014 AC-07).',
      },
      resetSection,
    ],
  };
}
