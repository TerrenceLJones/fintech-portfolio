import type { DemoBeaconPageConfig, EntityRow } from '@clearline/demo-beacon';
import { REGISTRY_EINS, DEMO_ONBOARDED_BUSINESS } from '@clearline/mock-backend/fixtures';

const einRows: EntityRow[] = [...REGISTRY_EINS].map((ein) => ({ ein }));

export const businessInfoBeacon: DemoBeaconPageConfig = {
  pageId: 'onboarding.business',
  title: 'KYB — business info',
  summary: 'Only a handful of EINs pass the mock business registry.',
  sections: [
    {
      kind: 'entities',
      title: 'Registrable EINs',
      columns: [{ key: 'ein', label: 'EIN' }],
      rows: einRows,
      rowActions: (row) => [{ label: 'Copy', copy: String(row.ein) }],
    },
    {
      kind: 'text',
      title: 'Edge cases',
      body: `Any EIN outside that set fails verification. Legal name **Vostok Trading** or **Northgate Holdings** routes to manual review. EIN \`${DEMO_ONBOARDED_BUSINESS.ein}\` is already claimed by the demo business → duplicate detection.`,
    },
  ],
};

export const beneficialOwnersBeacon: DemoBeaconPageConfig = {
  pageId: 'onboarding.owners',
  title: 'KYB — beneficial owners',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'owners',
          title: 'Add owners',
          steps: [
            { text: 'Add at least one owner with **≥25%** ownership.' },
            { text: 'Total ownership across owners can’t exceed 100%.' },
            { text: 'Continue to the document step.', navigateTo: '/onboarding/documents' },
          ],
        },
      ],
    },
  ],
};

export const documentUploadBeacon: DemoBeaconPageConfig = {
  pageId: 'onboarding.documents',
  title: 'KYB — documents',
  summary:
    'The OCR vendor is mocked: it “reads” the uploaded file’s **name**, not its pixels — so the file has to be *named* like the document. Any image works as long as its name matches.',
  sections: [
    {
      kind: 'text',
      title: 'What the mock OCR accepts',
      body: 'The file name (case-insensitive, punctuation ignored) must contain `driver` + `licen` → driver’s license, `passport` → passport, or `state id` / `identification card` → state ID. Anything else is rejected as “not a valid ID.”',
    },
    {
      kind: 'copyable',
      title: 'Example file names',
      items: [
        { label: "Driver's license", value: 'drivers-license.png' },
        { label: 'Passport', value: 'passport.png' },
        { label: 'State ID', value: 'state-id.png' },
      ],
    },
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'docs',
          title: 'Upload a document',
          steps: [
            { text: 'Rename any image to one of the names above, then upload it — it’s accepted.' },
            { text: 'Upload an image with any other name to see the “not a valid ID” rejection.' },
            { text: 'Three rejected uploads push the account into a “documents blocked” state.' },
          ],
        },
      ],
    },
  ],
};

export const reviewStepBeacon: DemoBeaconPageConfig = {
  pageId: 'onboarding.review',
  title: 'KYB — review & submit',
  sections: [
    {
      kind: 'flows',
      title: 'Try this',
      flows: [
        {
          id: 'review',
          title: 'Submit for review',
          steps: [
            { text: 'Review the collected info, then submit.' },
            {
              text: 'Submission moves you to the status page under review.',
              navigateTo: '/onboarding/status',
            },
          ],
        },
      ],
    },
  ],
};

export const onboardingStatusBeacon: DemoBeaconPageConfig = {
  pageId: 'onboarding.status',
  title: 'KYB — status',
  sections: [
    {
      kind: 'text',
      title: 'What you’re seeing',
      body: 'The neutral holding page shown while a submitted business is under review. Approved accounts are redirected to the dashboard; blocked ones stay here.',
    },
  ],
};
