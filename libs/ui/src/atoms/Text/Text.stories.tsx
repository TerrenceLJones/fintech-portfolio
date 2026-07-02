import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text, type TextSize, type TextTone } from './Text';

const meta: Meta<typeof Text> = {
  title: 'Atoms/Text',
  component: Text,
};
export default meta;

type Story = StoryObj<typeof Text>;

const SIZES: TextSize[] = ['display', 'title', 'heading', 'body', 'label', 'mono'];
const TONES: TextTone[] = [
  'default',
  'muted',
  'faint',
  'accent',
  'positive',
  'negative',
  'warning',
  'critical',
];

export const Body: Story = {
  args: { children: 'The quick brown fox jumps over the lazy dog.' },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {SIZES.map((size) => (
        <Text key={size} size={size}>
          {size} — The quick brown fox
        </Text>
      ))}
    </div>
  ),
};

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {TONES.map((tone) => (
        <Text key={tone} tone={tone}>
          {tone} tone
        </Text>
      ))}
    </div>
  ),
};

export const DecoupledSizeAndTag: Story = {
  name: 'Size decoupled from semantic tag',
  render: () => (
    <Text size="body" as="h3">
      Visually body-sized, but a real &lt;h3&gt; for document outline
    </Text>
  ),
};

export const WeightOverride: Story = {
  args: { size: 'body', weight: 'semibold', children: 'Semibold body text' },
};
