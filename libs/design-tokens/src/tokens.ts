// GENERATED FILE — do not edit by hand.
// Source: tokens.source.json (a copy of clearline-tokens.json).
// Regenerate with: pnpm --filter @fintech-portfolio/design-tokens generate

export const semanticTokens = {
  bg: { cssVar: '--cl-bg', role: 'App background', light: '#f5f6f8', dark: '#0b0d11' },
  surface: {
    cssVar: '--cl-surface',
    role: 'Card / panel surface',
    light: '#ffffff',
    dark: '#14171d',
  },
  'surface-2': {
    cssVar: '--cl-surface-2',
    role: 'Inset surface, toggles, chips',
    light: '#f0f2f5',
    dark: '#1b1f27',
  },
  inset: {
    cssVar: '--cl-inset',
    role: 'Recessed wells, table headers',
    light: '#f7f8fa',
    dark: '#11141a',
  },
  border: {
    cssVar: '--cl-border',
    role: 'Default hairline border',
    light: '#e4e7eb',
    dark: '#272c35',
  },
  'border-2': {
    cssVar: '--cl-border-2',
    role: 'Stronger border, inputs',
    light: '#d3d8df',
    dark: '#363c47',
  },
  text: { cssVar: '--cl-text', role: 'Primary copy', light: '#161a20', dark: '#e8ebf0' },
  'text-2': { cssVar: '--cl-text-2', role: 'Secondary copy', light: '#586070', dark: '#a0a8b5' },
  'text-3': {
    cssVar: '--cl-text-3',
    role: 'Tertiary / muted labels',
    light: '#8b929e',
    dark: '#6c7480',
  },
  accent: {
    cssVar: '--cl-accent',
    role: 'Primary actions, links, focus',
    light: '#3b6cf6',
    dark: '#5b85f8',
  },
  'accent-2': {
    cssVar: '--cl-accent-2',
    role: 'Accent hover / pressed',
    light: '#2f5ce0',
    dark: '#7398fa',
  },
  'accent-weak': {
    cssVar: '--cl-accent-weak',
    role: 'Accent tint background',
    light: '#ecf1fe',
    dark: '#172240',
  },
  'accent-text': {
    cssVar: '--cl-accent-text',
    role: 'Accent text on tint',
    light: '#2a55cc',
    dark: '#9fb8fb',
  },
  pos: { cssVar: '--cl-pos', role: 'Credits, gains, matched', light: '#15805a', dark: '#4ec78a' },
  'pos-weak': {
    cssVar: '--cl-pos-weak',
    role: 'Positive tint background',
    light: '#e4f3eb',
    dark: '#11271d',
  },
  neg: {
    cssVar: '--cl-neg',
    role: 'Debits, declines, over-limit',
    light: '#c0392b',
    dark: '#f1746c',
  },
  'neg-weak': {
    cssVar: '--cl-neg-weak',
    role: 'Negative tint background',
    light: '#fbeae8',
    dark: '#2a1411',
  },
  pending: {
    cssVar: '--cl-pending',
    role: 'In-flight, awaiting action',
    light: '#2a55cc',
    dark: '#9fb8fb',
  },
  'pending-weak': {
    cssVar: '--cl-pending-weak',
    role: 'Pending tint background',
    light: '#ecf1fe',
    dark: '#172240',
  },
  warn: {
    cssVar: '--cl-warn',
    role: 'Policy flags, 80% budget',
    light: '#9a5b00',
    dark: '#e2ab43',
  },
  'warn-weak': {
    cssVar: '--cl-warn-weak',
    role: 'Warning tint background',
    light: '#fbf0db',
    dark: '#291f0e',
  },
  crit: {
    cssVar: '--cl-crit',
    role: 'Over budget, fatal errors',
    light: '#b3231b',
    dark: '#f1746c',
  },
  'crit-weak': {
    cssVar: '--cl-crit-weak',
    role: 'Critical tint background',
    light: '#fce9e7',
    dark: '#2a1411',
  },
  paid: { cssVar: '--cl-paid', role: 'Settled / paid state', light: '#0e6e8c', dark: '#43b8d6' },
  'paid-weak': {
    cssVar: '--cl-paid-weak',
    role: 'Paid tint background',
    light: '#e3f3f7',
    dark: '#0c2730',
  },
  recon: { cssVar: '--cl-recon', role: 'Reconciled state', light: '#5a3ec8', dark: '#a48bf5' },
  'recon-weak': {
    cssVar: '--cl-recon-weak',
    role: 'Reconciled tint background',
    light: '#efebfd',
    dark: '#1d1640',
  },
  focus: { cssVar: '--cl-focus', role: 'Focus ring', light: '#3b6cf6', dark: '#5b85f8' },
} as const;

export type SemanticToken = keyof typeof semanticTokens;

export const primitiveTokens = {
  neutral: {
    '0': '#ffffff',
    '50': '#f7f8fa',
    '100': '#eef0f3',
    '200': '#e1e5ea',
    '300': '#c8cdd6',
    '400': '#9aa1ad',
    '500': '#6f7785',
    '600': '#4c545f',
    '700': '#333942',
    '800': '#1d2128',
    '900': '#0b0d11',
  },
  indigo: {
    '50': '#ecf1fe',
    '100': '#c9d8fc',
    '300': '#7da0f9',
    '500': '#3b6cf6',
    '600': '#2f5ce0',
    '800': '#1d3a9e',
  },
  green: { '50': '#e4f3eb', '300': '#a7dabd', '600': '#15805a' },
  red: { '50': '#fbeae8', '300': '#eaa39b', '600': '#c0392b' },
  amber: { '50': '#fbf0db', '300': '#ecc77f', '600': '#9a5b00' },
  teal: { '50': '#e3f3f7', '300': '#7fc6d6', '600': '#0e6e8c' },
} as const;

export const typography = {
  fontFamilies: { ui: "'Geist', system-ui, sans-serif", mono: "'Geist Mono', monospace" },
  scale: {
    display: { size: 34, weight: 600, letterSpacing: '-0.02em', family: 'ui' },
    title: { size: 22, weight: 600, letterSpacing: '-0.01em', family: 'ui' },
    heading: { size: 16, weight: 600, letterSpacing: '0', family: 'ui' },
    body: { size: 14, weight: 400, letterSpacing: '0', family: 'ui' },
    label: { size: 12.5, weight: 500, letterSpacing: '0', family: 'ui' },
    mono: { size: 11.5, weight: 400, letterSpacing: '0.02em', family: 'mono', tabularNums: true },
  },
} as const;

export const radii = { sm: 5, md: 7, lg: 8, xl: 11, '2xl': 12, '3xl': 14, pill: 999 } as const;

export const a11yRules = {
  minContrastText: 4.5,
  focusRing: '3px solid var(--cl-focus)',
  minTouchTargetPx: 44,
  statusEncoding: 'icon + text + color (never color alone)',
} as const;
