# Changelog

## Unreleased

- Doc (AT-1028): as duas refs de `packages/docs/business-rules/contracts.md` para `engine_api_client.ex` (`opcoes_do_propose_action`) seguem o código depois da AT-1021 (só números de linha).

- Doc (AT-1028): as refs de `packages/docs/business-rules/contracts.md` para `docker-cli.ts`, `spec-de-container.ts`, `docker-port.ts` e arquivos da api/engine voltam a bater com as linhas da `dev`.

- Feature (AT-1015, MINOR, RN-1518): a spec de trabalho do `docker-port` ganha `servicos` (os não compartilhados do `run.qa.services`, mesma régua do `qa.servicos`) e `env` (variáveis de conexão, como `DATABASE_URL`, também aceitas na spec da instância de QA). Os serviços sobem em `--network container:<trabalho>` (o mesmo `localhost`), com dados em `tmpfs`; `stop`, `remove` e a recriação do trabalho os levam junto, e declarar serviço muda o `brabo.spec.hash`. Aditiva: sem os campos novos o `run` e o hash são os de antes.

- Doc (AT-1011): as 10 refs empatadas de `packages/docs/business-rules/contracts.md` seguem o símbolo (`argsDeCriacao`, `iniciarQa`, `argsDeServicoDeQa` e outros).

- Doc (AT-1011): as refs com número de linha de `packages/docs/business-rules/contracts.md` voltam a bater com o código, e a RN-1050 daqui vira RN-1502, porque o `brabo-ci` já tinha uma RN-1050 (a do ciclo de dependências, de 08/11; esta nasceu em 18/11). Só documentação; não muda código nem contrato.

- Breaking de consumo (AT-980, MINOR): o `start` do `docker-port` não religa mais container que nunca rodou (`created`) nem o de spec velha: recria (`rm --force` + `run`) e devolve `ContainerIniciado.recriado`. O `run` grava `brabo.spec.hash` (sha256 dos argumentos) e o `run` que falha remove o `Created` que deixou. A `DockerPort` ganha `recursosDoHost()` (portas publicadas de todo container `running`, só o número para os de terceiros, mais containers e redes `brabo.managed` por projeto) e `removerPorProjeto(projectId)` (remove por rótulo, containers e depois redes). A rede de QA ganha o rótulo `brabo.project.id`. `CHAMADAS_DE_CONTROLE_NO_START` vai de 6 para 9 (api e engine derivam o teto daí). Quem implementa `DockerPort` ou monta `ContainerIniciado` precisa dos campos novos.

- Feature (AT-922): `docker-port` ganha `ProvaDeComposePort.provaDeCompose` (porta separada, só o broker implementa), o resultado `{ subiu, sondas, recusas?, origem }` e os limites como dado (`LIMITES_DA_PROVA_DE_COMPOSE`: 10 min, 4 GB, 1 por projeto). Mudança aditiva (MINOR); o runner não é afetado.

- CI: repina o brabo-ci na release final `v1.4.0` (`5320046`), para a promoção `dev → main` de 09/11/2026 (a `main` só aceita release final).

