# @clearline/ui

The **Clearline design system** — a React component library styled with Tailwind CSS v4 against
[`@clearline/design-tokens`](../design-tokens)' `--cl-*` custom properties, with
[Radix](https://www.radix-ui.com/) (`radix-ui`) backing the interactive/accessible primitives.
Icons come from [`@clearline/icons`](../icons); money formatting from [`@clearline/money`](../util/money).

Components are built tier-by-tier — **foundations → atoms → molecules → organisms** — and every
export is documented in Storybook with an `.mdx` doc page and `.stories.tsx`, and covered by a
`.test.tsx`.

**Browse the component library (deployed Storybook):** <https://clearline-component-library.vercel.app>

## Usage

```tsx
import { Button, MoneyDisplay, DataTable } from '@clearline/ui';

<Button variant="primary" icon="plus">
  New card
</Button>;
```

Importing from the package once pulls in `styles.css` (see [`src/index.ts`](src/index.ts:1)), which
`@import`s Tailwind and the design-token theme. The consuming app is responsible for loading the
**Geist / Geist Mono** fonts — the library only declares the `--font-cl-ui` family token, not the
`@font-face`/link tags.

## Component tiers

Everything is re-exported flat from [`src/index.ts`](src/index.ts) — the tier is an authoring
convention, not part of the import path.

- **foundations** — `Icon`, `StatusBadge`, `MoneyDisplay`, `BudgetGauge`
- **atoms** — `Text`, `Button`, `TextField`, `PasswordField`, `Alert`, `Toast`,
  `SegmentedControl`, `Select`, `Avatar`, `Chip`, `ProgressBar`, `Checkbox`, `Container`
- **molecules** — `VirtualCard`, `TransactionRow`, `AlertModal`, `AuthNotice`,
  `PasswordRequirementsList`, `ConfirmationDialog`, `RejectReasonDialog`, `OtpInput`, `Modal`,
  `InactivityWarningModal`, `DocumentDropzone`, `Timeline`, `Stepper`, `NavItem`, `AIInsightCard`
- **organisms** — `EmptyState`, `AccessDenied`, `NavigationShell`, `BulkActionResult`, `DataTable`,
  `AppShell`, `AuthLayout`

Also exported: the `formatMoney` / `formatMoneyValue` helpers.

## Anatomy of a component

Each component lives in its own folder under its tier, e.g. [`src/atoms/Button/`](src/atoms/Button):

```text
Button/
  Button.tsx           # component + exported prop/variant types
  Button.stories.tsx   # Storybook stories
  Button.mdx           # Storybook docs page
  Button.test.tsx      # Vitest + Testing Library
  index.ts             # local barrel
```

Props follow a consistent shape: a component spreads the native element's attributes and layers
typed union props (`variant`, `tone`, `size`, `state`, …) on top — see
[`ButtonProps`](src/atoms/Button/Button.tsx:47). Styling is done with token-backed Tailwind classes
(`bg-cl-accent`, `text-cl-text`, `border-cl-border-2`) rather than hardcoded colors.

## Scripts

| Command                | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `pnpm storybook`       | Run Storybook locally on port 6006                |
| `pnpm build-storybook` | Build the static Storybook                        |
| `pnpm test`            | Run the Vitest suite                              |
| `pnpm test:coverage`   | Run tests with coverage                           |
| `pnpm test-storybook`  | Run the Storybook interaction/a11y test project   |
| `pnpm build`           | Build the library (Vite lib mode, ESM + `.d.ts`)  |
| `pnpm type-check`      | `tsc --noEmit`                                    |
| `pnpm lint`            | ESLint                                            |
| `pnpm chromatic`       | Publish to Chromatic for visual regression review |

Run any of these from `libs/ui`, or via Nx from the repo root
(e.g. `nx run @clearline/ui:test`).

## Build output

Vite builds the library as ESM only, with `react`, `react/jsx-runtime`, and `react-dom` externalized
and CSS emitted as a single non-split file (see [`vite.config.mts`](vite.config.mts)). Type
declarations are generated per-file by `vite-plugin-dts`.

## Testing utilities

- [`src/test-factories.ts`](src/test-factories.ts) — builders (`buildDataTableRow`, `buildTimelineEntry`, …)
  that replace hand-built fixture literals across tests.
- [`src/storybook-actions.ts`](src/storybook-actions.ts) — shared Storybook action helpers.
- [`src/fixtures/`](src/fixtures) — static asset fixtures (e.g. avatar headshots).

## Conventions

- **Design tokens only.** Colors, spacing, and typography reference `--cl-*` / `--font-cl-*` tokens
  via Tailwind classes — never hardcoded hex values — so light/dark themes and rebrands flow from
  [`@clearline/design-tokens`](../design-tokens).
- **Accessibility.** Interactive primitives are backed by Radix; the Storybook a11y addon runs on
  every story.
- **Every new component ships `.stories.tsx` + `.mdx`** alongside its implementation and tests.
