# Changelog

## Unreleased

- `docker-port`: nova operação `reiniciarApp` / script `REINICIAR_APP` (RN-1024, AT-617): reinicia só o processo do app no lugar, sem tocar no container nem nos `exec`; resultado tipado `ResultadoDoReinicio` sem trecho de log. `SUPERVISOR_DO_APP` passa a gravar `/tmp/brabo-app.pid`. A porta passa de cinco para seis operações (a `DockerPort` ganha método abstrato: quem a implementa precisa de `reiniciarApp`).
- Docs: `README.md` is in English (AT-745). No tag is cut here; the merge into `dev` generates it by workflow.
- `politica.yml` novo: `pr-police` e `escada` do `brabo-ci` pinados por SHA (AT-733); inclui a dispensa da PR do bot (ADR 0255).
- `tag.yml`: carimba as tags pelo `tag-release` do `brabo-ci` (App gera o token). Parte da `v1.0.0` existente; o próximo merge na `main` dá `v1.1.0` (esta PR é `feature/`).
- CI: job `actionlint`.
- `fluxo.yml`: o `dev-lead` ganha a saída `tarefa-de-fundacao` (`create_task`, RN-1006, ADR 0259; a api recusa o plano sem ela, RN-1004) (AT-742).

## Unreleased

- `packages/docs` (RNs de contratos e traduções, AT-693) passa a morar aqui, com o histórico da fonte; o `brabo` o busca daqui ao montar o layout.
- `packages/docs` fica só em inglês (AT-745): a fonte das RNs é inglês com `idioma_original: en`, e `docs/i18n/` (en, ru, zh-Hans) sai.

## v1.0.0

- Extração de `packages/shared`, `packages/docker-port` e `packages/contracts` do monorepo `daneiel/brabo` (AT-694, ADR 0252), com o histórico dos caminhos.
