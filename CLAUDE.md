# brabo-contracts

Contratos compartilhados: `packages/shared` (tipos), `packages/docker-port` (porta de Docker e adaptador de CLI) e `packages/contracts` (`areas.json`, `fluxo.yml`). Pnpm workspace TypeScript com `dist`, publicado no GitHub Packages pela tag (ADR 0270).

> Partido do `CLAUDE.md` do monorepo `daneiel/brabo` (hoje `brabo-legacy`, `dev` @ `1586158973`) na AT-708 (EP-033, ADR 0252). Copiado, não resumido: o que era de outro repo foi cortado e os caminhos do monorepo viraram a raiz deste repo (ou `brabo-<x>:caminho`). Caminhos sem prefixo que não existem aqui (`docker/`, `deploy/`, `install.sh`, `e2e/`, `scripts/dev/`, `scripts/ci/` fora do `brabo-ci`) moram no `brabo-infra`, no `brabo-qa` ou no `brabo-ci`. O resto das regras mora no `CLAUDE.md` da pasta-mãe (`brabo-workspace`, clonado em `~/dev/brabo/CLAUDE.md`) e no de cada repo irmão.

## Stack (decidida — não proponha alternativas)
- `brabo-contracts`: pnpm workspace TS com `dist`, publicado no GitHub Packages pela tag (ADR 0270, que revisa o item 2 da ADR 0252). Os pacotes são `@viralabs-dev/brabo-shared` e `@viralabs-dev/brabo-docker-port`, públicos, com a mesma versão (a da tag); o consumidor os importa por alias do pnpm (`@brabo/shared`). Quem instala precisa de token (`read:packages`). O `publish.yml` chama o `publish-npm.yml` do `brabo-ci`; ninguém publica à mão.
- `packages/contracts/areas.json` é GERADO pelo `brabo-api` (`pnpm gerar:areas`); `fluxo.yml` e os dois pacotes moram aqui.

## Repositório, branches e PR (vale para todo repo `brabo-*`)
- Branches permanentes: dev, main — um branch, um ambiente; a esteira é
  `dev → main`. A `qa` foi APOSENTADA por hora (ADR 0235, só no repositório do
  Brabo; arquivada em `refs/archive/qa`, segue em `PROTECTED_BRANCHES` do
  produto e em `NUNCA_ARQUIVAR`). `rc` saiu
  da política (ADR 0030) e o bootstrap parou de criá-la, mas continua em
  `PROTECTED_BRANCHES` DE PROPÓSITO: a lista decide o que a trava de merge
  RECUSA, e repositórios bootstrapados por versões anteriores ainda têm a
  branch. Proteger uma branch que não existe não custa nada; desproteger
  uma que existe custa caro. Não "limpe" essa lista.
  Trabalho nasce de dev com a taxonomia da política (breaking/,
  feature/, bugfix/, perf/, refactor/, chore/, docs/, test/);
  hotfix/ nasce de main. Os AGENTES seguem a mesma régua desde a RN-664: o
  worktree do dev agent nasce de `dev`, a PR dele e a de ADR miram `dev`, e o
  gate julga o diff contra `dev` — os três juntos, nunca um só (o gate
  julgaria um diff que não é o da PR); repositório sem `dev` falha nomeado,
  sem queda para a default. A PR de INFRA (`open_infra_pr`) segue a
  mesma régua desde a RN-729: `feature/infra-setup` nasce de `dev`, mira `dev`
  e leva o autor `infra[bot]`. Formato funcao/descritivo,
  regex ^.{0,30}/\S{0,32}$. EXCEÇÃO nomeada: `dependabot/…` é branch
  PERMITIDA sem critério de caracteres (sem limite de tamanho, qualquer número
  de barras), mas só quando o AUTOR é o próprio Dependabot
  (`ehBranchDoDependabot` em `scripts/ci/pr-police.ts`) — humano com esse
  prefixo reprova em `FUNCAO-DESCONHECIDA`, senão o prefixo vira a porta para
  escapar do formato. Commits em conventional commits, pt-BR.
  A FUNÇÃO da branch decide a VERSÃO (scripts/ci/version.ts): breaking/
  sobe MAJOR, feature/ sobe MINOR, todo o resto é PATCH. Mudança que
  exige ação do operador antes do deploy nasce em breaking/ mesmo quando
  o conteúdo é correção — o v2.5.1 saiu patch porque a chave obrigatória
  do OAuth nasceu em bugfix/, e um patch diz "atualize sem pensar".
  Versão não se corrige à mão depois: o valor de ela ser calculada vem de
  não ser negociada caso a caso.
