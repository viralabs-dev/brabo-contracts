---
id: rn-contracts
title: 'Business rules — Contracts'
sidebar_label: Contracts
description: 'The RNs hosted at the contracts root.'
keywords: [business rules, contracts]
idioma_original: en
---

# Contracts

## Git

### RN-028 — Capability decides, not the provider's name {#rn-028}

An unsupported operation (branch protection on the local provider) is declared in
`capabilities` and rejected with `GitNotSupportedError` — never a silent failure.

There are **four** capabilities: `protectBranch` and `pullRequests` since Phase 2, and
`listTree` and `pullRequestDiff` since PHASE 26 (Code tab, read-only). The rule
did not change with them — its scope did. And the criterion for declaring one stays
proof: a capability is only `true` when the suite exercises it on that provider; without
proof, it is declared `false` and degrades (same criterion as ADRs 0041/0042).

- **Where:** `packages/shared/src/index.ts` (`GitProviderCapabilities`); the
  ceilings of the two read operations in
  `apps/api/src/domain/git/git-read-limits.ts`, kept out of shared because it is
  100% type
- **Test:** single contract suite, `test/contract/git-provider.contract.ts`,
  run against the three providers
- **Origin:** [ADR 0001](../adr/0001-git-provider-contract-shape.md)

### RN-087 — The Dev Lead is the only external address of the execution {#rn-087}

