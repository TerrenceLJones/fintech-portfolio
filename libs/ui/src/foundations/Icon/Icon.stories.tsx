import type { Meta, StoryObj } from '@storybook/react-vite';
import { iconRegistry, type IconName } from '@clearline/icons';
import { Icon } from './Icon';

// Iterated straight from the generated registry so these stories can never
// drift out of sync with the icon set (US-CW-022 AC-03).
const iconNames = Object.keys(iconRegistry) as IconName[];
const GALLERY_SIZES = [16, 24, 32] as const;

const meta: Meta<typeof Icon> = {
  title: 'Foundations/Icon',
  component: Icon,
  argTypes: {
    name: { control: 'select', options: iconNames },
    size: { control: { type: 'number', min: 8, max: 96, step: 1 } },
    stroke: { control: { type: 'number', min: 0.5, max: 4, step: 0.1 } },
    color: { control: 'color' },
  },
};
export default meta;

type Story = StoryObj<typeof Icon>;

/** Live-editable single glyph — drive name/size/stroke/color from the controls. */
export const Playground: Story = {
  args: { name: 'shield-check', size: 40 },
};

/** Every registry glyph at three sizes, iterated so the set can't go stale. */
export const Gallery: Story = {
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
      {iconNames.map((name) => (
        <div
          key={name}
          className="border-cl-border bg-cl-surface flex flex-col items-center gap-2 rounded-lg border p-3"
        >
          <div className="text-cl-text flex items-end gap-3">
            {GALLERY_SIZES.map((size) => (
              <Icon key={size} name={name} size={size} />
            ))}
          </div>
          <code className="text-cl-text-2 text-xs">{name}</code>
        </div>
      ))}
    </div>
  ),
};

function ThemedGallery({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div data-theme={theme} className="bg-cl-bg flex-1 rounded-xl p-5">
      <p className="text-cl-text-2 mb-4 text-sm font-medium capitalize">{theme}</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2.5">
        {iconNames.map((name) => (
          <div
            key={name}
            className="border-cl-border bg-cl-surface text-cl-text flex flex-col items-center gap-1.5 rounded-lg border p-2.5"
          >
            <Icon name={name} size={24} />
            <code className="text-cl-text-2 text-center text-xs">{name}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The full set rendered in light and dark at once, each panel scoped by the
 * project's own `data-theme` token mechanism. `theme.css` defines both
 * `[data-theme='light']` and `[data-theme='dark']`, so each panel forces its
 * own tokens regardless of the ambient toolbar theme.
 */
export const BothThemes: Story = {
  name: 'Both Themes',
  render: () => (
    <div className="flex flex-col gap-5 lg:flex-row">
      <ThemedGallery theme="light" />
      <ThemedGallery theme="dark" />
    </div>
  ),
};
