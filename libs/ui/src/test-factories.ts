import type { DataTableRow } from './organisms/DataTable/DataTable';
import type { NavigationShellItem } from './organisms/NavigationShell/NavigationShell';
import type { BulkActionFailure } from './organisms/BulkActionResult/BulkActionResult';
import type { TimelineEntry } from './molecules/Timeline/Timeline';
import type { PasswordRequirementItem } from './molecules/PasswordRequirementsList/PasswordRequirementsList';

/** Replaces the hand-built `DataTableRow` array literals duplicated across DataTable.test.tsx cases. */
export function buildDataTableRow(overrides: Partial<DataTableRow> = {}): DataTableRow {
  return {
    id: '1',
    vendor: 'Zephyr Co.',
    date: 'Jun 28, 2026',
    amount: 100,
    status: 'approved',
    account: '••1111',
    ...overrides,
  };
}

/** `overrides[i]` merges onto row `i`'s defaults; each row still gets a unique `id` by default. */
export function buildDataTableRows(
  count: number,
  overrides: Partial<DataTableRow>[] = [],
): DataTableRow[] {
  return Array.from({ length: count }, (_, index) =>
    buildDataTableRow({ id: String(index + 1), ...overrides[index] }),
  );
}

/** Replaces the `{ id, icon, label }` object literals duplicated across NavigationShell/AppShell tests. */
export function buildNavItem(overrides: Partial<NavigationShellItem> = {}): NavigationShellItem {
  return { id: 'expenses', icon: 'file-text', label: 'My Expenses', ...overrides };
}

export function buildNavItems(overrides: Partial<NavigationShellItem>[]): NavigationShellItem[] {
  return overrides.map((item) => buildNavItem(item));
}

export function buildTimelineEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    actor: 'M. Okafor',
    action: 'approved expense',
    tone: 'positive',
    time: 'Jun 28, 2026 · 14:22:07 PT',
    ...overrides,
  };
}

/**
 * Shape mirrors `evaluateSignUpPassword`'s return value as well as `PasswordRequirementsList`
 * props, so this factory backs both the domain policy tests and the molecule's tests.
 */
export function buildPasswordRequirementItem(
  overrides: Partial<PasswordRequirementItem> = {},
): PasswordRequirementItem {
  return { label: 'At least 12 characters', met: true, ...overrides };
}

export function buildBulkActionFailure(
  overrides: Partial<BulkActionFailure> = {},
): BulkActionFailure {
  return { name: 'D. Reyes · $24,800.00', reason: 'Exceeds your $10,000 limit', ...overrides };
}
