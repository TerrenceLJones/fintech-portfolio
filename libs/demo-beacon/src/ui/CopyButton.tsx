import { useCallback, useState } from 'react';
import { copyText } from '../copy-text';

/**
 * Copies `value` and flips to a checkmark for ~1.5s. Announces success through the panel's live
 * region (via `announce`) so screen-reader users get feedback the visual checkmark alone wouldn't
 * convey. Rendered either as a small link (in rows) or a regular button.
 */
export function CopyButton({
  value,
  label = 'Copy',
  variant = 'link',
  announce,
}: {
  value: string;
  label?: string;
  variant?: 'link' | 'button';
  announce?: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(async () => {
    const ok = await copyText(value);
    setCopied(true);
    announce?.(ok ? 'Copied to clipboard' : 'Copy failed');
    setTimeout(() => setCopied(false), 1500);
  }, [value, announce]);

  return (
    <button
      type="button"
      className={variant === 'button' ? 'dbc-btn' : 'dbc-linkbtn'}
      onClick={onClick}
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}