There is a `dev-lead` agent, conversational, that receives the handoff from the Architect
(since [RN-672](api.md#rn-672), from Infra, with the project container
`running`) and proposes the **execution plan**: how many agents per module and why. It does not
write code — it distributes work and answers for it.

**Before it, the phrase "the lead decides" from [RN-083](api.md#rn-083) had no
owner.** The Architect finished and the execution started from a button, with nobody in the
middle to evaluate how much work there was.

**The `dev-<modulo>` agents stopped being addressable by handoff.** This is not a new
exception: it is the rule of [ADR 0038](../adr/0038-hierarquia-de-agentes.md) —
external handoff addresses only an area lead or an agent without an area — now applying
to the dev as it already applied to QA and Infra. While there was no Dev Lead, they were
agents WITHOUT an area and so were valid targets; once they become members, they stop being so.

**The `dev` area is the first DYNAMIC one**, and it is what forced the predicate: the
members are one per module of the `module_map`, decided by the Architect and
different in each project, so there is no list to enumerate. `dev-lead` matches the
same `dev-` prefix as the members, and what excludes it is the generic rule **the lead
is never a member of its own area** — which applies to any area and lives in one
single place. The first version repeated this exclusion in three points, and mutation
verification showed that none of the copies was reachable by a test: each one
survived the mutation of the others.

**The plan is `proposed_action` (revised by [ADR 0086](../adr/0086-dev-lead-plano-suspende-para-aprovacao.md), [RN-284](engine.md#rn-284)).**
Until that change the plan became a simple EVENT, with no approval: the argument was
that proposing has no external effect — the spending happens when the agents start,
and that is where the ceiling charges authorization; turning the proposal into an action to decide
would make you decide the same thing twice. An audit of
`packages/contracts/fluxo.yml` × code found that the flow had already declared this exit as
`via: proposed_action` since ADR 0085, and the code had never been adjusted to
match — the product owner decided the code was wrong: the plan is the FIRST real decision on how much the session will spend on parallelism, and the user
started deciding to enable execution having SEEN a real approval, not just read
a line in the thread. The old lesson did not disappear — it is the reason why
`propose_execution_plan` did NOT enter the block of absolute ceilings in
`decide.ts` (see RN-284).

**The SUCCESSFUL plan ends the turn — on the path WITHOUT suspension.** In the
first real execution the Dev Lead registered **two** `execution.plan_proposed`
events in the same session — different texts, same total —, because the loop went back
to the model and it proposed again. The event log is immutable: there were two proposals
and nothing saying which one was valid. The instruction "use it once" in the tool spec is a
request, not a guarantee; what guarantees it is the loop stopping. Since ADR 0086, when the
proposal stays `pending`, what ends the turn is the STOP by suspension
(RN-284) — the immediate success (`auto_approved`/`executed`/`approved`, see
RN-284) keeps closing the loop in the same way as always.

**Successful, and not "called the tool"**: a refused plan (empty, or with zero agents in a
module) lets the loop continue, otherwise the refusal becomes the end of the turn and
the model never gets to correct it. The first version of this guard looked only at the
tool name and had this defect — found by the behavioral test,
not by reading.

An empty plan, or one with zero agents in a module, is refused **before proposing
anything** — the proposal, once created, is a real decision by the user, and a half-proposed
plan would have no way to be represented.

- **Where:** `apps/engine/lib/engine/agents/dev_lead_server.ex` and
  `dev_lead_tools.ex`; the addressing rule in
  `apps/api/src/domain/agents/agent-areas.ts`; the handoff in
  `application/use-cases/agents/offer-infra-handoff.use-case.ts`
- **Test:** `apps/engine/test/engine/agents/dev_lead_tools_test.exs`,
  `dev_lead_server_test.exs` (`o plano ENCERRA o turno`, `o plano recusado NÃO
  encerra o turno`),
  `apps/api/test/domain/agents/agent-areas.spec.ts` (`o dev de módulo DEIXOU de
  ser endereçável`, `` `dev-lead` É endereçável, apesar do prefixo ``) and
  `test/application/use-cases/agents/offer-infra-handoff.use-case.spec.ts`
- **Origin:** [ADR 0053](../adr/0053-dev-lead-e-paralelismo-autorizado.md), FASE 14d;
  the approval mechanism revised by [ADR 0086](../adr/0086-dev-lead-plano-suspende-para-aprovacao.md)
### RN-110 — `blame` is the 13th operation of the `GitProviderContract`, with the same vocabulary of absence as the other reads {#rn-110}

Foundation of the blame pending declared in PHASE 26 (no screen consumes it
yet — it comes in the next wave). `blame(ref, path)` returns `GitBlame | null`,
with `null` meaning exactly what it already means in `getFileContent`/
`listTree`: the file is missing at that ref, or the ref does not exist. Two vocabularies of
"does not exist" for the same tab would make the screen handle the same case in
two ways — the same reason that already applied to the two previous operations.

Each provider computes it by its OWN means, because there is no common endpoint: GitHub
has no blame in REST (only GraphQL — the only operation of the provider that
speaks GraphQL), GitLab has `repository/files/:path/blame`, and the local one comes from
`git blame --porcelain`, the only one of the three tested against a real repository in
this session (the other two only against the fake backends of the contract test — with no
`GITHUB_TEST_TOKEN`/`GITLAB_TEST_TOKEN` in the environment, whoever proves it against the real
API is the manual smoke test). `GIT_BLAME_LINE_LIMIT` (2000) cuts a genuinely huge
file — already cut by bytes on the content route, but `blame` reads the whole file from the
provider before deciding.

- **Where:** `packages/shared/src/index.ts` (`BlameInput`, `GitBlame`,
  `GitBlameLine`, capability `blame`),
  `apps/api/src/infrastructure/git/{github,gitlab,local}-provider.ts`,
  `apps/api/src/domain/git/git-read-limits.ts` (`GIT_BLAME_LINE_LIMIT`),
  `apps/api/src/application/use-cases/git/read-project-code.use-case.ts`
  (method `blame`), `apps/api/src/interfaces/http/git/code.controller.ts`
  (`GET /projects/:id/code/blame`)
- **Test:** `apps/api/test/contract/git-provider.contract.ts` (block "blame"),
  exercised by the three provider specs — the one for `local` against real git — and
  `read-project-code.use-case.spec.ts` (block "blame")
- **Origin:** PHASE 26b (foundation of the pendings declared in PHASE 26/
  [ADR 0060](../adr/0060-superficie-de-leitura-de-codigo.md))

### RN-111 — `listPullRequests` is the 14th operation of the `GitProviderContract`; the browsable list opens the same diff by id {#rn-111}

`CodeDiffPanel.tsx` consumes `listPullRequests(state?)` in a clickable list
(id/number/title/author/state/branches, with a filter by state); clicking an
item reuses the SAME diff-by-id flow that already existed — there is no new read path,
only a way to ARRIVE at the id without needing to know it by heart. Whoever already knows the id
(e.g., it came from Approvals) can still paste it directly.

`listPullRequests(state?)` returns a SUMMARY per PR
(`GitPullRequestSummary`: id, number, title, author, state, branches,
`updatedAt`) — not `GitPullRequest`, which is the type for WRITING (open/merge) and
never had a title or author because neither of the two operations needed them. A
type of its own keeps the write from gaining fields only the read uses.

The `local` provider DOES have PRs — the sidecar store from Phase 4a is already the source, and the
assumption in the brief ("a PR does not exist in the pure local repository concept") did not
hold: the dev agents' self-contained setup has created local PRs since then. The three
capabilities are `true`. `GIT_PR_LIST_LIMIT` (100) is a single page, with no follow-up
pagination — human navigation, not history synchronization.

- **Where:** `packages/shared/src/index.ts` (`ListPullRequestsInput`,
  `GitPullRequestSummary`, `GitPullRequestList`, capability
  `pullRequestsList`), `apps/api/src/infrastructure/git/{github,gitlab,
  local}-provider.ts`, `apps/api/src/domain/git/git-read-limits.ts`
  (`GIT_PR_LIST_LIMIT`), `read-project-code.use-case.ts` (method
  `pullRequests`), `code.controller.ts` (`GET /projects/:id/code/pull-requests`),
  `apps/web/src/routes/code/CodeDiffPanel.tsx` (clickable list, filter by
  state, reuse of the diff-by-id flow)
- **Test:** `git-provider.contract.ts` (block "listPullRequests"),
  `read-project-code.use-case.spec.ts` (bloco "lista de PRs"),
  `apps/web/src/routes/code/CodeDiffPanel.test.tsx`
- **Origin:** PHASE 26b

### RN-112 — `listBranchesDetailed` is its OWN operation, separate from `listBranches` {#rn-112}

Foundation of the rich dropdown, now consumed by `CodeBranchPicker.tsx`
(`ahead`/`behind`, PR badge — the wave following PHASE 26b closed the
pending that `CodeShell.tsx` declared). The decision was NOT to extend `listBranches` — the
original 13th operation, which the Gitflow bootstrap calls without needing any of this:
enriching it costs an extra call to the provider PER BRANCH (two on
GitLab, which has no endpoint that returns the two sides of a comparison in a single
call, unlike `compareCommitsWithBasehead` on GitHub and `git
rev-list --left-right --count` locally). Putting that cost on every branch adoption/creation would turn the bootstrap into an expensive sweep. The
two operations coexist in the contract: `listBranches` for the bootstrap,
`listBranchesDetailed` (the 15th) for the Code tab — `GitBranchDetail` extends
`GitBranch` only in SHAPE, never in the CONTRACT of its caller.

`ahead`/`behind` are always relative to the repository's DEFAULT branch
(`ListBranchesDetailedInput.defaultBranch`, which the caller already knows — asking the provider
for it again would be one more call just to rediscover what was already known). `null` in both when the provider cannot compute it (orphan branch,
unrelated history) is honest degradation, never an invented number.
`GIT_BRANCH_DETAIL_LIMIT` (30) cuts for the same traffic reasons as item 34 of
PHASE 26 — without it, a repository with hundreds of branches would become hundreds of
calls per opening of the dropdown.

- **Where:** `packages/shared/src/index.ts` (`ListBranchesDetailedInput`,
  `GitBranchDetail`, `GitBranchDetailList`, `GitBranchPullRequestRef`,
  capability `branchesDetailed`), `apps/api/src/infrastructure/git/{github,
  gitlab,local}-provider.ts`, `git-read-limits.ts`
  (`GIT_BRANCH_DETAIL_LIMIT`), `read-project-code.use-case.ts` (method
  `branches`), `code.controller.ts` (`GET /projects/:id/code/branches`);
  on the web, `apps/web/src/lib/api-client.ts` (`getCodeBranches`) and
  `apps/web/src/routes/code/CodeBranchPicker.tsx` — the dropdown itself, opened
  from `CodeShell.tsx`
- **Test:** `git-provider.contract.ts` (block "listBranchesDetailed"),
  `read-project-code.use-case.spec.ts` (bloco "branches detalhadas"),
  `apps/web/src/routes/code/CodeBranchPicker.test.tsx`
- **Edge:** the `branches()` method lives in the SAME use case as the other six
  reads (`ReadProjectCodeUseCase`), not near the bootstrap — it is a READ
  of the Code tab, with the same credential resolution and the same container gate
  (RN-105) as the others; treating it as a bootstrap operation would duplicate both. A ref outside the branch list (tag or sha) remains
  reachable — the dropdown footer has a manual field, because
  `listBranchesDetailed` does not enumerate those two things.
- **Origin:** PHASE 26b (foundation); the following wave closed the UI

## The `implementavel` gate activates — QA strategy as the second moment of the qa-lead (RN-340/341, ADR 0090)

### RN-341 — The QA strategy is the second MOMENT of the qa-lead, and it never suspends {#rn-341}

`packages/contracts/fluxo.yml` declared the role `qa-estrategia` as `proposto`, with the
separation criterion written in the record itself: "can be the sameqa-lead in a second MOMENT, not necessarily a new agent — the separation is
of deliverable". The [ADR 0090](../adr/0090-qa-estrategia-e-appsec-segundo-momento.md)
builds exactly that: `Engine.Gates.QaEstrategiaAgent` is a STATELESS module (it is not a `GenServer`), triggered by `Engine.Gates.QaLeadServer.run_design/3`
— a NEW and ADDITIVE entry point in the SAME `qa-lead` process, without touching
`run/2` (the usual path, PR review, tied to
`DevAgentState.find_by_task_id`).

**The context is LIGHT, and that is where the separation of deliverable shows.**
`Engine.Gates.QaEstrategiaContext.fetch/3` fetches ONLY the story (from
`EngineApiClient.list_backlog/1`, the tree the PO already reads — [RN-164](engine.md#rn-164))
and the current `module_map` (from `EngineApiClient.get_infra_context/2`, the SAME
`GetInfraContextUseCase` that the Infra Lead consumes, here only through the
`moduleMap` field) — with NO `dev_state`, NO `worktree_path`: the `implementavel` gate
runs PRE-DEV, before any dev agent, worktree or `task_id` exists. No new
route in the api — both functions already existed.

**It never suspends.** The tool registry (`ReadFile`, `SearchWorkspace`,
`EmitPlanoDeTeste`) does not include `terminal` or `write_file` — the TWO only
tools that `Engine.Harness.Hooks.ActionPipeline` intercepts to create
`proposed_action`. With no call at all going through the action pipeline, the
`ToolLoop` of this agent never produces `:pending`, and `run_design/3` runs
SYNCHRONOUSLY inside the `handle_cast` itself — with no suspension/resumption
mechanism, unlike the rest of the QA area.

**The iteration ceiling stays at 8 (conversational), not 60 (gate) — on purpose, not a gap.** This agent runs WITHOUT `token_budget_micros` — there is no
task or budget yet. The criterion of [RN-085](engine.md#rn-085) is not "who works a lot":
it is "what holds the spending beyond the iteration ceiling". With no budget underneath, raising the ceiling would multiply the worst case with nothing to
contain it — the SAME reason why `infra-workflows` stays at 8 even using tools. `"qa-estrategia"` did NOT get its own clause in
`Engine.Harness.Iteracoes.tipo/1`: falling into the default is the right decision.

The deliverable — `emit_plano_de_teste` (synthesis, verifiable executable criteria,
GENERIC automation strategy with no framework — a scope decision of this front, in the `spec/0` the model reads, not a validation in
code) — becomes the artifact `artifact.plano_de_teste`
(`ArtifactEmitter.emit/5`, validated schema, `criteriosExecutaveis` cannot be
empty), in the event log of the SAME session that called `run_design/3` — that is where
`assess_implementability` ([RN-340](api.md#rn-340)) reads it later. Failure (iteration limit, budget, model that stops without emitting) is NEVER
silent: a durable `agent.error` with its origin, same rule as
[RN-059](engine.md#rn-059).

**Since [RN-674](engine.md#rn-674) (ADR 0192) the MOMENT changed.** The second moment
is still the `qa-lead`'s, with no new agent, and it still never suspends;
but it runs AFTER delivery, at the start of the `run/2` cycle, with the dev's worktree and the
diff files — `run_design/3` and `QaEstrategiaContext` were removed, and the artifact
gained `taskId`. The ceiling stays 8, now WITH the task's budget underneath.

- **Where:** `apps/engine/lib/engine/gates/qa_estrategia_agent.ex`,
  `qa_lead_server.ex` (`run_area/3`, since [RN-674](engine.md#rn-674)),
  `tools/emit_plano_de_teste.ex`, `hooks/termination_plano_de_teste.ex`;
  `apps/engine/lib/engine/harness/artifact_schemas.ex` (`plano_de_teste`);
  `apps/engine/lib/engine/harness/iteracoes.ex` (NO new clause, see
  above); `packages/contracts/fluxo.yml` (`qa-estrategia`, `status: active`)
- **Test:** `apps/engine/test/engine/gates/qa_estrategia_agent_test.exs`,
  `qa_lead_server_test.exs` (describe "plano de teste da entrega (ADR 0192)"), `apps/engine/test/engine/harness/artifact_schemas_test.exs`
  (describe "plano_de_teste"), `iteracoes_test.exs` ("qa-estrategia é
  conversacional DE PROPÓSITO")
- **Origin:** [ADR 0090](../adr/0090-qa-estrategia-e-appsec-segundo-momento.md)

---

## `secops-runtime` — abuse report over `rate_limit_hits` (RN-375..377, ADR 0091)

### RN-377 — The "not measured" section is permanent, and it names the three gaps {#rn-377}

`montarRelatorio` always includes `naoMedido`: automatic incident detection, incident response, and security postmortem. All three depend on the same trigger that `packages/contracts/fluxo.yml` already declared for `secops-runtime` —
real production traffic — and none of them is simulated with an example incident or an invented number
(same principle as ADRs 0041/0042/0077: without the real data, the gap stays visible instead of being faked). The section only leaves the list
when the product has real traffic to measure against it — it is not a TODO to erase in the next cleanup.

- **Where:** `apps/api/scripts/relatorio-seguranca-runtime.ts`,
  `apps/api/package.json` (`relatorio:seguranca-runtime`)
- **Test:** `apps/api/test/scripts/relatorio-seguranca-runtime.spec.ts`
- **ADR:** [0091](../adr/0091-secops-runtime-relatorio-de-abuso.md)

---

## `platform` gets a first deliverable: on-demand telemetry report (RN-385/386, ADR 0092)

### RN-385 — The `platform` role is born as a one-off READ SCRIPT, over the same sources as the `DomainGaugesCollector` {#rn-385}

`packages/contracts/fluxo.yml` describes `platform` (`camada_plataforma`) as "SRE / Platform
— owner of the feedback loop", `status: planned`, with activation synchronized to
`DEPLOY_ENABLED` — which does not exist. The product owner decided to bring forward the
half that already has real data behind it: `pnpm --filter api relatorio:telemetria
[--projeto <uuid>] [--json]` reads, on demand, the SAME questions that the
`DomainGaugesCollector` already answers every `METRICS_GAUGE_INTERVAL_MS` for the
Prometheus scrape — active/closing sessions per project, blocked tasks
per project, state of the last backup (age, status, size, always GLOBAL,
never per project, because the product has only one backup). It is not an LLM agent nor a
`GenServer`: it is a stateless, one-off read that ends after printing.

The SQL queries are REPLICATED, not imported from the collector — its methods
(`collectSessions`/`collectBlockedTasks`/`collectBackup`) are private and
end by writing to a Prometheus gauge (`this.metrics.*.set(...)`); there is no
pure "query only" half to reuse without coupling a one-off script to the lifecycle of a NestJS `@Injectable`. The script is also NOT a second
collector: it does not register any metric, and it does not run on `setInterval`.

The output always includes "where to see more" (the three dashboards versioned in
`deploy/k8s/observability/dashboards/*.json`, the alerts in`deploy/k8s/observability/alerts/brabo-alerts.yaml`, `docs/runbook.md
#observabilidade` and `pnpm dev:obs` for local observability) — the script
LINKS to what already exists, and never duplicates it.

- **Where:** `apps/api/scripts/relatorio-telemetria.ts`; mirrors
  `apps/api/src/infrastructure/observability/domain-gauges.collector.ts`
- **Test:** `apps/api/test/scripts/relatorio-telemetria.spec.ts` (pure functions —
  `parseArgs`, `formatarIdade`, `formatarBytes` — same scope as
  `medir-execucao.spec.ts`: the part that talks to the database is exercised by running
  the script against a real database)
- **ADR:** [0092](../adr/0092-platform-relatorio-de-telemetria-sob-demanda.md)

### RN-386 — The telemetry report declares, without inventing, what it does NOT measure {#rn-386}

The real trigger of the `platform` role (`DEPLOY_ENABLED`) does not exist: there is no production environment with real traffic, there is no numeric SLO defined anywhere in the product, and there is no possible postmortem without a real incident.
`relatorio-telemetria.ts` says so in ITS OWN output, in a "not measured" section,
instead of pretending to have coverage it does not have — the same discipline as ADR 0042 for
the model note and ADR 0077 for code quality: without the real data, the
product DECLARES the gap, and never invents the number.

Three gaps, all explicit: **formal numeric SLO** (none is
defined); **postmortem** (depends on a real incident that did not happen); and
**telemetry fed back to the product in a closed loop** (the script is a one-off
on-demand read — observing, deciding and acting on its own is what would make
`platform` `active` in `packages/contracts/fluxo.yml`, and that is why the role's
`gate_saida: { id: operavel, status: planned }` remains `planned`, untouched by this change).

- **Where:** `apps/api/scripts/relatorio-telemetria.ts` (function `imprimir`,
  "Não medido" section); `packages/contracts/fluxo.yml` (`camada_plataforma › platform ›
  saidas_alvo`, artifact `telemetria-consolidada`, field `nota`)
- **Test:** indirect coverage — the section is fixed text verified by reading
  the file; there is no conditional truth to test here (nothing to get wrong between
  "measured" and "not measured" beyond the text itself)
- **ADR:** [0092](../adr/0092-platform-relatorio-de-telemetria-sob-demanda.md)

---

## Fluxo.yml × code audit — Wave 2: RN-160 on the backend and delegation Dev Lead → dev (RN-404/405, ADR 0094)

### RN-405 — The Dev Lead → dev delegation becomes data in `delegations`, with `parecerArtifactId` redefined as "what justified the decision" {#rn-405}

ADR 0053 (PHASE 14d) already foresaw the Dev Lead → `dev-<modulo>` delegation as
"the same path as QA and Infra" (`delegations`, `area = 'dev'`), but
declared that out of scope. `dev_lead_server.ex` never wrote to the table —
only QA (`qa_lead_server.ex`) and Infra (`infra_lead_server.ex`) wrote, and both on the ENGINE side, because that is where the subagent produces a PARECER (single-round verdict) that justifies `parecerArtifactId`.

The Dev Lead does not have that pattern: the activation of a `dev-<modulo>` happens on the
API side, in `AcceptParallelizationUseCase.execute` — called both by the direct path
(`RequestParallelizationUseCase`, below the session ceiling of
[RN-083](api.md#rn-083)) and by the approved path (`ExecuteParallelizationUseCase`,
after the user approves the `proposed_action` of type `parallelize`). The recording was put
INSIDE that method — it covers both paths for free, because both already converge there —,
with `status: 'completed'` REDEFINED for this area: it means "the delegation was CARRIED OUT" (the agent started),
not "the subagent finished and issued a parecer" as in QA/Infra (a decision recorded in
[ADR 0094](../adr/0094-delegacao-dev-lead-vira-dado.md)).

`parecerArtifactId` points to the `id` of the most recent and current `artifact.module_map` event of the project — obtained from
`SessionEventRepository.listByTypeForProject(projectId, 'artifact.module_map')`
(an existing generic method, used by `computeCoverage` for
`artifact.business_rule`; no new query was written, only one more call to it — the last item in the list is the most recent, because the function orders by
`createdAt` ASC) — the artifact that justified the decision to delegate.
`area: 'dev'`, `leadAgent: 'dev-lead'`, `subagent` is the exact id of the activated agent
(`extraDevAgentId(module)`, the SAME function that builds the id everywhere else in the
use case — no new format). Without an `artifact.module_map` in the project (this should not happen — it is a mandatory input of the Dev Lead in
`packages/contracts/fluxo.yml`), the delegation is NOT recorded with an invented id: it only logs the
unexpected state, by the same lesson as RN-059 (never a silent failure, but also never fakes a justification that does not exist). And a failure of
`RecordDelegationUseCase.execute` (e.g., database down) is caught and
logged, never propagated — the activation of the dev agent is already a success when the attempt to record the delegation happens, and it cannot be brought down by an auxiliary write.

- **Where:** `apps/api/src/application/use-cases/execution/accept-parallelization.use-case.ts`
  (`recordDevDelegation`, called at the end of `execute`)
- **Test:** `apps/api/test/application/use-cases/execution/accept-parallelization.use-case.spec.ts`,
  describe "delegação Dev Lead → dev (área dev, ADR 0094)" — records with
  `area: 'dev'` pointing to the most recent module_map; without module_map it does not
  record (and does not throw); `RecordDelegationUseCase` failing does not bring down
  the activation
- **ADR:** [0094](../adr/0094-delegacao-dev-lead-vira-dado.md)

---

## Fluxo.yml × code audit — Wave 6 (last): the `necessidade-validada` gate (RN-406, ADR 0095)

Closes the last finding of the audit plan (section D,
`docs/explanation/auditoria-fluxo-vs-codigo.md`) — B2. The other five
waves had already closed (3, 4 and 5 brought forward out of order by ADRs
0089/0090; 1 and 2 in the earlier PRs). `packages/contracts/fluxo.yml` (role
`criativo`) declared `gate_saida: { id: necessidade-validada, status:
proposto }` since ADR 0085 with no mechanism behind it — and
`modelo-de-time.md` already recorded why: the Criativo (the model) deciding on its own that the need it itself produced is validated would be self-validation, not a real gate.

### RN-406 — The `necessidade-validada` gate closes with a SEPARATE click from the user, never with the Criativo validating itself {#rn-406}

> **Revised by [ADR 0185](../adr/0185-estou-pronto-fecha-os-dois-gates.md)
> ([RN-657](api.md#rn-657)), by decision of the owner on 30/09.** The click stopped being
> SEPARATE: "I'm ready — the need is validated" records
> `readiness.confirmed` and `necessity.validated` in the same POST, with the> `product_brief` produced AFTER the click (`productBriefId: null`). The button
> "Confirm validated need" left the screen. What still holds from this rule:
> whoever validates is always a PERSON, never the Criativo; the gate remains
> `warn`. `POST .../agents/criativo/validate-necessity` stays in the api, with no
> consumer on the screen — it is the path for a session whose "I'm ready" is
> earlier than ADR 0185. The text below is the design of ADR 0095, kept as
> history.

`SessionPage.tsx` gains a third confirmation button, in the SAME interaction pattern as "I'm ready to produce" (RN-142) and "Confirm architecture ready" ([RN-160](web.md#rn-160)): "Confirm validated need"
(`handleValidateNecessity`) calls `POST
.../agents/criativo/validate-necessity`, which records `necessity.validated`
with `payload.productBriefId` pointing to the most recent `artifact.product_brief`
of the session.

The button only enables AFTER `confirm_readiness` has already consolidated the
`product_brief` (`hasProductBrief`, `events.some(e => e.type ===
'artifact.product_brief')`) — it makes no sense to "validate" an executive summary that has not been produced yet, and that is the reading most
consistent with `packages/contracts/fluxo.yml`: `necessidade-validada` is an EXIT gate of
the Criativo, the moment when its work has already delivered a concrete artifact. `ValidateNecessityUseCase` re-checks the same precondition on the
BACKEND (`SessionEventRepository.listByTypeInSession(sessionId,
'artifact.product_brief')`, takes the last one by `seq`) — the disabled UI alone would not suffice, same lesson as [RN-404](api.md#rn-404).

Unlike `OfferInfraHandoffUseCase` (RN-160), this confirmation does NOT signal the engine: the Criativo→PO handoff already happened inside `confirm_readiness` itself
(`CriativoServer.executar_confirm_readiness/1`), so there is no agent
waiting for this event — it is only the record that a human validated the MERIT of what was already delivered. `ValidateNecessityUseCase` does not
receive `ApiToEngineClient` in its constructor.

`apps/api/config/gates.yml` gains the gate `necessidade-validada`: `status: active`,
`aprovacao_humana: true` (it is literally a human click),
`verificacao: script`, but `severidade: warn` — nothing in the product today
CONSULTS the passing of this gate before letting the PO proceed (unlike `story-promovida`/`plano-de-adocao`, which are `block` because a real code lock
prevents them from being skipped). `packages/contracts/fluxo.yml` (role
`criativo`) changes `status: proposto` → `status: ativo`.

- **Where:** `apps/api/src/application/use-cases/agents/validate-necessity.use-case.ts`;
  `apps/api/src/interfaces/http/agents/agents.controller.ts`
  (`validateNecessityHandoff`); `apps/web/src/routes/SessionPage.tsx`
  (`hasProductBrief`, `necessidadeJaValidada`, `handleValidateNecessity`)
- **Test:** `apps/api/test/application/use-cases/agents/validate-necessity.use-case.spec.ts`
  — without `product_brief`, refuses BEFORE recording any event; with one or
  more, records referencing the MOST RECENT one;
  `apps/web/src/routes/SessionPage.validar-necessidade.test.tsx` — button
  disabled without `product_brief`, enabled with it, disappears after
  `necessity.validated`
- **ADR:** [0095](../adr/0095-gate-necessidade-validada.md)

---

### RN-407 — The PO reads the delivery funnel and partial DORA, a third read scoped to the project {#rn-407}

The PO gained a THIRD read tool — `listar_metricas_de_produto`
(`:direct`, with no parameter at all) — served by
`GET /internal/projects/:projectId/product-metrics`, same design as the two
siblings of [RN-164](engine.md#rn-164): closed scope in the project, no search term,
no pagination.

`packages/contracts/fluxo.yml` (role `po`, input `metricas-de-produto`) declared
`status: lacuna` since [ADR 0089](../adr/0089-analytics-e-delivery-metricas-como-relatorio.md),
which had already delivered the DATA — the script `pnpm --filter api analise:funil`
measures the real funnel session → commit → PR → merge, the real lead time and the
real deployment frequency from `proposed_actions`. What was missing was
only the MECHANISM: the PO never had a way to reread that report within the turn.
Closes item B4 of the `fluxo.yml` × code audit
([docs/explanation/auditoria-fluxo-vs-codigo.md](../explanation/auditoria-fluxo-vs-codigo.md)) —
the LAST pending item in the "Team model backlog" table
(docs/explanation/backlog.md), which becomes empty after this one.

The CALCULATION is the SAME as in the script, never duplicated: the pure functions
(`calcularFunil`/`calcularLeadTimes`/`leadTimeMedioMs`/
`deploymentFrequencyPorDia`) and the query that builds `AcaoGit[]`
(`buscarAcoesGitDoFunil`) were extracted from `apps/api/scripts/analise-funil.ts`
to `apps/api/src/application/services/funil-metrics.ts` — a use case in
`src/` cannot import from `scripts/`, and the script now RE-EXPORTS from there
instead of defining locally, without changing signature or behavior (the script's
regression test stays green without being touched).

The JSON body that the route returns **has no field at all** for the three permanent absences that the script already declared in text ("Not measured, on purpose": complete product funnel ideation → commit, evidence of adoption
per feature, MTTR/change failure rate) — the report shape never reserved room for them. The PO's tool cites the three by NAME in the TEXT it returns to the model, always, and not only when the number is zero: without that section the PO would read only the funnel numbers and conclude by omission that there is no gap at all.

- **Where:** `apps/api/src/application/services/funil-metrics.ts`;
  `apps/api/scripts/analise-funil.ts` (re-exports);
  `apps/api/src/application/use-cases/backlog/list-product-metrics.use-case.ts`;
  `apps/api/src/interfaces/http/internal/internal-projects.controller.ts`;
  `apps/api/src/interfaces/http/internal/dto/product-metrics.response.dto.ts`;
  `apps/engine/lib/engine/harness/tools/listar_metricas_de_produto.ex`;
  `apps/engine/lib/engine/agents/po_server.ex`;
  `apps/engine/lib/engine/sessions/engine_api_client.ex`
- **Test:** `apps/api/test/application/use-cases/backlog/list-product-metrics.use-case.spec.ts`;
  `apps/api/test/scripts/analise-funil.spec.ts` (regression — keeps
  importing from `scripts/analise-funil.ts`, unchanged);
  `apps/engine/test/engine/harness/tools/listar_metricas_de_produto_test.exs`;
  `apps/engine/test/engine/agents/po_server_test.exs`
- **Origin:** same pattern as [RN-164](engine.md#rn-164) (agent read scoped
  to the project, no external effect, no `proposed_action`); the data is from
  [ADR 0089](../adr/0089-analytics-e-delivery-metricas-como-relatorio.md) — this RN only
  closes the read mechanism that was missing.
## The repository is born when the handoff to the Architect is accepted, and execution does not start without it (RN-582)

### RN-605 — The image pull is a NAMED step of `start`, under the control ceiling, and the overflow says that a large image does not come up {#rn-605}

The `start` of the Docker port did not pull: the `docker run` did it, internally,
under the `TIMEOUT_DE_CONTROLE_MS` (30 s). Reproduced in AT-234 with a double of the
daemon (image missing, 45 s pull, without sleeping and without network): the overflow came out
as `ComandoDeDockerFalhouError` — "`docker run …` ended with code -1:
(no error output)" —, became a 502 with `origem: null` in the broker and reached the api
without a name. And killing the CLI CANCELS the pull (measured on Docker 29.8.0, containerd):
the image remained missing for the next 60 s, so the phrase "the pull can
continue in the daemon" did not hold.

Of the four measured exits (own ceiling of ~300 s, asynchronous `start`, early pull at the image decision, just give it a name), the maintainer decided on **D — just
give it a name** (2026-09-27). The rule:

1. **The pull is explicit.** Before the `run`, `image inspect`; an image that is present
   is not downloaded again (the same `--pull missing` of the `run`). If missing, `docker
   pull` under the SAME control ceiling of 30 s — no larger ceiling.
2. **The overflow has a name.** `PullExcedeuTetoError`, origin `infra`, with the
   image, the ceiling and the whole consequence: the pull was cancelled, the image
   remains missing, a large image does not come up by this path, and the fix is to
   download it earlier on the host. Before asserting that, the adapter checks the daemon
   (`docker version`): a daemon that is down remains `DockerIndisponivelError`.
   A pull that fails for another reason follows the usual path
   (`ComandoDeDockerFalhouError`, no origin, ADR 0128).
3. **The name crosses over.** The broker responds 504 with `origem: 'infra'`, and the api
   passes it on in `BrokerRecusouError` — `origem` filled, never `null`. In
   `runner` mode the same adapter runs on the user's machine and the message
   arrives in `container_start_result`.
4. **The ceilings of whoever waits for `start` count the whole worst case**: the two `ps` of `resolver`, `image inspect`, `pull`, `run` and the diagnostic `docker version` — six control calls (`CHAMADAS_DE_CONTROLE_NO_START`).
   The api waits 10 + 6 × 30 + 5 = **195 s** (`TETO_DE_MUTACAO_MS`); the engine,
   in the `RunnerRouter`, 6 × 30 + 5 = **185 s** in `start` and 4 × 30 + 5 =
   **125 s** in `stop`/`remove` (they were 60 s, less than `resolver` plus the
   operation).
5. **The engine's `propose_action` waits for the execution that the api does inside
   it.** `container_start`, `container_start_via_runner` and `container_stop`
   auto-approved are EXECUTED in the same request
   (`ProposeActionUseCase`), and the call fell into Req's default of 15 s — a long `start`
   came back as a transport timeout even without a pull. Now it takes a `receive_timeout` of **225 s** (the api's ceiling + 30 s), mirrored in the api
   as `TETO_DO_PROPOSE_ACTION_DE_CONTAINER_NO_ENGINE_MS`; the tests on both sides check broker < api < engine and runner < engine. `container_remove`
   stays out: it is never born auto-approved.

No new dependency ([ADR 0128](../adr/0128-porta-de-docker-e-a-prova-de-empacotamento.md)), no field
that the caller writes ([ADR 0130](../adr/0130-broker-de-container.md)): the image
keeps coming from the Architect's decision, and `pull` is not a new operation of the broker
— it is a step of `start`.

**Declared, not closed:**

- **A large image does not come up on the first attempt**, neither through the broker nor
  through the runner — decision D of the maintainer. The outcome is now named; the fix is to
  download the image earlier on the host.
- **In the worst failure case, the approval stays blocked for up to ~195 s**:
  `ExecuteContainerStartUseCase` runs inside the approval `POST`, and neither the
  web nor the HTTP server has a ceiling of its own.
- It was not measured whether the layers downloaded before the cancellation are
  reused in the next attempt.

- **Code:**
  `packages/docker-port/src/docker-cli.ts:202` (`PullExcedeuTetoError`),
  `:586` (`garantirImagem`), `:125` (`CHAMADAS_DE_CONTROLE_NO_START`),
  `:116` (`TIMEOUT_DE_CONTROLE_MS`);
  `apps/broker/src/servidor.ts:231` (`PullExcedeuTetoError`);
  `apps/api/src/infrastructure/http-clients/container-broker.client.ts:241` (`TETO_DE_MUTACAO_MS`),
  `:205` (`CHAMADAS_DE_CONTROLE_NO_START`),
  `:264` (`TETO_DO_PROPOSE_ACTION_DE_CONTAINER_NO_ENGINE_MS`);
  `apps/engine/lib/engine/sessions/engine_api_client.ex:1959` (`opcoes_do_propose_action`),

  `apps/engine/lib/engine/sessions/engine_api_client.ex:1959` (`opcoes_do_propose_action`),
  `:1649` (`@teto_do_propose_action_de_container_ms`);
  `apps/engine/lib/engine/runners/runner_router.ex:52` (`@timeout_do_start_ms`)
- **Test:** `packages/docker-port/src/docker-cli.spec.ts:425` (describe of the
  reproduction, "(AT-234)": the 45 s pull ends NAMED, `:457`; a daemon that is down
  remains a daemon that is down, `:481`; the pull that fits comes up, `:493`; an image that is present
  is not downloaded, `:508`; the six calls, `:520`);
  `apps/broker/src/servidor.spec.ts:317` (504 with origin `infra`);
  `apps/api/test/infrastructure/http-clients/container-broker.client.spec.ts:144`
  (arrives with `origem`), `:362` and `:377` (the count and the order);
  `apps/runner/src/index-handlers.spec.ts:420` (the name in the
  `container_start_result`);
  `apps/engine/test/engine/sessions/engine_api_client_propose_action_test.exs:67`
  (real HTTP: the api that takes 16 s is expected), `:82` and `:95` (the actions and the
  order, reading the api's mirror);
  `apps/engine/test/engine/runners/runner_router_test.exs:183`
- **Origin:** AT-234

## Decide in the chat, where the owner is (RN-626)

### RN-627 — The project container runs with the owner of the folder, measured by the api {#rn-627}

Under `--cap-drop ALL` the container's root does not have `CAP_DAC_OVERRIDE` and does not
write to the project folder, which belongs to the operator's uid: `npm install` gave
`EACCES` to every dev agent (AT-247, [ADR 0180](../adr/0180-container-com-o-dono-da-pasta.md)).

1. **The api measures, the broker composes.** `container-spec` returns `usuarioDaPasta`
   (`stat` of the folder in the `container`/`mounted` modes; `null` if the folder is not reachable, if the owner is root or if the project is `runner`). The broker copies it
   to `spec.usuario` and the adapter emits `--user uid:gid` and `--env HOME=/tmp`.
2. **It never comes from whoever asks.** `start` has no body and the `exec` body ignores
   extra fields; `exec` inherits the container's user.
3. **The broker re-validates.** Integers in 1..2^31-1; `0` is refused, naming
   `usuario.uid`/`usuario.gid` (root is the absent one, "as always").
4. **Não afrouxa contenção**: `--cap-drop ALL`, um bind, rede de dois valores
   e cinco operações continuam. Container já criado só muda ao ser recriado.

- **Onde:** `packages/docker-port/src/docker-cli.ts:785` (`argsDeCriacao`),
  `packages/docker-port/src/spec-de-container.ts:136` (`usuarioValidado`),
  `apps/broker/src/operacoes.ts:427` (`especificacaoDoProjeto`),
  `apps/api/src/application/use-cases/containers/obter-spec-de-container.use-case.ts:124`
  (`ObterSpecDeContainerUseCase`)
- **Teste:** `packages/docker-port/src/docker-cli.spec.ts` (o `run` leva
  `--user` e continua sem campo livre), `packages/docker-port/src/spec-de-container.spec.ts`
  (`usuario`), `apps/broker/src/operacoes.spec.ts` ("o usuário do container"),
  `apps/api/test/application/use-cases/containers/spec-e-observacao-de-container.use-case.spec.ts`
- **Origem:** AT-247

## A Anamnese não paga duas vezes pela mesma janela, e o resgate de gate não reinicia ciclo que espera alguém (RN-722)

### RN-738 — Parar container de projeto é imediato, e a linha da `/containers` relê ao decidir {#rn-738}

- **Regra:** todo container de projeto sobe com `--init` — CONSTANTE da
  composição do `docker run` em `DockerViaCli`, nunca campo da spec (a
  contenção é o tipo, ADR 0130); vale para o broker e para o runner, que usam
  a mesma porta. O comando de espera (`sleep infinity`) era PID 1 sem handler
  de SIGTERM, e o kernel não entrega sinal de ação padrão a PID 1: `docker
  stop` esperava os 10 s e matava (`Exited (137)`). Medido em container
  descartável: 10,25 s sem `--init`, 0,20 s com. Na página `/containers`,
  decidir a ação pendente (aprovar, negar, sempre permitir) invalida
  `['containers-overview']` e `['container-lifecycle', projectId]` no
  `finally` — também quando a chamada falha ou cai —, e devolve a promessa ao
  card. Nenhum poll novo (RN-579/632).
- **Onde:** `packages/docker-port/src/docker-cli.ts:785` (`argsDeCriacao`),
  `apps/web/src/components/AcoesDoContainer.tsx:61` (`invalidateContainers`), `:172`
  (`aprovar`)
- **Teste:** `packages/docker-port/src/docker-cli.spec.ts` (`run` leva
  `--init` antes do comando), `apps/broker/src/contencao-do-brabo.spec.ts`
  (os dois modos sobem com `--init`), `apps/web/src/routes/ContainersPage.test.tsx`
  (aprovar relê visão geral e ciclo de vida; aprovação recusada ainda relê)
- **Origem:** AT-422 (instalação local, 03/10: três paradas `executed` com a
  linha em "rodando" e `Exited (137)`)

### RN-807 — O `exec` que estoura o teto volta como estouro, e o comando morre dentro do container {#rn-807}

- **Regra:** o estouro do teto do `exec` da `DockerPort` é decidido pelo
  RELÓGIO (decorrido ≥ teto) além do `killed`, porque o cliente `docker exec`
  captura o SIGTERM do `timeout` do `execFile` e sai com código 0 — medido:
  `sleep 30; echo FIM` sob teto de 3s voltava `erro: null`, `stdout: ""`, e o
  adaptador devolvia `exitCode: 0`. Comando de agente que estourava os 120s
  voltava "exit 0", e o QA aprovou suíte que trava. O estouro agora devolve
  `exitCode: -1`, `timedOut: true` e a marca de timeout. E matar o cliente não
  mata o comando: o `exec` embrulha o comando (que segue inteiro e não
  interpretado; o canal é `-e BRABO_EXEC_CMD`, [RN-947](#rn-947)) num `sh` que grava o próprio PID — líder de grupo e de sessão,
  porque o runtime faz `setsid` em todo `docker exec` — em `/tmp` do container;
  no estouro o adaptador mata o GRUPO por esse PID (SIGKILL), numa chamada
  interna, sem operação nova na porta (ADR 0130). Medido e recusado: `timeout`
  do busybox dentro do `sh -c` — o vigia morre com o cliente e o `sleep`
  sobrevive. Se a morte falhar (`/tmp` sem escrita, por exemplo), a marca diz
  que o processo pode ter sobrevivido.
- **Onde:** `packages/docker-port/src/docker-cli.ts:279` (`estourouOTeto`),
  `packages/docker-port/src/docker-cli.ts:506` (`matarExecEstourado`)
- **Teste:** `packages/docker-port/src/docker-cli.spec.ts` ("erro nulo depois do
  teto É estouro"; "no estouro mata o grupo do comando DENTRO do container";
  "o comando que estoura volta timedOut e MORRE dentro do container", contra
  Docker real, pulado sem daemon)
- **Origem:** AT-482

### RN-820 — O container de projeto volta sozinho quando o daemon reinicia {#rn-820}

- **Regra:** o `docker run` composto pelo `DockerViaCli` leva
  `--restart unless-stopped` como CONSTANTE, ao lado do `--init` da
  [RN-738](#rn-738) — a spec não ganha campo, e a contenção do ADR 0130 não
  muda. Um daemon reiniciado (atualização do sistema) religa o container de
  projeto; um `docker stop` explícito (o `container_stop` do ciclo de vida) NÃO
  é desfeito, porque `unless-stopped` não religa o que foi parado à mão — nunca
  `always`. Medido: container `unless-stopped` parado com `docker stop` segue
  `exited` com `RestartCount=0`.
- **Onde:** `packages/docker-port/src/docker-cli.ts:785` (`argsDeCriacao`)
- **Teste:** `packages/docker-port/src/docker-cli.spec.ts` ("cria o container
  com rótulo gerenciado, UM bind e as capabilities derrubadas")
- **Origem:** AT-494 (o daemon reiniciado deixou todo container de projeto
  `Exited (143)` com o registro `running`)

### RN-928 — O comando do app é argumento de um supervisor constante, e sem ele o container é o de sempre {#rn-928}

- **Regra:** `EspecificacaoDeContainer.comandoDoApp` (opcional, até 300 caracteres, sem `\n`, `\r` nem NUL) troca o `sleep infinity` pelo supervisor CONSTANTE `SUPERVISOR_DO_APP`, que recebe o comando como `$1` (molde da [RN-807](#rn-807)) e nunca o concatena: aspas, `;` e `$()` do comando não escapam. O app sobe em background (log em `/tmp/brabo-app.log`, código em `/tmp/brabo-app.exit`) e o PID 1 segue `sleep infinity`. Ausente ou `null`, o `docker run` é byte a byte o anterior. O broker lê o campo SÓ da `container-spec` da api. ([ADR 0228](../adr/0228-comando-do-app-e-rede-do-container.md).)
- **Onde:** `packages/docker-port/src/spec-de-container.ts:351` (`comandoDoAppValidado`), `packages/docker-port/src/docker-cli.ts:380` (`SUPERVISOR_DO_APP`), `packages/docker-port/src/docker-cli.ts:785` (`argsDeCriacao`)
- **Teste:** `packages/docker-port/src/docker-cli.spec.ts:657` (`NÃO-REGRESSÃO`), `packages/docker-port/src/docker-cli.spec.ts:676` (comando com `'`, `;` e `$()` fica como argumento)
- **Origem:** AT-610 (EP-030).

### RN-929 — Porta publicada vai só ao loopback, e DNS e `extra_hosts` são IP literal e nome de lista fechada {#rn-929}

- **Regra:** `portas` vira sempre `-p 127.0.0.1:H:C` (TCP; interface constante, sem opção), host de 1024 a 65535 fora de 3000, 4000, 5173, 5432, 7474, 7687, 8088, 8090 e 11434, no máximo 10 e sem duplicata. `dns` é IP literal v4/v6 (até 3). `hostsExtras` é `{ nome, ip }` (até 10) com nome em `[a-z0-9.-]` de até 253 caracteres, nunca `localhost`, `host.docker.internal` nem nome de serviço da instalação, e IPv4 literal. Os três são recusados com rede `none`. `inspect` devolve `portasPublicadas` lidas de `NetworkSettings.Ports`, separadas do declarado ([RN-468](web.md#rn-468)). ([ADR 0228](../adr/0228-comando-do-app-e-rede-do-container.md).)
- **Onde:** `packages/docker-port/src/spec-de-container.ts:384` (`portasValidadas`), `packages/docker-port/src/spec-de-container.ts:405` (`dnsValidado`), `packages/docker-port/src/spec-de-container.ts:415` (`hostsExtrasValidados`), `packages/docker-port/src/docker-cli.ts:358` (`portasPublicadasDe`)
- **Teste:** `packages/docker-port/src/spec-de-container.spec.ts:237` (recusas), `packages/docker-port/src/docker-cli.spec.ts:688` (`-p 127.0.0.1`, `--dns`, `--add-host`), `apps/broker/src/operacoes.spec.ts:289` (vem da api)
- **Origem:** AT-608 (EP-030), fatia do contrato.

### RN-930 — A instância de QA é efêmera, só mexe no que tem `brabo.papel=qa` e sobe os serviços que a Infra declarou por digest {#rn-930}

- **Regra:** a spec com `qa: { chave, servicos }` sobe `brabo-qa-<workspace_dir_name>-<chave>` sem `--restart`, com `brabo.papel=qa` e `brabo.qa.instancia`, sem app nem porta. `stop`, `remove`, `inspect` e `exec` com `alvo` de QA filtram `brabo.papel=qa`; homônimo sem o papel é "não gerenciado" e nada é removido. Cada serviço (até 6, imagem por digest `@sha256:` obrigatório, `env` de chaves `[A-Z_][A-Z0-9_]*`) sobe com `--network container:<qa>`, `--cap-drop ALL`, sem privilégio nem porta publicada, tetos constantes e `--tmpfs`; serviço compartilhado vive na rede privada `--internal` do projeto. O broker expõe `/containers/:projectId/qa/:chave/{start,remove,exec}` e lê os serviços da api, conferindo a chave. ([ADR 0229](../adr/0229-instancia-de-qa-efemera-com-servicos-declarados-pela-infra.md).)
- **Onde:** `packages/docker-port/src/docker-cli.ts:572` (`iniciarQa`), `packages/docker-port/src/docker-cli.ts:880` (`argsDeServicoDeQa`), `packages/docker-port/src/spec-de-container.ts:439` (`instanciaDeQaValidada`), `apps/broker/src/operacoes.ts:212` (`startQa`), `apps/broker/src/servidor.ts:135` (`rotaDeContainer`)
- **Teste:** `packages/docker-port/src/docker-cli.spec.ts:756` (remove só alcança o papel `qa`), `packages/docker-port/src/spec-de-container.spec.ts:256` (digest, chave, env), `apps/broker/src/operacoes.spec.ts:321` (lista da api e chave da rota), `apps/broker/src/servidor.spec.ts:405` (roteador fechado)
- **Origem:** AT-612 (EP-030).

### RN-941 — O serviço de QA roda com usuário e comando declarados, nunca como root, e leva o nome da instância mais o do serviço {#rn-941}

- **Regra:** revisa a RN-930 e a RN-935 depois da prova com Docker real de 29/10/2026 (AT-612), que achou três defeitos. (1) O serviço PRÓPRIO era criado com o nome da própria instância (`Conflict`): agora é `<instância>-<serviço>`, o que `removerServicosDeQa` e o rótulo `brabo.qa.dono` já esperavam. (2) Postgres sob `--cap-drop ALL` sai com `chown`/`chmod` negados: o serviço ganha `user` (`"<uid>:<gid>"`, inteiros diferentes de 0, sem zero à esquerda, nunca root) que vira `--user`, e os caminhos `tmpfs` montam com `uid=`, `gid=` e `mode=0700` do mesmo dono. (3) Imagens que não sobem sozinhas: o serviço ganha `command` (1 a 16 argumentos de até 200 caracteres, sem `\0`, `\n` ou `\r`), passado como argumentos DEPOIS da imagem, nunca por shell. `null` equivale a ausente. A contenção não muda (`--cap-drop ALL`, sem `--privileged`/`--cap-add`, sem porta publicada, tetos constantes). A régua mora nos três lugares (docker-port, api, engine) e nenhum deles aceita `0`.
- **Onde:** `packages/docker-port/src/spec-de-container.ts:453` (`usuarioDeServicoValidado`), `packages/docker-port/src/docker-cli.ts:880` (`argsDeServicoDeQa`), `apps/api/src/domain/infra/run-instructions.ts:160` (`recusaDoQa`), `apps/engine/lib/engine/infra/instrucoes_de_execucao.ex:133` (`qa`).
- **Teste:** `packages/docker-port/src/docker-cli.spec.ts` (nome, `--user`, dono do tmpfs, comando), `packages/docker-port/src/spec-de-container.spec.ts` (recusa de `0:0`, `70:0`, `70`, comando grande/com quebra), `apps/broker/src/operacoes.spec.ts`, `apps/api/test/domain/infra/run-qa.spec.ts`, `apps/engine/test/engine/infra/instrucoes_de_execucao_test.exs`; prova com Docker real: `postgres:17-alpine` com `70:70` aceita conexão em `localhost:5432` e `busybox httpd` responde em `localhost:9000` de dentro da instância.
- **Origem:** AT-612 (EP-030), ADR 0229.

### RN-947 — O comando do agente no `exec` não aparece na linha de comando de nenhum processo do container {#rn-947}

- **Regra:** o comando do `exec` da `DockerPort` viaja por `-e BRABO_EXEC_CMD=<comando>` e não mais no argv: o embrulho da [RN-807](#rn-807) o lê, faz `unset` e `set --`, e o roda por `(eval "$c")` em subshell (mesmo grupo, mesmo PID gravado, `exit` e `set -e` contidos, exit code preservado). O argv do container fica só `/bin/sh -c <embrulho> brabo-exec <marcador>`. Medido no uso real: os 36 comandos do QA de automação com `pkill -f` morriam com 143, porque o padrão casava o argv do próprio `sh`. Fora, declarado: o runner no host (`apps/runner/src/exec.ts`), que a [RN-507](runner.md#rn-507) já condiciona a container `running`.
- **Onde:** `packages/docker-port/src/docker-cli.ts:299` (`EMBRULHO_DO_EXEC`).
- **Teste:** `packages/docker-port/src/docker-cli.spec.ts` ("o comando que estoura volta timedOut e MORRE dentro do container", contra Docker real: auto-`pkill -f` sobrevive, `exit 3` volta 3, o comando não aparece no `ps`).
- **Origem:** AT-622 (EP-030).