- Doc (AT-868): os 41 links das páginas de RN que apontavam para docs de outro repo (`../adr/…`, `api.md`) viram URL do arquivo no GitHub do repo dono, na `dev`. No site continuam relativos.
- CI (AT-873): repina os reutilizáveis do `brabo-ci` em `a571e82` (`v1.4.0-dev.28`, ci#63), que linka cada repo na tabela "Onde se encaixa" do mapa. Este README não tem o bloco do mapa.

- Docs (AT-867): a linha de badges logo abaixo do título mostra o CI da `dev` e o da `main`, a versão da `dev` (última tag `-dev`), licença MIT, documentação e Ko-fi, no estilo do `brabo` Sem release publicada, o badge de versão da `main` não entra.

- Docs (AT-848): o bloco do mapa do README é regenerado do `repos.yml` do brabo, que ganha a aresta `brabo → brabo-contracts` e a prova em `{arquivo, trecho}` (`mapa-alinhado` volta a bater).
- CI: repina todos os `uses:` e `ci_ref` do `brabo-ci` em `6390ef5` (`v1.4.0-dev.17`, ci#53), que aceita a prova `{arquivo, trecho}` do `mapa-dos-repos.ts`; o pin antigo dá `throw` no formato novo e o `mapa-alinhado` quebra.
- Doc (AT-845): a ref `apps/engine/lib/engine/sessions/engine_api_client.ex` (`opcoes_do_propose_action`) de `packages/docs/business-rules/contracts.md` passa de `:1985` para `:2006`, a linha atual no `brabo-engine` `dev`. Não muda código nem contrato.
- Doc: o `README.md` segue o esqueleto didático de 8 seções do brabo-ci (AT-826), com o bloco do mapa gerado do `repos.yml` do brabo (AT-825). "Consumir o pacote" vira "Como é usado"; o exemplo de instalação usa a versão final `1.2.0` (a `1.3.0` citada antes não existe). Não muda código nem contrato.
- CI: o `readme.yml` chama o `readme-esqueleto` e o `mapa-alinhado` do `brabo-ci`, pinados em `b5df60b` (`v1.4.0-dev.14`). São informativos, não exigidos pelo ruleset.

- CI: o check `Dependências de merge` (AT-787) entra pelo `dependencias.yml`, que chama o reutilizável `dependencias-de-merge.yml` do `brabo-ci` pinado em `c6d9394` (`v1.4.0-dev.10`). A PR declara `Depende-de: viralabs-dev/<repo>#<n>` no corpo e o check fica amarelo (`esperando …`) até cada PR citada estar mergeada. Sem linha `Depende-de` o check fica verde ("Sem dependências declaradas"). Não é exigido por ruleset ainda.

- CI: o `ci.yml` chama o reutilizável `cadeia.yml` do `brabo-ci` (actionlint e pins, `ci_ref` obrigatório, AT-819) e repina todos os `uses:`, actions `vinculos` e `ci_ref` em `0a9eba8` (`v1.4.0-dev.5`, brabo-ci#39), com o comentário de versão no formato `vX.Y.Z-dev.N`. Perde o job `actionlint` copiado e o `.github/actionlint.yaml` (idêntico ao do brabo-ci).
- Regressivo por funcionalidade (AT-769, B6): CLAUDE.md ganha a regra do card (o contracts é consumido por TAG, então a PR daqui só avisa; o regressivo roda na PR que sobe a TAG) e o `analista.md` ganha o item do catálogo.
- Vínculos nos runs (AT-773, B5): o `publish.yml` ganha `run-name` (`publish {tag} ← tag do carimbo`) e um job `vinculos`, que lê a origem pela linha `Carimbo:` da mensagem da tag (o `publicar` é reutilizável, então não tem passo próprio para o Summary).
- CI: repina os reutilizáveis do `brabo-ci` em `13f3697` (merge da ci#17, que inclui a ci#16): `ubuntu-26.04`, `client-id` no lugar de `app-id`, rótulo de família criado antes de aplicar, linha `Carimbo:` na tag e helper `vinculos` (AT-772, AT-773).
- CI: todo `runs-on` fixa `ubuntu-26.04` no lugar de `ubuntu-latest`, e o `actionlint` conhece o rótulo (AT-772).

- Os pacotes viram lib no GitHub Packages (AT-770, ADR 0270, que revisa o item 2 da ADR 0252): `@viralabs-dev/brabo-shared` e `@viralabs-dev/brabo-docker-port`, públicos, com `dist` (`.js` + `.d.ts`), `exports` e a mesma versão, a da tag. `publish.yml` novo: a tag `v*` chama o `publish-npm.yml` do `brabo-ci` (SHA provisório, repinar no merge). O CI ganha `pnpm -r build` e `npm pack --dry-run`. Sem tag nem publicação à mão.
- `shared` continua só com tipos, agora travado pelo `dist`: spec novo falha se o `index.js` exportar valor (RN-1037).
- `packages/contracts/docker-cli.json` novo, para o engine ler as constantes de controle do `docker-cli.ts` por raw; spec trava o espelho (RN-1041).
- Doc: `README.md` e `CLAUDE.md` (Stack decidida e Docker-port) descrevem o consumo pelo pacote.

- Ko-fi do mantenedor: `.github/FUNDING.yml` (botão Sponsor) e seção Apoie no README (AT-768).

- Doc de volta ao pt-BR (decisão do dono, 06/11/2026, revertendo a ADR 0260; AT-766): `README.md` e `packages/docs/business-rules/contracts.md` em pt-BR, sem `idioma_original`, com as âncoras e as refs de código preservadas; o `README.md` passa a citar as tags estáveis (`v1.0.0`, `v1.1.0`) e a pré-release `v1.2.0-dev.N`, o `packages/docs`, a operação `reiniciarApp` e a seção "Repositórios do Brabo".
- `docker-port`: nova operação `reiniciarApp` / script `REINICIAR_APP` (RN-1024, AT-617): reinicia só o processo do app no lugar, sem tocar no container nem nos `exec`; resultado tipado `ResultadoDoReinicio` sem trecho de log. `SUPERVISOR_DO_APP` passa a gravar `/tmp/brabo-app.pid`. A porta passa de cinco para seis operações (a `DockerPort` ganha método abstrato: quem a implementa precisa de `reiniciarApp`).
- Doc: o `README.md` passou para o inglês (AT-745). Nenhuma tag é cortada aqui; o merge na `dev` a gera por workflow.
- `politica.yml` novo: `pr-police` e `escada` do `brabo-ci` pinados por SHA (AT-733); inclui a dispensa da PR do bot (ADR 0255).
- `tag.yml`: carimba as tags pelo `tag-release` do `brabo-ci` (App gera o token). Parte da `v1.0.0` existente; o próximo merge na `main` dá `v1.1.0` (esta PR é `feature/`).
- CI: job `actionlint`.
- `fluxo.yml`: o `dev-lead` ganha a saída `tarefa-de-fundacao` (`create_task`, RN-1006, ADR 0259; a api recusa o plano sem ela, RN-1004) (AT-742).
- `packages/docs` (RNs de contratos e traduções, AT-693) passa a morar aqui, com o histórico da fonte; o `brabo` o busca daqui ao montar o layout.
- `packages/docs` passou a ser só em inglês (AT-745): a fonte das RNs virou inglês com `idioma_original: en`, e a `docs/i18n/` (en, ru, zh-Hans) saiu.

## v1.0.0

- Extração de `packages/shared`, `packages/docker-port` e `packages/contracts` do monorepo `daneiel/brabo` (AT-694, ADR 0252), com o histórico dos caminhos.