- Toda mudança entra por PR — push direto em permanente é bloqueado;
  únicas exceções de push: tags (bot de release) e .release/gate.json
  (bot do gate).
- Toda branch cujo PR é mergeado é ARQUIVADA automaticamente, SEM carência, por checagem
  SEMANAL (segunda 09:00 de Brasília, AT-661) (`.github/workflows/archive-merged-branch.yml`,
  AT-557): sem PR aberta e sem commit depois do merge; branch sem PR mergeada
  não é tocada — move de
  `refs/heads/<nome>` para `refs/archive/<nome>`, nunca apaga: histórico
  intacto, recuperável com um `git push` de volta. Exceções: dev/qa/main
  (aparecem como `head` de todo PR de promoção), `gh-pages` (deploy do
  site, não é branch de feature) e branch de fork. A política mora em
  `scripts/ci/archive-branch.ts` (testado), ver
  scripts/ci/docs/explanation/branching-policy.md, seção "Merged branches get
  archived".
- PR do Dependabot entra pela `dev`, nunca direto na `main`; na `dev` ele não espera aprovação humana (ADR 0236) e a `main` segue com a escada inteira. Dependência de linguagem só por segurança (`open-pull-requests-limit: 0`), `github-actions` e `docker` semanais, `target-branch: dev`. O `dependabot-para-dev.yml` do `brabo-ci` fecha ou redireciona o PR de segurança que o GitHub abre contra a `main`.
- Merge em branch protegida (`dev`/`main`) é SEMPRE manual do usuário, sem opção de automatizar. A política de PR, escada, promoção e carimbo de tag vem dos workflows reutilizáveis do `brabo-ci`, fixados por SHA com `# vX` no `uses:`. Imagem de terceiro por digest com a tag inline. Segredo nunca é impresso; teste nunca roda contra o Postgres da instalação.

## Convenções (repositório, dados e domínio)
- Branches permanentes: dev, main — um branch, um ambiente; a esteira é
  `dev → main`. A `qa` foi APOSENTADA por hora (ADR 0235, só no repositório do
  Brabo; arquivada em `refs/archive/qa`, segue em `PROTECTED_BRANCHES` do
  produto e em `NUNCA_ARQUIVAR`). `rc` saiu
  da política (ADR 0030) e o bootstrap parou de criá-la, mas continua em
  `PROTECTED_BRANCHES` DE PROPÓSITO: a lista decide o que a trava de merge
  RECUSA, e repositórios bootstrapados por versões anteriores ainda têm a
  branch. Proteger uma branch que não existe não custa nada; desproteger
  uma que existe custa caro. Não "limpe" essa lista.
  Trabalho nasce de dev com a taxonomia da política (breaking/,
  feature/, bugfix/, perf/, refactor/, chore/, docs/, test/);
  hotfix/ nasce de main. Os AGENTES seguem a mesma régua desde a RN-664: o
  worktree do dev agent nasce de `dev`, a PR dele e a de ADR miram `dev`, e o
  gate julga o diff contra `dev` — os três juntos, nunca um só (o gate
  julgaria um diff que não é o da PR); repositório sem `dev` falha nomeado,
  sem queda para a default. A PR de INFRA (`open_infra_pr`) segue a
  mesma régua desde a RN-729: `feature/infra-setup` nasce de `dev`, mira `dev`
  e leva o autor `infra[bot]`. Formato funcao/descritivo,
  regex ^.{0,30}/\S{0,32}$. EXCEÇÃO nomeada: `dependabot/…` é branch
  PERMITIDA sem critério de caracteres (sem limite de tamanho, qualquer número
  de barras), mas só quando o AUTOR é o próprio Dependabot
  (`ehBranchDoDependabot` em `scripts/ci/pr-police.ts`) — humano com esse
  prefixo reprova em `FUNCAO-DESCONHECIDA`, senão o prefixo vira a porta para
  escapar do formato. Commits em conventional commits, pt-BR.
  A FUNÇÃO da branch decide a VERSÃO (scripts/ci/version.ts): breaking/
  sobe MAJOR, feature/ sobe MINOR, todo o resto é PATCH. Mudança que
  exige ação do operador antes do deploy nasce em breaking/ mesmo quando
  o conteúdo é correção — o v2.5.1 saiu patch porque a chave obrigatória
  do OAuth nasceu em bugfix/, e um patch diz "atualize sem pensar".
  Versão não se corrige à mão depois: o valor de ela ser calculada vem de
  não ser negociada caso a caso.

