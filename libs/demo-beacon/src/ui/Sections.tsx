import { useEffect, useState } from 'react';
import type {
  ActionsSection,
  CopyableSection,
  DemoBeaconSection,
  EntityRow,
  EntityTableSection,
  FlowsSection,
  TextSection,
  TogglesSection,
} from '../types';
import { Markdown } from './Markdown';
import { CopyButton } from './CopyButton';

interface SectionCtx {
  onNavigate?: (path: string) => void;
  /** Navigate then close the panel — used by flow steps and row links. */
  navigateAndClose: (path: string) => void;
  announce: (message: string) => void;
}

export function Section({ section, ctx }: { section: DemoBeaconSection; ctx: SectionCtx }) {
  return (
    <section className="dbc-section">
      <h3 className="dbc-section-title">{section.title}</h3>
      {section.kind === 'text' && <TextView section={section} ctx={ctx} />}
      {section.kind === 'copyable' && <CopyableView section={section} ctx={ctx} />}
      {section.kind === 'entities' && <EntitiesView section={section} ctx={ctx} />}
      {section.kind === 'flows' && <FlowsView section={section} ctx={ctx} />}
      {section.kind === 'actions' && <ActionsView section={section} ctx={ctx} />}
      {section.kind === 'toggles' && <TogglesView section={section} ctx={ctx} />}
    </section>
  );
}

function TextView({ section, ctx }: { section: TextSection; ctx: SectionCtx }) {
  return (
    <p className="dbc-text">
      <Markdown text={section.body} onNavigate={ctx.onNavigate} />
    </p>
  );
}

function CopyableView({ section, ctx }: { section: CopyableSection; ctx: SectionCtx }) {
  return (
    <div>
      {section.items.map((item) => (
        <div key={item.label} className="dbc-row">
          <span className="dbc-row-label">{item.label}</span>
          <span className="dbc-row-value">
            {item.display ?? item.value}
            {item.hint ? <span className="dbc-hint">{item.hint}</span> : null}
          </span>
          <CopyButton value={item.value} announce={ctx.announce} />
        </div>
      ))}
    </div>
  );
}

function EntitiesView({ section, ctx }: { section: EntityTableSection; ctx: SectionCtx }) {
  // Static rows render synchronously; a getter is resolved by AsyncEntities (keyed by section title
  // so a new page's section mounts fresh into its loading state rather than flashing stale rows).
  if (typeof section.rows === 'function') {
    return <AsyncEntities key={section.title} getter={section.rows} section={section} ctx={ctx} />;
  }
  return <EntitiesTable rows={section.rows} section={section} ctx={ctx} />;
}

function AsyncEntities({
  getter,
  section,
  ctx,
}: {
  getter: () => Promise<EntityRow[]>;
  section: EntityTableSection;
  ctx: SectionCtx;
}) {
  const [rows, setRows] = useState<EntityRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getter()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [getter]);

  if (error) return <p className="dbc-error">Couldn’t load this data.</p>;
  if (rows === null) return <p className="dbc-loading">Loading…</p>;
  return <EntitiesTable rows={rows} section={section} ctx={ctx} />;
}

