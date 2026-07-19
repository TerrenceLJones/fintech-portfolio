import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '../../atoms/Button';
import { AvatarCropDialog } from './AvatarCropDialog';

const meta: Meta<typeof AvatarCropDialog> = {
  title: 'Molecules/AvatarCropDialog',
  component: AvatarCropDialog,
};
export default meta;

type Story = StoryObj<typeof AvatarCropDialog>;

// A 2×2 checkerboard PNG as a self-contained data URL, so the story needs no external asset.
const SAMPLE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSFQ4AJnBAyhlPT0zAAAAAElFTkSuQmCC';

function OpenExample() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Open crop dialog
      </Button>
      <AvatarCropDialog
        open={open}
        src={SAMPLE}
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export const Open: Story = {
  render: () => <OpenExample />,
};

export const Static: Story = {
  args: { open: true, src: SAMPLE, onConfirm: fn(), onCancel: fn() },
};
