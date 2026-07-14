import type { ReactNode } from 'react';
import { Dialog } from 'radix-ui';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The modal's contents. Must include a `<Modal.Title>` for accessibility. */
  children: ReactNode;
  /** Max content width in px. @default 360 */
  maxWidth?: number;
  /** Extra classes for the content surface (e.g. `text-center`). */
  className?: string;
}

/**
 * The low-level modal chrome: a focus-trapped, Escape-closable overlay + centered surface built on
 * Radix `Dialog`, exposing a free `children` slot so app-level composites can lay out bespoke content
 * (custom bodies, multiple faces, non-standard footers) that the opinionated `AlertModal`/`ConfirmationDialog`
 * can't express — without any consumer importing `radix-ui` directly. Compose the accessible title,
 * description, and a close-triggering element via `Modal.Title` / `.Description` / `.Close`.
 */
export function Modal({
  open,
  onOpenChange,
  children,
  maxWidth = 360,
  className = '',
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/45" />
        <Dialog.Content
          style={{ maxWidth }}
          className={`bg-cl-surface fixed top-1/2 left-1/2 w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl ${className}`.trim()}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Radix-backed slots attached as statics — `Modal.Title` / `.Description` / `.Close` — so consumers
// pull everything they need from `@clearline/ui` and Radix stays encapsulated in the design system.
Modal.Title = Dialog.Title;
Modal.Description = Dialog.Description;
Modal.Close = Dialog.Close;
