import type { DemoBeaconPageConfig } from '@clearline/demo-beacon';
import { DEMO_SYNC_RECORD_COUNT } from '@clearline/mock-backend/fixtures';
import { resetSection } from '../../dev/beacon/global.beacon';

/**
 * Integrations demo guide (US-CW-039). Registered by IntegrationsPage so it overrides the layout-level
 * settings guide while mounted. It walks the OAuth connect flow, the GL mapping (one category starts
 * unmapped so the amber flag + Partial sync are visible), Sync now, the seeded error → Reconnect path,
 * and the mapping-preserving disconnect. Organization-group: only a Controller/Admin/Owner sees it (AC-09).
 */
export const integrationsBeacon: DemoBeaconPageConfig = {
  pageId: 'settings.integrations',
  title: 'Integrations',
  summary:
    'Connect **QuickBooks / Xero / NetSuite** via a mocked OAuth flow, map expense categories to GL ' +
    'accounts, run and audit syncs (with clear failures), and disconnect safely — mappings are kept.',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'connect',
          title: 'Connect via OAuth',
          steps: [
            {
              text: 'On the **Xero** card (Disconnected), click **Connect**, then **Authorize** — it returns Connected (AC-01). Cancelling leaves it Disconnected.',
            },
          ],
        },
        {
          id: 'map-and-sync',
          title: 'Map GL codes & sync',
          steps: [
            {
              text: 'On **QuickBooks**, open **Configure GL mapping** — **Equipment** starts **Not mapped** (amber). Map it, then **Save** (AC-02).',
            },
            {
              text: `Click **Sync now** — a fully-mapped sync reports **Sync complete — ${DEMO_SYNC_RECORD_COUNT} transactions exported**; leave one unmapped to see a **Partial** run in **View sync log** (AC-03/05).`,
            },
          ],
        },
        {
          id: 'error-reconnect',
          title: 'Reconnect & disconnect',
          steps: [
            {
              text: 'The **NetSuite** card shows an **Error** badge with **Reconnect** — click it to restore auto-sync (AC-04).',
            },
            {
              text: '**Disconnect** any provider — the confirmation names it and notes your GL mappings are preserved for reconnect (AC-06).',
            },
          ],
        },
      ],
    },
    resetSection,
  ],
};
