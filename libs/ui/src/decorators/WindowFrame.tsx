import type { ReactNode } from 'react';

export type FrameSize = 'sm' | 'md';

export interface WindowFrameProps {
  url: string;
  size?: FrameSize;
  shadow?: boolean;
  children?: ReactNode;
}

/** Dev/layout utility — browser chrome for screen-scale component previews. Not a shipping product component. */
export function WindowFrame({ url, size = 'md', shadow = true, children }: WindowFrameProps) {
  const small = size === 'sm';

  return (
    <div
      className={[
        'border-cl-border overflow-hidden rounded-xl border',
        shadow ? 'shadow-[0_4px_16px_rgba(20,23,28,0.05)]' : '',
      ].join(' ')}
    >
      <div
        className={[
          'bg-cl-inset border-cl-border flex items-center gap-3.5 border-b',
          small ? 'h-9' : 'h-9.5',
        ].join(' ')}
        style={{ paddingInline: 14 }}
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`bg-cl-border-2 rounded-full ${small ? 'h-2.25 w-2.25' : 'h-2.5 w-2.5'}`}
            />
          ))}
        </div>
        <div className={`text-cl-text-3 font-mono ${small ? 'text-[10.5px]' : 'text-[11px]'}`}>
          {url}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
