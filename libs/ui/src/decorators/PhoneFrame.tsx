import type { ReactNode } from 'react';

export interface PhoneFrameProps {
  time?: string;
  dark?: boolean;
  width?: number;
  height?: number;
  children?: ReactNode;
}

/** Dev/layout utility — device bezel + status bar + home indicator for mobile-scale component previews. Not a shipping product component. */
export function PhoneFrame({
  time = '9:41',
  dark = false,
  width = 300,
  height = 560,
  children,
}: PhoneFrameProps) {
  const fg = dark ? '#fff' : 'var(--cl-text)';

  return (
    <div
      className="mx-auto rounded-[42px] border border-[#33373f] bg-[#111317] p-2.75 shadow-[0_12px_36px_rgba(0,0,0,0.2)]"
      style={{ maxWidth: width, boxSizing: 'border-box' }}
    >
      <div className="bg-cl-bg flex flex-col overflow-hidden rounded-[32px]" style={{ height }}>
        <div
          className="flex h-11.5 flex-shrink-0 items-end justify-between px-6 pb-1.5"
          style={{ color: fg }}
        >
          <span className="text-[13px] font-semibold">{time}</span>
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2.75 w-4.25 rounded-[3px] border-[1.5px]"
              style={{ borderColor: fg, opacity: 0.9 }}
            />
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        <div className="flex h-5.5 flex-shrink-0 items-center justify-center">
          <div className="h-1 w-27.5 rounded-full" style={{ backgroundColor: fg, opacity: 0.3 }} />
        </div>
      </div>
    </div>
  );
}
