import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// RN-1037: o `dist` do `shared` não exporta valor. O `test` roda o build antes.
const dist = (nome: string) => fileURLToPath(new URL(`../dist/${nome}`, import.meta.url));

describe('dist do shared', () => {
  it('o index.js não exporta nenhum valor', async () => {
    expect(Object.keys(await import(dist('index.js')))).toEqual([]);
  });
  it('o index.js não tem declaração de valor', () => {
    const js = readFileSync(dist('index.js'), 'utf8');
    expect(js).not.toMatch(/\b(export\s+(const|let|var|function|class|enum|default)|module\.exports|exports\.)/);
  });
  it('o index.d.ts continua carregando os tipos', () => {
    expect(readFileSync(dist('index.d.ts'), 'utf8')).toContain('HealthStatus');
  });
});
