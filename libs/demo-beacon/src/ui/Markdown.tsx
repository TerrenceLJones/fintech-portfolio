import { Fragment, type ReactNode } from 'react';

/**
 * Deliberately tiny markdown: **bold**, `inline code`, and [text](href) links. Not a full parser —
 * just enough to make config strings readable without pulling a markdown dependency into the lib.
 * A link whose href starts with "/" is treated as an in-app route and routed through `onNavigate`;
 * anything else opens in a new tab.
 */
export function Markdown({
  text,
  onNavigate,
}: {
  text: string;
  onNavigate?: (path: string) => void;
}) {
  return <span className="dbc-md">{renderInline(text, onNavigate)}</span>;
}

// Matches `code`, **bold**, or [text](href), in priority order.
const TOKEN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string, onNavigate?: (path: string) => void): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(TOKEN)) {
    const idx = match.index ?? 0;
    if (idx > last) out.push(<Fragment key={key++}>{text.slice(last, idx)}</Fragment>);
    const token = match[0];
    if (token.startsWith('`')) {
      out.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      out.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      const label = token.slice(1, token.indexOf(']'));
      const href = token.slice(token.indexOf('(') + 1, -1);
      out.push(renderLink(label, href, key++, onNavigate));
    }
    last = idx + token.length;
  }
  if (last < text.length) out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return out;
}

function renderLink(label: string, href: string, key: number, onNavigate?: (p: string) => void) {
  if (href.startsWith('/') && onNavigate) {
    return (
      <button key={key} type="button" className="dbc-link" onClick={() => onNavigate(href)}>
        {label}
      </button>
    );
  }
  return (
    <a key={key} href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}
