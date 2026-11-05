# Changelog

## Unreleased

- `politica.yml` novo: `pr-police` e `escada` do `brabo-ci` pinados por SHA (AT-733); inclui a dispensa da PR do bot (ADR 0255).
- `tag.yml`: carimba as tags pelo `tag-release` do `brabo-ci` (App gera o token). Parte da `v1.0.0` existente; o próximo merge na `main` dá `v1.1.0` (esta PR é `feature/`).
- CI: job `actionlint`.
- `fluxo.yml`: o `dev-lead` ganha a saída `tarefa-de-fundacao` (`create_task`, RN-1006, ADR 0259; a api recusa o plano sem ela, RN-1004) (AT-742).

## Unreleased

- `packages/docs` (RNs de contratos e traduções, AT-693) passa a morar aqui, com o histórico da fonte; o `brabo` o busca daqui ao montar o layout.

## v1.0.0

- Extração de `packages/shared`, `packages/docker-port` e `packages/contracts` do monorepo `daneiel/brabo` (AT-694, ADR 0252), com o histórico dos caminhos.
