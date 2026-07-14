/**
 * The config contract. Everything the Beacon shows or does is described by data + callbacks, so the
 * lib imports no app, router, or backend code. A page authors a `DemoBeaconPageConfig` and registers
 * it with `useDemoBeacon`; anything side-effectful (navigation, state reset) crosses the boundary as
 * a callback the app supplies.
 */

/** A single page's guide. */
export interface DemoBeaconPageConfig {
  /** Stable id, e.g. 'expenses.list'. Re-registering the same id replaces rather than stacks. */
  pageId: string;
  /** Panel header for this page. */
  title: string;
  /** One-paragraph orientation (markdown-lite: **bold**, `code`, [text](href)). */
  summary?: string;
  sections: DemoBeaconSection[];
}

export type DemoBeaconSection =
  | TextSection
  | EntityTableSection
  | CopyableSection
  | FlowsSection
  | ActionsSection
  | TogglesSection;

interface SectionBase {
  title: string;
}

/** Free prose. `body` is markdown-lite: **bold**, `inline code`, [links](href). */
export interface TextSection extends SectionBase {
  kind: 'text';
  body: string;
}

export type EntityRow = Record<string, string | number>;

/** A per-row affordance beyond navigation — e.g. copy an EIN or an account number. */
export interface EntityRowAction {
  label: string;
  /** When set, clicking copies this string to the clipboard. */
  copy?: string;
  /** When set, clicking calls the provider's `onNavigate` with this path. */
  navigateTo?: string;
}

/** A compact table of the seed records a page operates on. */
export interface EntityTableSection extends SectionBase {
  kind: 'entities';
  columns: { key: string; label: string }[];
  /**
   * Static rows, or an app-supplied getter. The getter is the one concession to dynamic data: the
   * lib awaits it (loading state) and renders an error state on rejection. Where the data comes from
   * — a literal array, an MSW service, a cache read — is the app's business, not the lib's.
   */
  rows: EntityRow[] | (() => Promise<EntityRow[]>);
  emptyLabel?: string;
  /** Path passed to `onNavigate` when a row is clicked. */
  rowLink?: (row: EntityRow) => string | undefined;
  /** Extra per-row actions (copy/navigate) rendered at the end of the row. */
  rowActions?: (row: EntityRow) => EntityRowAction[];
}

/** Copyable test inputs. `display` lets a value render masked while copying the full `value`. */
export interface CopyableSection extends SectionBase {
  kind: 'copyable';
  items: {
    label: string;
    value: string;
    /** Pretty/masked display (e.g. `•••• 4242`); copy still yields `value`. */
    display?: string;
    hint?: string;
  }[];
}

/** Guided walkthroughs. A step with `navigateTo` renders a "Go →" affordance. */
export interface FlowsSection extends SectionBase {
  kind: 'flows';
  flows: {
    id: string;
    title: string;
    steps: { text: string; navigateTo?: string }[];
  }[];
}

/** App-supplied actions. The lib renders pending/success/error; `confirm` gates destructive ones. */
export interface ActionsSection extends SectionBase {
  kind: 'actions';
  actions: {
    id: string;
    label: string;
    description?: string;
    run: () => Promise<void>;
    /** When set, an inline "Are you sure?" step must be confirmed before `run` fires. */
    confirm?: string;
    variant?: 'default' | 'destructive';
  }[];
}

/**
 * App-supplied on/off switches for stateful scenarios (e.g. "simulate an auth outage"). Unlike an
 * action, which fires once, a toggle owns a persistent bit of demo state: `get` reads it each time
 * the panel opens so the switch mirrors reality, and `set` flips it. Either may be async.
 */
export interface TogglesSection extends SectionBase {
  kind: 'toggles';
  toggles: {
    id: string;
    label: string;
    description?: string;
    /** Read the current state — re-read whenever the panel (re)mounts. */
    get: () => boolean | Promise<boolean>;
    /** Apply the new state. */
    set: (on: boolean) => void | Promise<void>;
  }[];
}

/** Provider props. */
export interface DemoBeaconProviderProps {
  /** Small eyebrow label above the page title, e.g. the app name. */
  appName: string;
  /**
   * When false, the store still accepts registrations but no launcher/panel renders and the UI
   * chunk isn't loaded — so a real production build pays nothing. Defaults to true.
   */
  enabled?: boolean;
  position?: 'bottom-right' | 'bottom-left';
  offset?: { x: number; y: number };
  /** Wired to the host router; called for flow steps, row links, and navigate row-actions. */
  onNavigate?: (path: string) => void;
  /** Shown when no page has registered a config. */
  fallback?: DemoBeaconPageConfig;
  /**
   * CSS custom-property overrides applied to the launcher/panel roots, e.g.
   * `{ '--beacon-accent': 'var(--cl-accent)' }` — how a host themes the Beacon without a dep edge.
   */
  theme?: Record<string, string>;
  children: React.ReactNode;
}
