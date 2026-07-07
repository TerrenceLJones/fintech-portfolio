import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { iconRegistry, type IconName } from './icon-registry';

// Pure-data guardrails for the generated registry. No DOM, no React — this
// package is framework-agnostic glyph data consumed by @clearline/ui's <Icon>
// (and, later, a react-native-svg renderer). See US-CW-022 AC-03.
//
// icons.source.json is read from disk at runtime (tests run in a node env)
// rather than statically imported: a JSON import would pull a file outside
// `rootDir` into the program and trip TS6059 under this package's composite
// build. Resolving via `path` on the file's own dir keeps it robust.
const sourcePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'icons.source.json',
);
const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as {
  count: number;
  icons: Record<string, unknown>;
};

describe('iconRegistry', () => {
  const names = Object.keys(iconRegistry) as IconName[];

  it('stays in sync with icons.source.json — same glyphs and declared count', () => {
    expect(names).toEqual(Object.keys(source.icons));
    expect(names).toHaveLength(source.count);
  });

  it('has a well-formed definition for every glyph', () => {
    for (const name of names) {
      const def = iconRegistry[name];
      expect(def.viewBox, `${name}.viewBox`).toMatch(/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/);
      expect(def.sw, `${name}.sw`).toBeGreaterThan(0);
      expect(def.body.trim().length, `${name}.body`).toBeGreaterThan(0);
    }
  });

  it('uses unique glyph names', () => {
    expect(new Set(names).size).toBe(names.length);
  });
});
