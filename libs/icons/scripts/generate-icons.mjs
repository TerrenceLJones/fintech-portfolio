#!/usr/bin/env node
// Regenerates src/icon-registry.ts from icons.source.json.
// icons.source.json (a copy of clearline-icons.json) is the single input —
// edit it, then re-run `pnpm --filter @fintech-portfolio/icons generate`.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import prettier from 'prettier';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..');

const source = JSON.parse(readFileSync(path.join(root, 'icons.source.json'), 'utf8'));
const names = Object.keys(source.icons);

const entries = names
  .map((name) => `  '${name}': ${JSON.stringify(source.icons[name])},`)
  .join('\n');

const nameUnion = names.map((name) => `  | '${name}'`).join('\n');

const ts = `// GENERATED FILE — do not edit by hand.
// Source: icons.source.json (a copy of clearline-icons.json).
// Regenerate with: pnpm --filter @fintech-portfolio/icons generate

export interface IconDefinition {
  viewBox: string;
  sw: number;
  body: string;
}

export type IconName =
${nameUnion};

export const iconRegistry: Record<IconName, IconDefinition> = {
${entries}
};
`;

const config = (await prettier.resolveConfig(path.join(root, 'src/icon-registry.ts'))) ?? {};
const formatted = await prettier.format(ts, { ...config, filepath: 'icon-registry.ts' });
writeFileSync(path.join(root, 'src/icon-registry.ts'), formatted);

// eslint-disable-next-line no-console
console.log(`Generated icon-registry.ts with ${names.length} icons from icons.source.json`);
