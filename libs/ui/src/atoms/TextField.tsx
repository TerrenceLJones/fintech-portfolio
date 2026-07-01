import { useId, type InputHTMLAttributes } from 'react';

export type FieldState = 'default' | 'focus' | 'error' | 'disabled';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  state?: FieldState;
  help?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
}

export function TextField({
  label,
  state = 'default',
  help,
  error,
  prefix,
  suffix,
  id,
  className,
  ...rest
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helpId = `${inputId}-help`;
  const isError = state === 'error';
  const isDisabled = state === 'disabled' || rest.disabled;

  const boxClasses = [
    'flex items-center gap-1.5 rounded-lg border px-2.75 py-2.25 text-[13px] font-sans',
    isDisabled
      ? 'bg-cl-inset border-cl-border-2 opacity-60'
      : isError
        ? 'bg-cl-surface border-cl-neg'
        : 'bg-cl-surface border-cl-border-2',
    state === 'focus' && !isError ? 'border-cl-accent ring-3 ring-cl-accent-weak' : '',
    !isDisabled && !isError
      ? 'focus-within:border-cl-accent focus-within:ring-3 focus-within:ring-cl-accent-weak'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="text-cl-text-2 mb-1.5 block text-xs font-medium">
          {label}
        </label>
      ) : null}
      <div className={boxClasses}>
        {prefix ? <span className="text-cl-text-3 flex-shrink-0">{prefix}</span> : null}
        <input
          id={inputId}
          disabled={isDisabled}
          aria-invalid={isError}
          aria-describedby={isError && error ? helpId : help ? helpId : undefined}
          className={['text-cl-text w-full flex-1 bg-transparent outline-none', className]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
        {suffix ? (
          <span className="text-cl-text-3 font-mono flex-shrink-0 text-[11px]">{suffix}</span>
        ) : null}
      </div>
      {isError && error ? (
        <div id={helpId} role="alert" className="text-cl-neg mt-1.5 text-xs font-medium">
          {error}
        </div>
      ) : help ? (
        <div id={helpId} className="text-cl-text-3 mt-1.5 text-xs">
          {help}
        </div>
      ) : null}
    </div>
  );
}