## Convenções (agentes, telas e testes)
- A lista de áreas tem UMA fonte —
  `brabo-api:src/domain/agents/agent-areas.ts`. As cópias do web e do
  engine são GERADAS por `pnpm --filter api gerar:areas` e reprovam em
  teste se estiverem velhas; nunca as edite à mão (FASE 18). O mesmo
  gerador escreve `SOLO_CONVERSATIONAL_AGENTS` (RN-440) SÓ no web, porque
  o engine não a lê — não o estenda para lá sem consumidor. Área nova
  continua sendo decisão de produto, com ADR. A lista é o CATÁLOGO; a
  tabela `agent_areas` é o ESTADO por projeto, e nasce com ele (RN-094).
- `docs/fluxo.yml` é a terceira peça do modelo de time, ao lado do
  CATÁLOGO (`agent-areas.ts`) e do CONTROLE (`docs/gates.yml`, ADR
  0054): declara as RELAÇÕES entre papéis — quem entrega o quê a quem
  (ADR 0085). Papel `proposto` diz quem o absorve hoje e o critério
  objetivo de separação; o docmap cobre mudança em `agent-areas.ts`/
  `gates.yml` só em `warn`, até existir o teste de cruzamento entre os
  três (backlog).

## Docker-port
- `packages/docker-port`: a porta de Docker e o adaptador de CLI, consumidos
  por `brabo-runner` e `brabo-broker`. Runtime, e por isso NÃO cabe em
  `packages/shared` (100% tipo, invariante travado por teste: o `dist` do
  `shared` não exporta valor, RN-1037). Tem build (`tsc -p tsconfig.build.json`
  gera `dist` com `.js` e `.d.ts`) e é publicado como
  `@viralabs-dev/brabo-docker-port` (ADR 0270). O motivo técnico antigo da
  proibição à api (type stripping do Node dentro de `node_modules`) deixou de
  existir, mas a regra continua: só o broker fala com o socket do Docker, e a
  api NÃO consome o `docker-port` (`test/api-nao-consome-docker-port.spec.ts`
  na api).
- `packages/contracts/docker-cli.json` espelha `CHAMADAS_DE_CONTROLE_NO_START` e
  `TIMEOUT_DE_CONTROLE_MS` do `docker-cli.ts`, para o engine (Elixir) ler por
  raw na tag; um spec trava a igualdade (RN-1041).

## Documentação é parte da definição de pronto (permanente)
- A doc deste repo mora em `docs/` e é em pt-BR (decisão do dono, 06/11/2026, que reverte a ADR 0260 e a AT-745), sem `docs/i18n/`: só o `brabo` é multilíngue. Ao alterar código, atualize a doc da área NA MESMA mudança e mostre o diff dela junto com o do código. Não pergunte se deve: faça. NUNCA crie `website/docs/`: o site é agregado pelo `brabo`, que lê a `docs/` de cada repositório.
- Mudança de comportamento observável → entrada em `CHANGELOG.md` (Unreleased). Versão própria a partir da 1.0.0, e toda tag nasce de workflow (nunca versionar à mão).
- Regra de negócio nova → RN-XXX com `caminho:N` (`símbolo`) e o teste que a cobre, na `docs/business-rules*` deste repo; a numeração é UMA só no produto (nunca reinicie), a âncora `{#rn-NNN}` é o contrato e não muda quando a RN muda de arquivo. Aloque o número varrendo as branches locais e o remoto (colide com frente paralela).
- Mudança estrutural (fronteira de camada, banco, modelo de consistência, dependência pesada) → ADR novo com o próximo número; ADR aceito NUNCA é editado (o novo o referencia). Os ADRs moram no repo `brabo` (a porta de entrada do produto).
- Nunca inventar conteúdo de doc: sem informação suficiente, use `> **TODO(humano):** <pergunta específica>.`. Diagramas em Mermaid no próprio Markdown, nunca imagem.
- Este arquivo também é doc: toda mudança verifica se ele precisa mudar (Stack, convenções, "O que NÃO fazer"). Ele é lido em toda sessão e não passa de 40 mil caracteres (`wc -m`, nunca `wc -c`); o que só vale para uma área sai daqui para `.claude/rules/` com `paths:`.

## O que NÃO fazer
- Nunca fixe consumo em branch: sempre por tag. Mudou `areas.json` ou `fluxo.yml`: corte tag nova e os consumidores conferem a cópia contra ela.
