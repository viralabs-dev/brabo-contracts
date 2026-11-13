/**
 * A PROVA DE COMPOSE (AT-922): o QA pede ao broker um `docker compose up --build`
 * do clone limpo do projeto, num projeto compose descartável.
 *
 * Porta SEPARADA de `DockerPort`, de propósito: acrescentar a sétima operação à
 * classe abstrata quebraria o runner, que não tem (nem deve ter) a prova. Só o
 * broker a implementa. A operação não recebe compose pronto para executar: o
 * broker VALIDA por allowlist, força limites e rede e limpa sempre; o que viola a
 * allowlist volta em `recusas`. Risco aceito pelo dono (12/11/2026): o `RUN` do
 * Dockerfile roda no BuildKit do servidor.
 */

import { nomeDoContainerDeQa, type AlvoDeQa } from './docker-port.ts';

/** Os limites da prova, como DADO do contrato: o broker os aplica, a api/engine os leem. Decisão do dono (12/11/2026, Q7). */
export const LIMITES_DA_PROVA_DE_COMPOSE = {
  tempoMaximoMs: 10 * 60 * 1000,
  discoMaximoBytes: 4 * 1024 ** 3,
  /** Uma prova viva por projeto (molde da RN-935). */
  provasSimultaneasPorProjeto: 1,
} as const;

/** Os caminhos sondados por dentro da rede do compose. */
export const CAMINHOS_SONDADOS_NA_PROVA = ['/docs', '/openapi.json'] as const;

/** Campos do compose que o broker recusa pelo nome (a allowlist é o resto). */
export const CAMPOS_RECUSADOS_NO_COMPOSE = [
  'privileged',
  'cap_add',
  'network_mode',
  'pid',
  'ipc',
  'devices',
  'extra_hosts',
  'include',
  'extends',
  'volumes de host',
  'env_file fora do contexto',
  'ports fora de 127.0.0.1',
] as const;

/**
 * Quem falhou, no vocabulário do produto: `projeto` = o build/serviço/`/docs` do
 * usuário (vira item do parecer); `infra` = daemon, disco, tempo, rede (vira
 * origem `infra`, e o parecer aprova com o aviso "sem prova de compose").
 */
export type OrigemDaProvaDeCompose = 'projeto' | 'infra';

export interface SondaDeCompose {
  readonly caminho: string;
  /** Status HTTP; `0` quando a sonda não obteve resposta. */
  readonly status: number;
}

export interface RecusaDeCompose {
  /** O campo do compose recusado (um de `CAMPOS_RECUSADOS_NO_COMPOSE` ou o serviço+campo). */
  readonly campo: string;
  readonly motivo: string;
}

export interface ResultadoDaProvaDeCompose {
  /** `true` quando `up --build --wait` terminou de pé. */
  readonly subiu: boolean;
  readonly sondas: readonly SondaDeCompose[];
  /** Presente quando a allowlist recusou o compose (então nada rodou e `subiu` é `false`). */
  readonly recusas?: readonly RecusaDeCompose[];
  readonly origem: OrigemDaProvaDeCompose;
}

export abstract class ProvaDeComposePort {
  /**
   * Valida, sobrescreve (rede própria, limites, `cap_drop`), sobe, sonda e
   * limpa SEMPRE (`down -v --rmi local --remove-orphans`, em sucesso, falha,
   * exceção e teto). Endereça a instância de QA como as outras operações:
   * projeto compose `brabo-qa-compose-<workspace>-<chave>`.
   */
  abstract provaDeCompose(workspaceDirName: string, alvo: AlvoDeQa): Promise<ResultadoDaProvaDeCompose>;
}

/** `brabo-qa-compose-<workspace_dir_name>-<chave>` — o nome do projeto compose descartável. */
export function nomeDoProjetoDeCompose(workspaceDirName: string, chave: string): string {
  // Reusa a derivação de QA para herdar o prefixo gerenciado e a validação de segmento do chamador.
  return nomeDoContainerDeQa(workspaceDirName, chave).replace('brabo-qa-', 'brabo-qa-compose-');
}
