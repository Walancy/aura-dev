import { describe, expect, it } from 'bun:test';
import { defaultVersionLabel, trimVersions, type VersionEntry } from '../src/components/design2/versions';

const v = (n: number): VersionEntry => ({ id: `v${n}`, label: `v${n}`, createdAt: n, shapeCount: n });

describe('versions', () => {
  it('mantém as mais recentes e informa as descartadas', () => {
    const { kept, dropped } = trimVersions([v(1), v(5), v(3), v(4), v(2)], 3);
    expect(kept.map((x) => x.id)).toEqual(['v5', 'v4', 'v3']);
    expect(dropped.map((x) => x.id)).toEqual(['v2', 'v1']);
  });

  it('rótulo padrão traz data e hora', () => {
    expect(defaultVersionLabel(new Date(2026, 9, 3, 14, 5))).toMatch(/^Versão 03\/10\/2026 14:05$/);
  });
});
