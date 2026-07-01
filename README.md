# fintech-portfolio

A monorepo of standalone fintech frontend projects, each demoable and discussable independently. Each project is scoped around a specific fintech domain — modeling real business rules, failure modes, and data integrity constraints, not just happy-path CRUD.

---

## Projects

### Clearline — B2B Spend Management & Payments

> Corporate spend platform in the style of Ramp, Brex, and Mercury.

Double-entry ledger with derived balances, idempotent payment flows, multi-level approval workflows with separation of duties, AI-assisted invoice coding, and reconciliation. The focus is fidelity to real failure modes — partial-failure batch approvals, idempotency-key replay, SoD enforcement — modeled explicitly and shown in the UI.

`apps/clearline-web` · `[demo url]` · `[loom url]`

---

## Monorepo structure

```
fintech-portfolio/
  apps/                  # deployable applications (one per project)
    clearline-web/       # placeholder — frontend framework TBD (TDR-CW-WEB-001)
  libs/                  # shared libraries — domain logic, UI, data-access, utilities
    design-tokens/       # Clearline --cl-* design tokens (Tailwind v4 @theme) + ThemeProvider/useTheme
    icons/               # @fintech-portfolio/icons — the 45-glyph Clearline icon registry + <Icon>
    ui/                  # @fintech-portfolio/ui — the Clearline React component library + Storybook
    mock-backend/        # MSW v2 mock backend convention (services-first, handlers-second)
    contracts/           # documented API contracts (no Pact — see TDR-PLATFORM-001)
  specs/                 # opportunities, TDRs, user stories, implementation plans
  infrastructure/        # IDRs, setup guides, env templates, CI/CD, verification checklists
```

Built with **Nx + pnpm**. Module boundaries enforced via `@nx/enforce-module-boundaries` — domain libs are pure TypeScript, framework-agnostic, and fully unit-testable in isolation.

Platform-level technology decisions (monorepo tool, TypeScript/Node versions, linting,
mock-backend strategy, hosting, CI/CD) are recorded in
[`specs/tdr/TDR-PLATFORM-001.yaml`](specs/tdr/TDR-PLATFORM-001.yaml).

---

## Project status

Platform baseline bootstrap (DevOps Mode 1): monorepo tooling, workspace structure, and shared
lib scaffolding are in place. `apps/clearline-web` is a placeholder until `TDR-CW-WEB-001`
selects the frontend framework — `pnpm nx run clearline-web:*` targets are not wired up yet.

The Clearline design system (`libs/design-tokens`, `libs/icons`, `libs/ui`) is built and fully
tested/storied — see [EPIC-CW-000](specs/epics/clearline-web/EPIC-CW-000.yaml)/

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

# once an app has real targets:
pnpm nx run clearline-web:dev

# Clearline design system — browse the component library
pnpm nx run ui:storybook

# test everything
pnpm nx run-many --target=test --all
```

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
pnpm --filter @fintech-portfolio/design-tokens generate

# after editing libs/icons/icons.source.json
pnpm --filter @fintech-portfolio/icons generate
```

---

## AI usage

AI tools (Claude, GitHub Copilot) are used throughout this repo — from initial research and architecture planning through design, scaffolding, and code generation. This is a deliberate workflow choice: AI accelerates the work without replacing the engineering judgment behind it. Domain invariants, architectural decisions, state machine design, and review of all AI-generated output are human-owned.
