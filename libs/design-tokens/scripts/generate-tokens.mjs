#!/usr/bin/env node
// Regenerates src/theme.css and src/tokens.ts from tokens.source.json.
// tokens.source.json (a copy of clearline-tokens.json) is the single input —
// edit it, then re-run `pnpm --filter @clearline/design-tokens generate`.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import prettier from 'prettier';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..');

async function writeFormatted(filePath, contents) {
  const config = (await prettier.resolveConfig(filePath)) ?? {};
  const formatted = await prettier.format(contents, { ...config, filepath: filePath });
  writeFileSync(filePath, formatted);
}

const tokens = JSON.parse(readFileSync(path.join(root, 'tokens.source.json'), 'utf8'));

const semanticEntries = Object.entries(tokens.color.semantic);

function cssBlock(themeKey) {
  return semanticEntries.map(([, def]) => `  ${def.cssVar}: ${def[themeKey]};`).join('\n');
}

function themeAliasBlock() {
  return semanticEntries
    .map(([, def]) => `  --color-${def.cssVar.replace('--', '')}: var(${def.cssVar});`)
    .join('\n');
}

const radiusEntries = Object.entries(tokens.radii).map(
  ([name, px]) => `  --radius-cl-${name}: ${px === 999 ? '9999px' : `${px}px`};`,
);

const fontEntries = Object.entries(tokens.typography.fontFamilies).map(
  ([name, value]) => `  --font-cl-${name}: ${value};`,
);

const theme = `/*
 * GENERATED FILE — do not edit by hand.
 * Source: tokens.source.json (a copy of clearline-tokens.json).
 * Regenerate with: pnpm --filter @clearline/design-tokens generate
 */

:root,
[data-theme='light'] {
${cssBlock('light')}
}

[data-theme='dark'] {
${cssBlock('dark')}
}

@theme inline {
${themeAliasBlock()}
${radiusEntries.join('\n')}
${fontEntries.join('\n')}
}
`;

await writeFormatted(path.join(root, 'src/theme.css'), theme);

function tsLiteral(value) {
  return JSON.stringify(value);
}

const semanticTsEntries = semanticEntries
  .map(
    ([key, def]) =>
      `  '${key}': { cssVar: ${tsLiteral(def.cssVar)}, role: ${tsLiteral(def.role)}, light: ${tsLiteral(
        def.light,
      )}, dark: ${tsLiteral(def.dark)} },`,
  )
  .join('\n');

const primitiveTsEntries = Object.entries(tokens.color.primitives)
  .map(([ramp, shades]) => `  ${ramp}: ${tsLiteral(shades)},`)
  .join('\n');

const ts = `// GENERATED FILE — do not edit by hand.
// Source: tokens.source.json (a copy of clearline-tokens.json).
// Regenerate with: pnpm --filter @clearline/design-tokens generate

export const semanticTokens = {
${semanticTsEntries}
} as const;

export type SemanticToken = keyof typeof semanticTokens;

export const primitiveTokens = {
${primitiveTsEntries}
} as const;

export const typography = ${tsLiteral(tokens.typography)} as const;

export const radii = ${tsLiteral(tokens.radii)} as const;

export const a11yRules = ${tsLiteral(tokens.a11y)} as const;
`;

await writeFormatted(path.join(root, 'src/tokens.ts'), ts);

// eslint-disable-next-line no-console
console.log('Generated theme.css and tokens.ts from tokens.source.json');
