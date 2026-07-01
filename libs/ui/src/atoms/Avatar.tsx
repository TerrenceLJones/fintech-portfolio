export type AvatarTone = 'accent' | 'neutral' | 'positive' | 'warning';

const TONE_CLASSES: Record<AvatarTone, string> = {
  accent: 'bg-cl-accent-weak text-cl-accent-text',
  neutral: 'bg-cl-surface-2 text-cl-text-2',
  positive: 'bg-cl-pos-weak text-cl-pos',
  warning: 'bg-cl-warn-weak text-cl-warn',
};

export interface AvatarProps {
  initials: string;
  size?: number;
  tone?: AvatarTone;
}

export function Avatar({ initials, size = 36, tone = 'accent' }: AvatarProps) {
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full font-sans font-semibold tracking-wide uppercase ${TONE_CLASSES[tone]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials.slice(0, 2)}
    </span>
  );
}
