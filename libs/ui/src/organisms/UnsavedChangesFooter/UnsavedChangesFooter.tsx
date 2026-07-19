import { Button } from '../../atoms/Button';
import { Text } from '../../atoms/Text';

export interface UnsavedChangesFooterProps {
  /** Whether the form is dirty. When false the bar is not rendered at all. */
  visible: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /** Disables both actions and shows the Save button's loading state while a save is in flight. */
  saving?: boolean;
  /** Left-hand prompt. @default "You have unsaved changes" */
  message?: string;
  /** @default "Save changes" */
  saveLabel?: string;
  /** @default "Discard" */
  discardLabel?: string;
}

/**
 * The sticky Save / Discard bar that governs every form-bearing settings page (design §19 intro /
 * US-CW-034 AC-02). US-CW-034 establishes it as a shared organism the later form pages reuse. It is
 * purely presentational — dirtiness tracking, the actual save, the revert, and the route-leave guard
 * are the page's job; this only surfaces the choice. Pinned to the bottom of its scroll container so
 * it stays visible regardless of scroll, and it renders nothing at all when there are no changes.
 */
export function UnsavedChangesFooter({
  visible,
  onSave,
  onDiscard,
  saving = false,
  message = 'You have unsaved changes',
  saveLabel = 'Save changes',
  discardLabel = 'Discard',
}: UnsavedChangesFooterProps) {
  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className="border-cl-border bg-cl-surface sticky bottom-4 z-20 mt-6 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 shadow-lg"
    >
      <Text as="span" size="label" tone="muted">
        {message}
      </Text>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onDiscard} disabled={saving}>
          {discardLabel}
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} loading={saving}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
