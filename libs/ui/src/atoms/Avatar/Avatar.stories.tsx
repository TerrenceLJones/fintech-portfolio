import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';
import maleHeadshot from '../../fixtures/male-headshot.jpg';

const meta: Meta<typeof Avatar> = {
  title: 'Atoms/Avatar',
  component: Avatar,
  argTypes: {
    tone: { control: 'select', options: ['accent', 'neutral', 'positive', 'warning'] },
  },
};
export default meta;

type Story = StoryObj<typeof Avatar>;

export const Accent: Story = { args: { initials: 'DR', size: 44, tone: 'accent' } };
export const Neutral: Story = { args: { initials: 'MO', size: 36, tone: 'neutral' } };
export const Positive: Story = { args: { initials: 'PN', size: 30, tone: 'positive' } };
export const Warning: Story = { args: { initials: 'SP', size: 30, tone: 'warning' } };
export const WithPhoto: Story = { args: { initials: 'MO', size: 44, src: maleHeadshot } };
export const PhotoFallback: Story = {
  args: { initials: 'MO', size: 44, src: '/broken-avatar.png' },
};
