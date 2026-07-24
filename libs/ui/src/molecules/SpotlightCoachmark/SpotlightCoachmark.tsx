import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import type { IconName } from '@clearline/icons';
import { Icon } from '../../foundations/Icon';
import { Text } from '../../atoms/Text';

export interface SpotlightCoachmarkProps {
  /** The primary control the coachmark points at — the page registers it (US-CW-046). */
  anchorRef: RefObject<HTMLElement | null>;
  /** One short line naming the action, e.g. "Start here". */
  title: string;
  /** A sentence of guidance, e.g. "Log your first purchase and send it for approval." */
  body: string;
  icon?: IconName;
  /** Dismiss — close control, Escape, or interacting with the underlying control (AC-02). */
  onDismiss: () => void;
  /** Which side of the anchor to sit on. Defaults to below it, so it never covers the control (AC-01). */
  placement?: 'bottom' | 'top';
}

const GAP = 12;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * The on-page spotlight (US-CW-046): a coachmark anchored to a page's primary control, naming the
 * action in one line without covering the control it points to. It is keyboard-focusable, dismissible
 * with Escape, and does not trap focus (AC-04); its meaning is carried by an icon + text, never colour
 * alone (Design §17). It re-anchors on scroll/resize and, when reduced motion is preferred, appears
 * without a transition (AC-04 / edge case). This is a net-new molecule — there is no Tooltip/Popover
 * primitive in @clearline/ui to reuse.
 */
export function SpotlightCoachmark({
  anchorRef,
  title,
  body,
  icon = 'sparkles',
  onDismiss,
  placement = 'bottom',
}: SpotlightCoachmarkProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') return;

    const reposition = () => {
      const rect = anchor.getBoundingClientRect();
      const top = placement === 'bottom' ? rect.bottom + GAP : rect.top - GAP;
      setPos({ top, left: rect.left });
    };

    // Bring a below-the-fold control into view before anchoring (edge case).
    if (typeof anchor.scrollIntoView === 'function') {
      anchor.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [anchorRef, placement]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  const style = pos
    ? {
        top: pos.top,
        left: pos.left,
        transform: placement === 'top' ? 'translateY(-100%)' : undefined,
      }
    : undefined;

  return (
    <div
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      style={style}
      className={[
        'border-cl-accent bg-cl-surface fixed z-40 w-66 max-w-[calc(100vw-2rem)] rounded-xl border p-3.25 shadow-xl',
        pos ? '' : 'hidden',
        prefersReducedMotion() ? '' : 'transition-opacity duration-200',
      ].join(' ')}
    >
      <div className="flex gap-2.5">
        <span className="bg-cl-accent-weak text-cl-accent-text flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md">
          <Icon name={icon} size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Text as="span" size="label" weight="semibold">
              {title}
            </Text>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="text-cl-text-3 focus-visible:ring-cl-focus -m-1 shrink-0 cursor-pointer rounded p-1 outline-none focus-visible:ring-3"
            >
              <Icon name="x" size={12} />
            </button>
          </div>
          <Text as="p" size="label" weight="regular" tone="muted" className="mt-0.5 mb-0">
            {body}
          </Text>
          <Text as="p" size="mono" tone="muted" className="mt-1.75 mb-0 text-[10.5px]">
            Esc to dismiss
          </Text>
        </div>
      </div>
    </div>
  );
}
