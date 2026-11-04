# brabo-contracts

Contratos compartilhados do Brabo (ADR 0252): `packages/shared`, `packages/docker-port`
(só fonte TypeScript, sem build) e `packages/contracts` (`areas.json`, `fluxo.yml`).

## Consumir por TAG

```sh
pnpm add "github:viralabs-dev/brabo-contracts#v1.0.0&path:/packages/docker-port"
```

Troque `path:` por `/packages/shared` conforme o pacote. O Elixir baixa `areas.json` e
`fluxo.yml` da mesma tag. Nunca fixe em branch.

## Desenvolver

`pnpm install && pnpm typecheck && pnpm test`. Branches permanentes: `dev` e `main`; tag só por workflow.
