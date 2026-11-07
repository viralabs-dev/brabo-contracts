import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CHAMADAS_DE_CONTROLE_NO_START, TIMEOUT_DE_CONTROLE_MS } from './docker-cli.ts';

// RN-1041: `packages/contracts/docker-cli.json` espelha as constantes do `docker-cli.ts`.
// O engine (Elixir) baixa o JSON da tag e deriva daí o teto do `container_start`.
const json = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../contracts/docker-cli.json', import.meta.url)), 'utf8'),
) as Record<string, unknown>;

describe('docker-cli.json', () => {
  it('espelha as constantes do docker-cli.ts, e só elas', () => {
    expect(json).toEqual({
      CHAMADAS_DE_CONTROLE_NO_START,
      TIMEOUT_DE_CONTROLE_MS,
    });
  });
});
