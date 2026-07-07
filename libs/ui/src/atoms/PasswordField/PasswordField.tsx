import { useState } from 'react';
import { Icon } from '../../foundations/Icon';
import { TextField, type TextFieldProps } from '../TextField';

export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'suffix'>;

/**
 * `TextField` specialized for password entry, with a built-in show/hide visibility toggle
 * rendered as the field's suffix. `type` and `suffix` are owned internally, so they aren't
 * exposed — everything else (`label`, `state`, `error`, `help`, etc.) passes through unchanged.
 */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const isFieldDisabled = props.state === 'disabled' || !!props.disabled;

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          disabled={isFieldDisabled}
          onClick={() => setVisible((prev) => !prev)}
          className="text-cl-text-3 flex items-center gap-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} size={14} />
          {visible ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}
