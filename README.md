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
    clearline-web/       # placeholder — frontend framework TBD (TDR-CLEARLINE-001)
  libs/                  # shared libraries — domain logic, UI, data-access, utilities
    design-tokens/       # shared Tailwind v4 theme/tokens
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
lib scaffolding are in place. `apps/clearline-web` is a placeholder until `TDR-CLEARLINE-001`
selects the frontend framework — `pnpm nx run clearline-web:*` targets are not wired up yet.

---

## Running locally

```bash
pnpm install

# once an app has real targets:
pnpm nx run clearline-web:dev

# test everything
pnpm nx run-many --target=test --all
```

---

## AI usage

AI tools (Claude, GitHub Copilot) are used throughout this repo — from initial research and architecture planning through design, scaffolding, and code generation. This is a deliberate workflow choice: AI accelerates the work without replacing the engineering judgment behind it. Domain invariants, architectural decisions, state machine design, and review of all AI-generated output are human-owned.
