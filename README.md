# brabo-contracts

Contratos compartilhados do Brabo (ADR 0252): `packages/shared`, `packages/docker-port`
(os dois publicados com `dist`), `packages/contracts` (`areas.json`, `fluxo.yml`, `docker-cli.json`) e
`packages/docs` (as RNs dos contratos, em pt-BR, que o `brabo` lê ao montar o site).

## Consumir o pacote

Os pacotes são `@viralabs-dev/brabo-shared` e `@viralabs-dev/brabo-docker-port`, públicos no GitHub
Packages (ADR 0270, que revisa o item 2 da ADR 0252). Saem juntos, com a mesma versão, a da tag:
`vX.Y.Z-dev.N` (dist-tag `dev`) a cada merge na `dev` e `vX.Y.Z` (`latest`) na `main`. A publicação
é só do workflow `publish.yml`, nunca à mão.

Mesmo público, o registry do GitHub exige token para instalar. O `.npmrc` do consumidor leva só o
registry; o token fica no `~/.npmrc` (PAT classic com `read:packages`) ou, no CI, no `GITHUB_TOKEN`:

```ini
@viralabs-dev:registry=https://npm.pkg.github.com
```

O consumidor fixa a versão exata e importa pelo alias do pnpm, sem mexer nos imports:

```json
"@brabo/shared": "npm:@viralabs-dev/brabo-shared@1.3.0",
"@brabo/docker-port": "npm:@viralabs-dev/brabo-docker-port@1.3.0"
```

O `shared` é só tipos (o `dist/index.js` sai vazio, RN-1037). O `docker-port` é ESM compilado.
O Elixir e o web baixam `areas.json`, `fluxo.yml` e `docker-cli.json` por raw, na mesma tag.
Nunca fixe numa branch.

## De onde vem cada arquivo

- `packages/contracts/areas.json` é GERADO pelo `brabo-api` (`pnpm gerar:areas`, que escreve
  `contracts/areas.json` lá). Quando a lista de áreas muda na api, copie o arquivo para cá e corte
  uma tag nova; a web e a engine conferem a cópia delas contra a tag.
- `packages/contracts/fluxo.yml`, `packages/shared`, `packages/docker-port` e `packages/docs`
  moram aqui.

## Desenvolver

`pnpm install && pnpm -r build && pnpm typecheck && pnpm test`. Branches permanentes: `dev` e `main`; tag só por
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