function EntitiesTable({
  rows,
  section,
  ctx,
}: {
  rows: EntityRow[];
  section: EntityTableSection;
  ctx: SectionCtx;
}) {
  if (rows.length === 0)
    return <p className="dbc-empty">{section.emptyLabel ?? 'Nothing here yet.'}</p>;

  const hasRowActions = Boolean(section.rowActions);

  return (
    <div className="dbc-table-wrap">
      <table className="dbc-table">
        <thead>
          <tr>
            {section.columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            {hasRowActions ? <th aria-label="row actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const link = section.rowLink?.(row);
            const actions = section.rowActions?.(row) ?? [];
            return (
              <tr
                key={i}
                className={link ? 'dbc-clickable' : undefined}
                onClick={link ? () => ctx.navigateAndClose(link) : undefined}
              >
                {section.columns.map((c) => (
                  <td key={c.key}>{row[c.key]}</td>
                ))}
                {hasRowActions ? (
                  <td onClick={(e) => e.stopPropagation()}>
                    {actions.map((a, ai) =>
                      a.copy !== undefined ? (
                        <CopyButton
                          key={ai}
                          value={a.copy}
                          label={a.label}
                          announce={ctx.announce}
                        />
                      ) : a.navigateTo !== undefined ? (
                        <button
                          key={ai}
                          type="button"
                          className="dbc-linkbtn"
                          onClick={() => ctx.navigateAndClose(a.navigateTo!)}
                        >
                          {a.label}
                        </button>
                      ) : null,
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FlowsView({ section, ctx }: { section: FlowsSection; ctx: SectionCtx }) {
  const [openId, setOpenId] = useState<string | null>(section.flows[0]?.id ?? null);
  return (
    <div>
      {section.flows.map((flow) => {
        const open = openId === flow.id;
        return (
          <div key={flow.id} className="dbc-flow">
            <button
              type="button"
              className="dbc-flow-btn"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : flow.id)}
            >
              {flow.title}
              <span className={`dbc-flow-chev${open ? ' dbc-open' : ''}`} aria-hidden>
                ›
              </span>
            </button>
            {open ? (
              <ol className="dbc-flow-steps">
                {flow.steps.map((step, i) => (
                  <li key={i} className="dbc-flow-step">
                    <span className="dbc-step-n" aria-hidden>
                      {i + 1}
                    </span>
                    <span>
                      <Markdown text={step.text} onNavigate={ctx.onNavigate} />
                      {step.navigateTo ? (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="dbc-linkbtn"
                            onClick={() => ctx.navigateAndClose(step.navigateTo!)}
                          >
                            Go →
                          </button>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ActionsView({ section, ctx }: { section: ActionsSection; ctx: SectionCtx }) {
  return (
    <div className="dbc-actions">
      {section.actions.map((action) => (
        <ActionRow key={action.id} action={action} announce={ctx.announce} />
      ))}
    </div>
  );
}

function ActionRow({
  action,
  announce,
}: {
  action: ActionsSection['actions'][number];
  announce: (m: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'confirming' | 'running' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const danger = action.variant === 'destructive';

  const run = async () => {
    setState('running');
    setErrorMsg(null);
    try {
      await action.run();
      setState('done');
      announce(`${action.label}: done`);
      setTimeout(() => setState('idle'), 1600);
    } catch (e) {
      setState('error');
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong.');
      announce(`${action.label}: failed`);
    }
  };

  const onPrimary = () => {
    if (action.confirm) setState('confirming');
    else void run();
  };

  return (
    <div className="dbc-action-row">
      {state === 'confirming' ? (
        <div className="dbc-confirm">
          <span className="dbc-confirm-text">{action.confirm}</span>
          <button
            type="button"
            className={`dbc-btn${danger ? ' dbc-btn-danger' : ''}`}
            onClick={run}
          >
            Confirm
          </button>
          <button type="button" className="dbc-btn" onClick={() => setState('idle')}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`dbc-btn${danger ? ' dbc-btn-danger' : ' dbc-btn-accent'}`}
          onClick={onPrimary}
          disabled={state === 'running'}
        >
          {state === 'running'
            ? 'Working…'
            : state === 'done'
              ? 'Done ✓'
              : state === 'error'
                ? 'Retry'
                : action.label}
        </button>
      )}
      {action.description ? <span className="dbc-action-desc">{action.description}</span> : null}
      {errorMsg ? <span className="dbc-action-error">{errorMsg}</span> : null}
    </div>
  );
}

function TogglesView({ section, ctx }: { section: TogglesSection; ctx: SectionCtx }) {
  return (
    <div className="dbc-actions">
      {section.toggles.map((toggle) => (
        <ToggleRow key={toggle.id} toggle={toggle} announce={ctx.announce} />
      ))}
    </div>
  );
}

function ToggleRow({
  toggle,
  announce,
}: {
  toggle: TogglesSection['toggles'][number];
  announce: (m: string) => void;
}) {
  // `null` until the initial get() resolves, so a slow async read doesn't render a wrong position.
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.resolve(toggle.get())
      .then((v) => alive && setOn(v))
      .catch(() => alive && setError('Couldn’t read state.'));
    return () => {
      alive = false;
    };
  }, [toggle]);

  const flip = async () => {
    if (on === null) return;
    const next = !on;
    setOn(next); // optimistic — the switch should track the click instantly
    setError(null);
    try {
      await toggle.set(next);
      announce(`${toggle.label}: ${next ? 'on' : 'off'}`);
    } catch (e) {
      setOn(!next); // revert on failure
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      announce(`${toggle.label}: failed`);
    }
  };

  return (
    <div className="dbc-action-row">
      <div className="dbc-toggle">
        <button
          type="button"
          role="switch"
          aria-checked={on === true}
          aria-label={toggle.label}
          className={`dbc-switch${on ? ' dbc-on' : ''}`}
          onClick={flip}
          disabled={on === null}
        >
          <span className="dbc-switch-knob" aria-hidden />
        </button>
        <span className="dbc-toggle-label">{toggle.label}</span>
      </div>
      {toggle.description ? <span className="dbc-action-desc">{toggle.description}</span> : null}
      {error ? <span className="dbc-action-error">{error}</span> : null}
    </div>
  );
}
