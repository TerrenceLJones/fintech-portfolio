import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import {
  DEMO_API_KEY_PLAINTEXT,
  DEMO_WEBHOOK_SIGNING_SECRET,
} from '@clearline/mock-backend/fixtures';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Demo guide for Settings → Developer (US-CW-041). Overrides the layout-level settings beacon while the
 * Developer page is mounted. Admin/Owner-only surface (developer:manage) — an Employee or bare
 * Controller never sees the nav item or the page. The copyable seed values let a tester exercise scope
 * enforcement against the demo read-only key.
 */
export const developerBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.developer',
  title: 'Developer',
  summary:
    'Issue **scope-limited API keys** revealed once at creation and masked thereafter, revoke them, ' +
    'register **HTTPS webhook** endpoints with a once-shown signing secret, watch deliveries succeed ' +
    'or fail, resend failures, and copy an **HMAC-SHA256** verification snippet.',
  sections: [
    {
      kind: 'copyable',
      title: 'Seeded demo secrets',
      items: [
        {
          label: 'Demo API key (read-only)',
          value: DEMO_API_KEY_PLAINTEXT,
          hint: 'Scopes read:transactions + read:cards — a write:transfers request is refused by name.',
        },
        {
          label: 'Demo webhook signing secret',
          value: DEMO_WEBHOOK_SIGNING_SECRET,
          hint: 'Used with the HMAC-SHA256 snippet to verify a Clearline-Signature header.',
        },
      ],
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'create-reveal',
          title: 'Create a key & reveal it once',
          steps: [
            {
              text: 'Click **Create new key**, name it, pick scopes, and **Create** — the full key is shown once with a copy button and a bold "only time you\'ll see this" warning (AC-01).',
            },
            {
              text: 'Dismiss the modal — the key now shows only masked as `sk_live_••••••••••••••ab3f`, with no reveal-again control anywhere (AC-02).',
            },
          ],
        },
        {
          id: 'revoke',
          title: 'Revoke a key',
          steps: [
            {
              text: 'Click **Revoke** on a key — the confirmation names it and states that systems using it start receiving 401 errors immediately. On confirm it leaves the active list (AC-04).',
            },
            {
              text: 'Expand **Using your API key** to see the 403 (missing scope, named) and 401 (revoked) response shapes the API returns (AC-03/04).',
            },
          ],
        },
        {
          id: 'webhooks',
          title: 'Add a webhook & handle a failure',
          steps: [
            {
              text: 'Click **Add endpoint** — an `http://` URL is blocked inline with "Webhook endpoints must use HTTPS." (AC-07). A valid `https://` URL + events saves and reveals the signing secret once (AC-06).',
            },
            {
              text: "The seeded endpoint's delivery log has a red **503** row (glyph + number, not colour alone) with **Resend** and the retry schedule; **Resend** appends a new attempt (AC-08/09).",
            },
            {
              text: 'Expand **Verify the Clearline-Signature header** for the copy-paste HMAC-SHA256 snippet (AC-09).',
            },
          ],
        },
      ],
    },
    resetSection,
  ],
};
