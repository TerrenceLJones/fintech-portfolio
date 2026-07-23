import { useState } from 'react';
import { Icon, Text } from '@clearline/ui';

/**
 * A read-only reference documenting how a presented key is enforced (AC-03/04): a scope-insufficient
 * request returns 403 naming the missing scope — never a generic auth error — and a revoked key returns
 * 401. The settings UI itself makes no scoped calls; this documents the shape the mock `verify` endpoint
 * (POST /api/developer/api-keys/verify) returns, so the behaviour is transparent to integrators.
 */
export function ApiKeyUsageReference() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-cl-border bg-cl-surface rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-3 text-left"
      >
        <Icon
          name="chevron-right"
          size={14}
          className={`text-cl-text-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <Text as="span" size="label" weight="semibold">
          Using your API key
        </Text>
      </button>
      {open ? (
        <div className="border-cl-border flex flex-col gap-3 border-t px-5 py-4">
          <Text as="p" size="label" tone="muted">
            Send your key as a bearer token. A request that needs a scope your key was not granted
            is refused with the missing scope named — never a generic auth error:
          </Text>
          <pre className="bg-cl-inset text-cl-text overflow-x-auto rounded-lg p-3 font-mono text-[11.5px] leading-relaxed">
            {`HTTP/1.1 403 Forbidden
{ "error": "insufficient_scope", "detail": "write:transfers" }
// → This key does not have write:transfers permission.
//   Generate a new key with the required scope.`}
          </pre>
          <Text as="p" size="label" tone="muted">
            A revoked key is rejected immediately:
          </Text>
          <pre className="bg-cl-inset text-cl-text overflow-x-auto rounded-lg p-3 font-mono text-[11.5px] leading-relaxed">
            {`HTTP/1.1 401 Unauthorized
{ "error": "invalid_key" }`}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
