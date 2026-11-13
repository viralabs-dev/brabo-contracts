import { describe, expect, it } from 'vitest';
import {
  CAMINHOS_SONDADOS_NA_PROVA,
  LIMITES_DA_PROVA_DE_COMPOSE,
  nomeDoProjetoDeCompose,
} from './prova-de-compose.ts';

describe('prova de compose', () => {
  it('limites são os do dono: 10 min, 4 GB, uma por projeto', () => {
    expect(LIMITES_DA_PROVA_DE_COMPOSE).toEqual({
      tempoMaximoMs: 600_000,
      discoMaximoBytes: 4_294_967_296,
      provasSimultaneasPorProjeto: 1,
    });
  });
  it('sonda /docs e /openapi.json', () => {
    expect([...CAMINHOS_SONDADOS_NA_PROVA]).toEqual(['/docs', '/openapi.json']);
  });
  it('nome do projeto compose descartável', () => {
    expect(nomeDoProjetoDeCompose('meu-app', 'ab12cd34')).toBe('brabo-qa-compose-meu-app-ab12cd34');
  });
});
