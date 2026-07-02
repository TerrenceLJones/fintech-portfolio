import { useState } from 'react';

export type AvatarTone = 'accent' | 'neutral' | 'positive' | 'warning';

const TONE_CLASSES: Record<AvatarTone, string> = {
  accent: 'bg-cl-accent-weak text-cl-accent-text',
  neutral: 'bg-cl-surface-2 text-cl-text-2',
  positive: 'bg-cl-pos-weak text-cl-pos',
  warning: 'bg-cl-warn-weak text-cl-warn',
};

export interface AvatarProps {
  initials: string;
  src?: string;
  alt?: string;
  size?: number;
  tone?: AvatarTone;
}

export function Avatar({ initials, src, alt, size = 36, tone = 'accent' }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(src) && !errored;

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-sans font-semibold tracking-wide uppercase ${TONE_CLASSES[tone]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt ?? initials}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        initials.slice(0, 2)
      )}
    </span>
  );
}
