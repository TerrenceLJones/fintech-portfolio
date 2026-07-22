import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import {
  DEMO_CURRENT_IP,
  DEMO_SSO_CERTIFICATE,
  DEMO_SSO_ENTITY_ID,
  DEMO_SSO_METADATA_URL,
} from '@clearline/mock-backend/fixtures';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Security & Compliance demo guide (US-CW-040). Registered by SecurityCompliancePage so it overrides the
 * layout-level settings guide while mounted. It walks the SSO connection-test gate, org-wide 2FA
 * enforcement, the idle-timeout change, and the IP-allowlist self-lockout guard. Admin/Owner-only: a
 * bare Controller or Employee never sees this section (AC-09).
 */
export const securityComplianceBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.security-compliance',
  title: 'Security & Compliance',
  summary:
    'Configure **SSO/SAML**, org-wide **required 2FA**, the **idle session timeout**, and an **IP ' +
    'allowlist** — every high-impact control is confirmed and guarded against locking you out.',
  sections: [
    {
      kind: 'copyable',
      title: 'A demo SSO config that passes the test',
      items: [
        { label: 'Metadata URL', value: DEMO_SSO_METADATA_URL },
        { label: 'Entity ID', value: DEMO_SSO_ENTITY_ID },
        { label: 'Certificate (PEM)', value: DEMO_SSO_CERTIFICATE },
      ],
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'sso',
          title: 'Configure & enable SSO',
          steps: [
            {
              text: 'Paste the demo config above and click **Test connection** — it reports **Connection successful** (AC-01). An `http://` metadata URL or a non-PEM certificate fails with a specific reason.',
            },
            {
              text: 'Only after a passing test can you toggle **Enabled** — the confirmation spells out that password login is disabled for all but emergency admins (AC-02).',
            },
          ],
        },
        {
          id: 'twofa',
          title: 'Require 2FA org-wide',
          steps: [
            {
              text: 'Toggle **Require 2FA for all members** — the confirmation explains unenrolled members are gated into setup on their next login (AC-03). Log out and back in as a member without 2FA to hit the setup gate (AC-04).',
            },
          ],
        },
        {
          id: 'timeout-ip',
          title: 'Idle timeout & IP allowlist',
          steps: [
            {
              text: 'Change **Idle session timeout** to **1 hour** and **Save** — every member’s inactivity auto-logoff now uses it (AC-05).',
            },
            {
              text: `Add \`198.51.100.0/24\` — it’s blocked because it would exclude your current IP (**${DEMO_CURRENT_IP}**) (AC-07). Add \`203.0.113.0/24\` instead — it covers you and saves (AC-06). **Test my current IP** confirms it, and **Remove** asks before clearing it (AC-08).`,
            },
          ],
        },
      ],
    },
    resetSection,
  ],
};
