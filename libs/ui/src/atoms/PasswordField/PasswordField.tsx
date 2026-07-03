import { useState } from 'react';
import { Icon } from '@fintech-portfolio/icons';
import { TextField, type TextFieldProps } from '../TextField';

export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'suffix'>;

/**
 * `TextField` specialized for password entry, with a built-in show/hide visibility toggle
 * rendered as the field's suffix. `type` and `suffix` are owned internally, so they aren't
 * exposed — everything else (`label`, `state`, `error`, `help`, etc.) passes through unchanged.
 */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="text-cl-text-3 flex items-center gap-1 text-xs font-medium"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} size={14} />
          {visible ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}
