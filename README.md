# brabo-contracts

Contratos compartilhados do Brabo (ADR 0252): `packages/shared`, `packages/docker-port`
(só fonte TypeScript, sem build) e `packages/contracts` (`areas.json`, `fluxo.yml`).

## Consumir por TAG

```sh
pnpm add "git+https://github.com/viralabs-dev/brabo-contracts.git#v1.0.0&path:/packages/docker-port"
```

Troque `path:` por `/packages/shared` conforme o pacote. Use a forma `git+https://…`: com o
atalho `github:` o lockfile do runner perdeu o `path`, e o `--frozen-lockfile` do CI instalou o
repositório inteiro, sem o `src` do pacote. Os pacotes chegam como fonte TypeScript: com bundler
(Vite, tsup, Bun) isso é transparente; o Node puro recusa remover tipos de `.ts` dentro de
`node_modules`, e quem roda sem bundler precisa de um loader (o `brabo-runner` usa `module.registerHooks`). O Elixir baixa `areas.json` e
`fluxo.yml` da mesma tag. Nunca fixe em branch.

## De onde vem cada arquivo

- `packages/contracts/areas.json` é GERADO pelo `brabo-api` (`pnpm gerar:areas`, que escreve
  `contracts/areas.json` lá). Quando a lista de áreas mudar na api, copie o arquivo para cá e corte
  uma tag nova; web e engine conferem a cópia deles contra a tag.
- `packages/contracts/fluxo.yml`, `packages/shared` e `packages/docker-port` moram aqui.

## Desenvolver

`pnpm install && pnpm typecheck && pnpm test`. Branches permanentes: `dev` e `main`; tag só por workflow.
