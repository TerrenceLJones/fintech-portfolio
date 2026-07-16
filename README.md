# clearline

A monorepo of standalone fintech frontend projects, each demoable and discussable independently. Every project is scoped around a specific fintech domain and modeled around real business rules, failure modes, and data-integrity constraints — not happy-path CRUD. The flagship (and currently only) project is **Clearline**.

---

## Clearline — B2B Spend Management & Payments

> Corporate spend platform in the style of Ramp, Brex, and Mercury.

Clearline is a web-only frontend that models the parts of a spend platform where correctness actually matters: idempotent vendor payments, multi-level approvals with separation of duties, role-based access control, business onboarding/KYB, and (planned) a double-entry ledger with derived balances, AI-assisted invoice coding, and reconciliation.

The focus is fidelity to real failure modes — idempotency-key replay, partial-failure batch approvals, SoD enforcement, daily-limit and self-transfer guards, network-retry with full-jitter backoff — modeled explicitly in pure domain logic and surfaced honestly in the UI.

`apps/clearline-web` · [live demo](https://clearline-web-delta.vercel.app/) · [component library](https://clearline-component-library.vercel.app) · `[loom url]`

---

## Architecture

Clearline is layered so that **business rules never depend on React, HTTP, or the DOM**. Each concern lives in its own Nx library, and module boundaries are enforced by `@nx/enforce-module-boundaries`.

```
             ┌─────────────────────────────────────────────┐
   UI layer  │  apps/clearline-web   (React 19 + Vite)      │
             │  pages · route guards · RBAC nav             │
             └───────────────┬─────────────────────────────┘
                             │ imports
             ┌───────────────▼─────────────────────────────┐
data-access  │  libs/data-access/*   (TanStack React Query) │
             │  typed hooks over /api/* ; surfaces 4xx as   │
             │  typed errors ; retry/timeout/idempotency    │
             └───────────────┬─────────────────────────────┘
                             │ imports
             ┌───────────────▼─────────────────────────────┐
   domain    │  libs/domain/*   (pure TypeScript)           │
             │  validation gates, state machines, policies  │
             │  — no React, no fetch, unit-testable alone   │
             └─────────────────────────────────────────────┘

   ───────────────────────────────────────────────────────────
   Cross-cutting: libs/ui · libs/design-tokens · libs/icons
                  libs/util/money · libs/contracts
   Backend seam:  libs/mock-backend  (MSW v2, stateful services)
```

**The layering rule of thumb:** if it's a business invariant it lives in `domain`; if it talks to the network it lives in `data-access`; if it renders it lives in `ui` or the app. For example, the single `validatePayment` gate (balance, daily limit, self-transfer, recipient status) is pure domain logic; the React Query hook that mints an `Idempotency-Key`, applies a 30s timeout, and retries 5xx with full-jitter backoff is data-access; the form that shows the resulting typed error is UI.

### Mock backend

There is no separate backend service. `libs/mock-backend` is an **MSW v2** implementation where **stateful TypeScript services hold the invariants** (balances, idempotency records, approval state) and MSW handlers are thin HTTP/WebSocket adapters in front of them. This lets the frontend exercise realistic server behavior — replayed idempotency keys, validation 4xx, partial batch failures — entirely in the browser and in tests. See `TDR-PLATFORM-001 > shared_mock_backend_strategy`.

### Demo Beacon

Because the app runs entirely on the mock backend, a tester needs to know what seed data exists and what inputs each page will accept. The **Demo Beacon** answers that in-place: a floating launcher in the bottom-right corner opens a **page-aware** panel describing the current page's seeded data and scenarios — no reading fixture files.

It's a standalone, project-agnostic library (`libs/demo-beacon`, `@clearline/demo-beacon`) modeled on the Help Scout Beacon. Its only runtime dependencies are React and `@radix-ui/react-dialog`; it's themed via `--beacon-*` CSS variables and imports no app, router, or backend code, so it can be lifted into another project.

**What a tester gets, per page:**

- **Login** — the seeded demo credentials to copy, and a toggle to simulate an auth outage.
- **Dashboard** — one-click **role switching** (Employee / Finance Manager / Controller) to watch the nav and permissions re-scope, plus a **Reset demo data** control.
- **Approvals** — the seeded queue and which items trip the over-limit (Escalate) and self-approval (Reassign) guardrails.
- **New payment** — the full account/routing numbers (the page shows only masked forms) for the "Recipient not listed?" hand-entry flow, and the amount thresholds that trip the daily-limit / insufficient-funds blocks.
- **Onboarding** — the EINs the mock registry accepts, and the names/EINs that route to manual review.

**How it works:** each page calls `useDemoBeacon(config)` to register its guide while mounted; a single `DemoBeaconProvider` in `App.tsx` owns the store and renders the launcher. Anything side-effectful (navigation, backend simulation, reset) crosses the boundary as a callback the app supplies. Config lives beside each page in colocated `*.beacon.ts` files (`apps/clearline-web/src/**/*.beacon.ts`) and shared helpers in `src/dev/beacon/`.

See [`libs/demo-beacon/README.md`](libs/demo-beacon/README.md) for the config API.

**When it appears:** automatically in local dev, and in a hosted demo build that sets `VITE_ENABLE_MOCKS=true`. A real production build leaves that unset — the store still mounts (page hooks are harmless no-ops) but the launcher/panel UI chunk is never loaded, so it costs nothing. Gating lives in `apps/clearline-web/src/dev/demo-mode.ts`.

---

## Monorepo structure

```
clearline/
  apps/
    clearline-web/           # the Clearline SPA — React 19 + Vite 7, react-router 7
  libs/
    ui/                      # @clearline/ui — React component library (Radix-backed) + Storybook
    design-tokens/           # @clearline/design-tokens — Tailwind v4 @theme --cl-* tokens + ThemeProvider
    icons/                   # @clearline/icons — 45-glyph framework-agnostic icon registry + <Icon>
    domain/
      auth/                  # @clearline/domain-auth        — pure auth/session rules
      onboarding/            # @clearline/domain-onboarding  — pure KYB rules
      payments/              # @clearline/domain-payments    — validatePayment, idempotency keys, retry policy
    data-access/
      auth/                  # @clearline/data-access-auth
      approvals/             # @clearline/data-access-approvals
      onboarding/            # @clearline/data-access-onboarding
      payments/              # @clearline/data-access-payments
    util/
      money/                 # @clearline/money — currency minor-unit conversion, shared once
    contracts/               # @clearline/contracts — API contract types (no Pact, see ADR-006)
    mock-backend/            # @clearline/mock-backend — MSW v2 services-first mock backend
    demo-beacon/             # @clearline/demo-beacon — page-aware demo helper widget (standalone)
  specs/                     # epics, user stories, TDRs, designs
  infrastructure/            # IDRs, setup guides, env templates, CI/CD, verification checklists
```

Built with **Nx + pnpm**. Domain libs are pure TypeScript, framework-agnostic, and fully unit-testable in isolation.

### App structure (`apps/clearline-web/src`)

```
pages/         auth (Login, SignUp, Forgot/Reset password, Verify email),
               Dashboard, Approvals, onboarding/*, payments/*
routes/        route guards — RequireAuth, RequireOnboarded, RequirePermission,
               SessionActivityBoundary, OnboardingProgressBoundary
rbac/          permission-driven navigation items
hooks/ dev/ test/   app hooks, dev-only tooling, test setup
e2e/           Playwright end-to-end specs
```

---

## Tech stack

| Concern            | Choice                                                |
| ------------------ | ----------------------------------------------------- |
| Framework / build  | React 19 + Vite 7 (`TDR-CW-WEB-001`)                  |
| Routing            | react-router 7.18 (pinned below the recent 8.x major) |
| Server state       | TanStack React Query 5                                |
| Forms / validation | react-hook-form + Zod                                 |
| Styling            | Tailwind CSS v4 (`@theme` tokens) + Radix primitives  |
| Mock backend       | MSW v2 (stateful services)                            |
| Monitoring         | Sentry                                                |
| Testing            | Vitest (unit) + Playwright (e2e)                      |
| Hosting            | Vercel                                                |
| Tooling            | Nx · pnpm · Node 24                                   |

---

## Project status

The frontend framework decision is settled (React 19 + Vite) and `clearline-web` is a running application, not a placeholder.

**Implemented:**

- **EPIC-CW-000** — Design system foundation (`design-tokens`, `icons`, `ui`, fully tested + storied)
- **EPIC-CW-001 / 016** — Authentication, session management, and account sign-up
- **EPIC-CW-002** — Business onboarding & KYB
- **EPIC-CW-003** — Role-based access control & permissions
- **EPIC-CW-004** — Vendor payments & transfers (idempotent payment flow, validation gate, FX quote)
- **EPIC-CW-005** — 3DS / step-up authentication for high-value payments
- **EPIC-CW-006** — Expense submission & approval workflow (separation of duties, limit-based escalation, stale-action reconciliation)
- **EPIC-CW-007** — Batch operations (partial-failure batch approve/reject, per-item idempotency keys, mid-batch resume)
- **EPIC-CW-008** — Card management (virtual card issuance with limits + MCC restrictions, real-time WebSocket transaction feed, freeze controls, security-gated declines)
- **EPIC-CW-019** — Account owner provisioning at KYB approval
- **EPIC-CW-020** — Reassign approver for blocked approvals

**Planned** (see `specs/epics/clearline-web/`): real-time spend dashboard & analytics, vendor management & reconciliation, AI invoice coding, AI spend insights (streaming), budget management, organization & team management, plus cross-cutting accessibility (WCAG 2.1 AA) and audit logging.

---

## Node version

This repo requires **Node 24** (`engines.node` in `package.json`). Use
[mise](https://mise.jdx.dev) to get it automatically — `mise.toml` at the repo root pins Node
24 and pnpm 9.15.1:

```bash
mise install       # once, per machine
mise trust         # approve this repo's mise.toml
```

---

## Running locally

```bash
pnpm install

# run the Clearline app (Vite dev server)
pnpm nx run clearline-web:dev

# browse the Clearline design system
pnpm nx run ui:storybook

# unit tests (everything) / e2e
pnpm nx run-many --target=test --all
pnpm nx run clearline-web:e2e
```

The **Demo Beacon** (see above) is on automatically in the dev server — look for the launcher in the bottom-right corner. Sign in with the credentials it shows on the login page. To turn it on for a hosted demo deploy, set `VITE_ENABLE_MOCKS=true` in that environment (it also enables the MSW mock backend); leave it unset for a real production build.

**Always run `lint`/`type-check`/`test`/`build` through Nx** (`pnpm nx run <project>:<target>`
or `pnpm nx run-many --target=...`), not a bare `tsc`/`vitest` inside a `libs/*` folder.
`libs/ui` and `libs/icons` consume `libs/design-tokens`/`libs/icons` via TypeScript project
references, which requires those dependencies' declaration files to already be built —
`nx.json`'s `type-check: { dependsOn: ["^build"] }` (and the same for `test`) is what makes
that happen automatically. Running `tsc` directly, bypassing Nx, will fail with `TS6305` until
you've built the dependencies yourself.

### Regenerating tokens and icons

`libs/design-tokens` and `libs/icons` are generated from JSON sources, kept as the single
input for each package:

```bash
# after editing libs/design-tokens/tokens.source.json
pnpm --filter @clearline/design-tokens generate

# after editing libs/icons/icons.source.json
pnpm --filter @clearline/icons generate
```

---

## AI usage

AI tools (Claude, GitHub Copilot) are used throughout this repo — from initial research and architecture planning through design, scaffolding, and code generation. This is a deliberate workflow choice: AI accelerates the work without replacing the engineering judgment behind it. Domain invariants, architectural decisions, state machine design, and review of all AI-generated output are human-owned.

---

## License & reuse

**Copyright © 2026 Terrence L. Jones. All rights reserved.**

This repository is **source-available, not open source.** No license — open source or
otherwise — is granted for any part of it. This is intentional, not an oversight: the source
is published so it can be **read, evaluated, and discussed**, nothing more.

Being able to view, clone, or fork this code on GitHub does **not** grant you permission to
use it. Under default copyright law, all rights are reserved by the author, and without an
explicit license you have no right to use, copy, modify, merge, publish, distribute,
sublicense, create derivative works from, or otherwise reuse this code or its contents — in
whole or in part, for commercial or non-commercial purposes.

**Any such use is prohibited without the prior express written consent of the author.** If you
would like to use any part of this project, contact the author to request permission.
