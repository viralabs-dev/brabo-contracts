# brabo-contracts

Contratos compartilhados do Brabo (ADR 0252): `packages/shared`, `packages/docker-port`
(só fonte TypeScript, sem build), `packages/contracts` (`areas.json`, `fluxo.yml`) e
`packages/docs` (as RNs dos contratos, em pt-BR, que o `brabo` lê ao montar o site).

## Consumir por TAG

```sh
pnpm add "git+https://github.com/viralabs-dev/brabo-contracts.git#v1.1.0&path:/packages/docker-port"
```

As tags estáveis são `v1.0.0` e `v1.1.0`; a `dev` carimba pré-releases `v1.2.0-dev.N`
(ex.: `v1.2.0-dev.2`), que trazem a operação `reiniciarApp` do `docker-port` (RN-1024).
Troque o `path:` por `/packages/shared` conforme o pacote. Use a forma `git+https://…`: com o
atalho `github:` o lockfile do runner perdia o `path`, e o `--frozen-lockfile` do CI instalava o
repositório inteiro, sem o `src` do pacote. Os pacotes chegam como fonte TypeScript: com bundler
(Vite, tsup, Bun) isso é transparente; o Node puro recusa remover tipos de `.ts` dentro de
`node_modules`, e quem roda sem bundler precisa de um loader (o `brabo-runner` usa
`module.registerHooks`). O Elixir baixa o `areas.json` e o `fluxo.yml` da mesma tag. Nunca fixe
numa branch.

## De onde vem cada arquivo

- `packages/contracts/areas.json` é GERADO pelo `brabo-api` (`pnpm gerar:areas`, que escreve
  `contracts/areas.json` lá). Quando a lista de áreas muda na api, copie o arquivo para cá e corte
  uma tag nova; a web e a engine conferem a cópia delas contra a tag.
- `packages/contracts/fluxo.yml`, `packages/shared`, `packages/docker-port` e `packages/docs`
  moram aqui.

## Desenvolver

`pnpm install && pnpm typecheck && pnpm test`. Branches permanentes: `dev` e `main`; tag só por
workflow.

## Repositórios do Brabo

O Brabo é dividido em repositórios por camada (ADR 0252), e a documentação central está no
[brabo](https://github.com/viralabs-dev/brabo) e em https://viralabs-dev.github.io/brabo/prd/.

- **Depende de:** [brabo-ci](https://github.com/viralabs-dev/brabo-ci) (política de PR e
  carimbo das tags). Recebe o `areas.json` gerado pela
  [brabo-api](https://github.com/viralabs-dev/brabo-api).
- **É usado por:** [brabo-api](https://github.com/viralabs-dev/brabo-api),
  [brabo-broker](https://github.com/viralabs-dev/brabo-broker),
  [brabo-runner](https://github.com/viralabs-dev/brabo-runner),
  [brabo-web](https://github.com/viralabs-dev/brabo-web),
  [brabo-engine](https://github.com/viralabs-dev/brabo-engine),
  [brabo-infra](https://github.com/viralabs-dev/brabo-infra) e
  [brabo](https://github.com/viralabs-dev/brabo).

| Repositório | Papel |
| --- | --- |
| [brabo](https://github.com/viralabs-dev/brabo) | Porta de entrada: documentação central, instalador (`install.sh`) e release do produto. |
| [brabo-api](https://github.com/viralabs-dev/brabo-api) | API (NestJS, Drizzle, PostgreSQL com pgvector). |
| [brabo-engine](https://github.com/viralabs-dev/brabo-engine) | Engine (Elixir/OTP, Phoenix, Oban): agentes, gates, sessões e runners. |
| [brabo-web](https://github.com/viralabs-dev/brabo-web) | Interface web (React, Vite, TanStack, Tailwind). |
| [brabo-runner](https://github.com/viralabs-dev/brabo-runner) | CLI que roda na máquina do usuário e se conecta à engine. |
| [brabo-broker](https://github.com/viralabs-dev/brabo-broker) | Broker de containers: o único processo que fala com o Docker do servidor. |
| [brabo-contracts](https://github.com/viralabs-dev/brabo-contracts) | Contratos compartilhados (`shared`, `docker-port`, `contracts`). |
| [brabo-infra](https://github.com/viralabs-dev/brabo-infra) | Composes, Kubernetes, backup e restore, `docker-bake.hcl` e as aferições cruzadas. |
| [brabo-ci](https://github.com/viralabs-dev/brabo-ci) | Workflows reutilizáveis: política de PR, escada de aprovação, promoção e carimbo de versão. |
| [brabo-qa](https://github.com/viralabs-dev/brabo-qa) | Testes entre repositórios: E2E de navegador, golden-sets e instrumentos de medição. |
| [brabo-workspace](https://github.com/viralabs-dev/brabo-workspace) | Pasta-mãe que reúne os clones `brabo-*` lado a lado. |

## Apoie

Se o projeto te ajuda, você pode [pagar um café no Ko-fi](https://ko-fi.com/daneiel).
