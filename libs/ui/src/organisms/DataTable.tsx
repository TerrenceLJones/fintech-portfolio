import { useMemo, useState } from 'react';
import { Icon } from '@fintech-portfolio/icons';
import { Checkbox } from '../atoms/Checkbox';
import { StatusBadge, type StatusKey } from '../foundations/StatusBadge';
import { formatMoney } from '../lib/format-money';

export interface DataTableRow {
  id: string;
  vendor: string;
  date: string;
  amount: number;
  status: StatusKey;
  account: string;
}

export type Density = 'comfortable' | 'compact';

const DEFAULT_ROWS: DataTableRow[] = [
  {
    id: '1',
    vendor: 'Amazon Web Services',
    date: 'Jun 28, 2026',
    amount: 48210,
    status: 'paid',
    account: '••4021',
  },
  {
    id: '2',
    vendor: 'Figma Inc.',
    date: 'Jun 27, 2026',
    amount: 1920,
    status: 'pending-l2',
    account: '••4021',
  },
  {
    id: '3',
    vendor: 'WeWork',
    date: 'Jun 26, 2026',
    amount: 112400.5,
    status: 'approved',
    account: '••8830',
  },
  {
    id: '4',
    vendor: 'Slack Technologies',
    date: 'Jun 25, 2026',
    amount: 8640,
    status: 'rejected',
    account: '••8830',
  },
];

export interface DataTableProps {
  rows?: DataTableRow[];
  density?: Density;
  onApproveSelected?: (ids: string[]) => void;
  onExportSelected?: (ids: string[]) => void;
}

/** The workhorse table: header select-all, sortable vendor column, per-row selection, a selection action bar, and a density toggle. */
export function DataTable({
  rows = DEFAULT_ROWS,
  density: densityProp,
  onApproveSelected,
  onExportSelected,
}: DataTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<Density>(densityProp ?? 'comfortable');
  const [sortAsc, setSortAsc] = useState(true);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        sortAsc ? a.vendor.localeCompare(b.vendor) : b.vendor.localeCompare(a.vendor),
      ),
    [rows, sortAsc],
  );

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  const rowPadding = density === 'compact' ? 'py-2' : 'py-3.25';
  const cols = '42px 1.4fr 1fr 0.9fr 1fr 120px';

  return (
    <div className="border-cl-border bg-cl-surface overflow-hidden rounded-xl border font-sans">
      <div className="border-cl-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-cl-text text-[13px] font-semibold">Recent transactions</span>
          <span className="text-cl-text-3 font-mono text-[11px]">{rows.length} rows</span>
        </div>
        <div className="bg-cl-surface-2 border-cl-border flex items-center gap-1 rounded-md border p-0.75 text-[11.5px]">
          {(['comfortable', 'compact'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDensity(d)}
              className={[
                'rounded px-2.5 py-1 capitalize',
                density === d ? 'bg-cl-surface text-cl-text shadow-sm' : 'text-cl-text-3',
              ].join(' ')}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div
        className="bg-cl-inset border-cl-border text-cl-text-3 font-mono grid items-center border-b px-4 py-2.25 text-[11px] font-semibold tracking-wide uppercase"
        style={{ gridTemplateColumns: cols }}
      >
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onCheckedChange={toggleAll}
          aria-label="Select all"
        />
        <button
          type="button"
          onClick={() => setSortAsc((s) => !s)}
          className="text-cl-text-2 flex items-center gap-1 text-left"
        >
          Vendor
          <Icon name="sort" size={10} />
        </button>
        <div>Date</div>
        <div className="text-right">Amount</div>
        <div>Status</div>
        <div>Account</div>
      </div>
      {sortedRows.map((row, i) => {
        const isSelected = selected.has(row.id);
        return (
          <div
            key={row.id}
            className={[
              'grid items-center px-4 text-[13px]',
              rowPadding,
              i < sortedRows.length - 1 ? 'border-cl-border border-b' : '',
              isSelected ? 'bg-cl-accent-weak' : '',
            ].join(' ')}
            style={{ gridTemplateColumns: cols }}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleRow(row.id)}
              aria-label={`Select ${row.vendor}`}
            />
            <div className="text-cl-text font-medium">{row.vendor}</div>
            <div className="text-cl-text-2 font-mono text-xs">{row.date}</div>
            <div className="text-cl-text font-mono pr-4.5 text-right font-semibold tabular-nums">
              {formatMoney(row.amount)}
            </div>
            <div>
              <StatusBadge status={row.status} />
            </div>
            <div className="text-cl-text-2 font-mono text-[11.5px]">{row.account}</div>
          </div>
        );
      })}
      {selected.size > 0 ? (
        <div className="bg-cl-accent flex items-center justify-between px-4 py-2.5 text-xs text-white">
          <span className="font-medium">
            {selected.size} row{selected.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onApproveSelected?.([...selected])}
              className="rounded-md bg-white/18 px-3 py-1.25 font-medium"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => onExportSelected?.([...selected])}
              className="rounded-md bg-white/18 px-3 py-1.25 font-medium"
            >
              Export
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
