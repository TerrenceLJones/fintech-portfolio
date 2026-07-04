import { vi } from 'vitest';

/**
 * Builds the handful of `UseMutationResult` fields these tests actually read, for tests that
 * `vi.mock` a data-access hook entirely (e.g. to reach an exhausted-retries UI state without a
 * real backoff wait) instead of driving it through MSW. Callers still cast the result with
 * `as unknown as ReturnType<typeof useX>` — this only removes the repeated object-literal
 * boilerplate, not the cast itself, since the real `UseMutationResult` type has many more fields
 * than any single test needs to fake.
 */
interface MutationResultLike<TData> {
  mutate: (...args: never[]) => unknown;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: Error | null;
  data: TData | undefined;
}

export function buildMutationResult<TData = unknown>(
  overrides: Partial<MutationResultLike<TData>> = {},
): MutationResultLike<TData> {
  const {
    mutate = vi.fn(),
    isPending = false,
    isError = false,
    isSuccess = false,
    error = null,
    data = undefined,
  } = overrides;

  return { mutate, isPending, isError, isSuccess, error, data };
}
