import type { Meta, StoryObj } from '@storybook/react-vite';
import { Container } from './Container';

const meta: Meta<typeof Container> = {
  title: 'Atoms/Container',
  component: Container,
  argTypes: {
    width: { control: 'radio', options: ['sm', 'lg'] },
  },
  decorators: [
    (Story) => (
      <div className="bg-cl-surface-2 w-full">
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Container>;

const swatch = <div className="bg-cl-accent h-16 w-full rounded" />;

export const Small: Story = { args: { width: 'sm', children: swatch } };
export const Large: Story = { args: { width: 'lg', children: swatch } };
export const CustomPixelWidth: Story = { args: { width: 640, children: swatch } };
export const Unpadded: Story = { args: { width: 'sm', padded: false, children: swatch } };
