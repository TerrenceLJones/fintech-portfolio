import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DocumentDropzone, type DocumentDropzoneStatus } from './DocumentDropzone';

const meta: Meta<typeof DocumentDropzone> = {
  title: 'Molecules/DocumentDropzone',
  component: DocumentDropzone,
};
export default meta;

type Story = StoryObj<typeof DocumentDropzone>;

export const Idle: Story = {
  args: { label: "Dara Reyes — Driver's license", status: 'idle', onFileSelected: fn() },
};

export const Accepted: Story = {
  args: { label: "Dara Reyes — Driver's license", status: 'accepted', onFileSelected: fn() },
};

export const Glare: Story = {
  args: { label: "Dara Reyes — Driver's license", status: 'glare', onFileSelected: fn() },
};

export const Blurry: Story = {
  args: { label: "Dara Reyes — Driver's license", status: 'blurry', onFileSelected: fn() },
};

export const WrongType: Story = {
  args: { label: "Dara Reyes — Driver's license", status: 'wrong_type', onFileSelected: fn() },
};

function Demo() {
  const [status, setStatus] = useState<DocumentDropzoneStatus>('idle');
  return (
    <DocumentDropzone
      label="Dara Reyes — Driver's license"
      status={status}
      onFileSelected={() => setStatus('accepted')}
    />
  );
}

export const SelectingAFileMarksItAccepted: Story = {
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const file = new File(['fake-bytes'], 'drivers-license-front.jpg', { type: 'image/jpeg' });
    const input = canvas.getByLabelText(/browse/i, { selector: 'input' });

    await userEvent.upload(input, file);

    await expect(canvas.getByText('Quality check passed')).toBeInTheDocument();
  },
};
