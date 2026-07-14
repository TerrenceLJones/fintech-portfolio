# @clearline/demo-beacon

A **page-aware demo helper**, modeled on the Help Scout Beacon: a floating launcher in the corner
that opens a compact panel telling testers/reviewers what the mock backend supports on the page
they're on — seed credentials, valid records, guided flows — and lets them act on it (copy test
inputs, walk a flow with navigation, run an app-supplied action like resetting demo state).

Standalone and project-agnostic: runtime deps are React + `@radix-ui/react-dialog` only. No router,
backend, or design-system imports. Themed via `--beacon-*` CSS custom properties. Copy the folder
into another POC to reuse it.

## Usage

```tsx
import { DemoBeaconProvider, useDemoBeacon } from '@clearline/demo-beacon';

// 1. Mount once at the app shell.
<DemoBeaconProvider
  appName="Clearline"
  enabled={demoModeEnabled()} // gate to dev / demo builds
  onNavigate={(path) => navigate(path)} // wire your router
  fallback={globalConfig} // shown when no page has registered
  theme={{ '--beacon-accent': 'var(--cl-accent)' /* … */ }}
>
  {children}
</DemoBeaconProvider>;

// 2. Each page registers its own config.
function ExpensesPage() {
  useDemoBeacon(expensesConfig); // memoize if built at runtime
  // …
}
```

### Registration model

Pages self-identify — no route sniffing. The provider owns a stack: last-registered wins, so a leaf
page overrides a layout-level config while mounted and the layout resurfaces on unmount. Re-registering
the same `pageId` replaces rather than stacks. With no provider mounted (or `enabled={false}`),
`useDemoBeacon` is a safe no-op, and the launcher/panel UI chunk is lazy-loaded only when enabled.

### Section kinds

A config's `sections` is a discriminated union:

- `text` — markdown-lite prose (`**bold**`, `` `code` ``, `[links](href)`; `/`-links route via `onNavigate`).
- `copyable` — label/value rows with per-row copy; `display` masks a value while copying the raw `value`.
- `entities` — a compact table; `rows` may be static or a `() => Promise<EntityRow[]>` getter (loading + error states rendered). Supports `rowLink` (row → navigate) and `rowActions` (per-row copy/navigate).
- `flows` — an accordion of guided walkthroughs; a step's `navigateTo` renders a "Go →" that navigates and closes the panel.
- `actions` — buttons whose `run` the app supplies; the lib renders pending/success/error, and `confirm` gates destructive actions behind an inline confirm.
- `toggles` — on/off switches for stateful scenarios (e.g. "simulate an auth outage"); `get` reads the current state each time the panel opens so the switch mirrors reality, `set` flips it, and the switch reverts if `set` rejects. Both may be async.

Side effects (navigation, state reset, backend simulation) always cross the boundary as callbacks —
the lib never imports what it triggers.

## Design decisions

See [ADR 0001](../../docs/adr/0001-demo-beacon.md): hook-registration over route-mapping, and static
config over live mock-backend introspection.

## Clearline wiring

Colocated `*.beacon.ts` files live beside each page; the provider is mounted in `apps/clearline-web/src/App.tsx`
and gated by `demoModeEnabled()`.
