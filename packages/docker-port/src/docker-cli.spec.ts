import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CHAMADAS_DE_CONTROLE_NO_START,
  ComandoDeDockerFalhouError,
  DockerCliAusenteError,
  DockerViaCli,
  SUPERVISOR_DO_APP,
  REINICIAR_APP,
  EMBRULHO_DO_EXEC,
  estourouOTeto,
  PullExcedeuTetoError,
  ServicoDeDadosMorreuError,
  JANELA_DE_CONFERENCIA_DE_SERVICO_MS,
  argsDeServicoDeQa,
  TIMEOUT_DE_CONTROLE_MS,
  rodarDockerDeVerdade,
  type ResultadoDoCli,
  type RodarDocker,
} from './docker-cli.ts';
import {
  ContainerAusenteError,
  ContainerNaoGerenciadoError,
  DockerIndisponivelError,
  raizDeProjetoValidada,
  ROTULO_GERENCIADO,
  type EspecificacaoDeContainer,
} from './docker-port.ts';
import { EspecificacaoInvalidaError } from './spec-de-container.ts';

/**
 * Nenhum `docker` roda aqui: o duplo é a função `RodarDocker`, que é o ÚNICO
 * ponto de contato do adaptador com o mundo. O que ele exercita, então, é o
 * que dá para errar sem um daemon — quais argumentos são montados (é ali que
 * mora a contenção: `--cap-drop ALL`, um bind só, rede de dois valores) e como
 * cada falha é CLASSIFICADA.
 *
 * O caminho contra um daemon de verdade é o `--self-test-docker` dos smokes
 * (`pnpm --filter runner smoke` / `smoke:bin`), que roda o artefato
 * empacotado. Esta suíte não o substitui, e a divisão é a de sempre no
 * repositório: unidade prova a decisão, smoke prova o artefato.
 */

const SPEC: EspecificacaoDeContainer = {
  workspaceDirName: 'exp002-f52be111',
  projectId: 'f52be111-0000-0000-0000-000000000000',
  projectSlug: 'exp002',
  workspaceId: 'aaaa1111-0000-0000-0000-000000000000',
  imagem: 'node:24-bookworm',
  imagemVersao: '3',
  rede: 'egress',
  raizDoProjeto: raizDeProjetoValidada('/home/alguem/dev/exp002'),
  cpus: 2,
  memoriaMb: 2048,
  pidsLimit: 512,
};

const OK: ResultadoDoCli = { exitCode: 0, stdout: '', stderr: '', timedOut: false };

function comSaida(stdout: string): ResultadoDoCli {
  return { ...OK, stdout };
}

const SEM_ESPERA = async (): Promise<void> => undefined;

function linhaDePs(nome: string, estado: string, id = 'c0ffee'): string {
  return JSON.stringify({ ID: id, Names: `/${nome}`, State: estado });
}

/**
 * Duplo com ROTEIRO por prefixo de argumentos: cada chamada é registrada e a
 * resposta vem da primeira regra que casa. Roteiro por prefixo, e não por
 * ordem, porque a ordem das chamadas internas (`ps` gerenciado, `ps` homônimo,
 * ação) é detalhe de implementação — um teste preso a ela reprovaria numa
 * refatoração que não muda comportamento nenhum.
 */
function duplo(
  regras: Array<{ quando: readonly string[]; entao: ResultadoDoCli }>,
): { rodar: RodarDocker; chamadas: string[][] } {
  const chamadas: string[][] = [];
  const rodar: RodarDocker = async (args) => {
    chamadas.push([...args]);
    const regra = regras.find((r) => r.quando.every((parte, i) => args[i] === parte));
    // Sem regra que case, o duplo responde SUCESSO VAZIO — o padrão certo aqui
    // é o que não inventa falha: cada teste declara só a chamada que ele
    // exercita, e uma falha inesperada apareceria como asserção quebrada, não
    // como erro de um comando que o teste nem pretendia cobrir.
    return regra?.entao ?? OK;
  };
  return { rodar, chamadas };
}

describe('DockerViaCli.start', () => {
  it('cria o container com rótulo gerenciado, UM bind e as capabilities derrubadas', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['run'], entao: comSaida('c0ffeebabe\n') },
    ]);

    const iniciado = await new DockerViaCli(rodar).start(SPEC);

    expect(iniciado).toEqual({
      containerId: 'c0ffeebabe',
      nome: 'brabo-exp002-f52be111',
      jaEstavaDePe: false,
      recriado: false,
    });

    const run = chamadas.find((c) => c[0] === 'run');
    expect(run).toBeDefined();
    const args = run as string[];
    expect(args).toContain('--detach');
    // AT-422 (RN-738): init que repassa o SIGTERM — sem ele, `stop` leva 10 s.
    expect(args).toContain('--init');
    expect(args.indexOf('--init')).toBeLessThan(args.indexOf('sleep'));
    // AT-494 (RN-820): volta sozinho depois de o daemon reiniciar, e o `stop`
    // explícito não é desfeito (`unless-stopped`, nunca `always`).
    expect(args.join(' ')).toContain('--restart unless-stopped');
    expect(args).not.toContain('always');
    expect(args.join(' ')).toContain(`--label ${ROTULO_GERENCIADO}=true`);
    // UM volume, destino constante. Se um dia aparecer um segundo `--volume`,
    // este número é o que reprova.
    expect(args.filter((a) => a === '--volume')).toHaveLength(1);
    expect(args).toContain('/home/alguem/dev/exp002:/work:rw');
    expect(args.join(' ')).toContain('--cap-drop ALL');
    expect(args.join(' ')).toContain('--network bridge');
    expect(args.join(' ')).toContain('--cpus 2');
    expect(args.join(' ')).toContain('--memory 2048m');
    // Fork bomb é shell puro e não precisa de comando reconhecível — o teto de
    // processos é a contenção que não depende de reconhecer nada (ADR 0130).
    expect(args.join(' ')).toContain('--pids-limit 512');
    // Nada disto pode aparecer — e como o TIPO não deixa escrevê-los, este
    // teste tranca a única forma que sobra de eles entrarem: alguém somar a
    // opção à mão aqui dentro.
    expect(args).not.toContain('--privileged');
    expect(args).not.toContain('--cap-add');
    expect(args.join(' ')).not.toContain('--network host');
  });

  it('sem `usuario` o run não leva --user (como sempre), com ele leva --user uid:gid e HOME constante (ADR 0180)', async () => {
    const um = duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['run'], entao: comSaida('c0ffee\n') },
    ]);
    await new DockerViaCli(um.rodar).start(SPEC);
    expect(um.chamadas.find((c) => c[0] === 'run')).not.toContain('--user');

    const dois = duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['run'], entao: comSaida('c0ffee\n') },
    ]);
    await new DockerViaCli(dois.rodar).start({
      ...SPEC,
      usuario: { uid: 1000, gid: 1001 },
    });
    const run = dois.chamadas.find((c) => c[0] === 'run') as string[];
    expect(run.join(' ')).toContain('--user 1000:1001');
    expect(run.join(' ')).toContain('--env HOME=/tmp');
    // A contenção segue intacta e continua sem campo livre.
    expect(run.join(' ')).toContain('--cap-drop ALL');
    expect(run).not.toContain('--privileged');
    expect(run).not.toContain('--cap-add');
    expect(run.filter((a) => a === '--volume')).toHaveLength(1);
    expect(run.filter((a) => a === '--env')).toHaveLength(1);
  });

  it('rede `none` vira `--network none`', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['run'], entao: comSaida('c0ffee\n') },
    ]);

    await new DockerViaCli(rodar).start({ ...SPEC, rede: 'none' });

    const run = chamadas.find((c) => c[0] === 'run') as string[];
    expect(run.join(' ')).toContain('--network none');
  });

  it('container já de pé não é recriado, e o chamador sabe que não subiu nada', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'running')) },
    ]);

    const iniciado = await new DockerViaCli(rodar).start(SPEC);

    expect(iniciado.jaEstavaDePe).toBe(true);
    expect(chamadas.some((c) => c[0] === 'run')).toBe(false);
  });

  /** O hash que o `run` gravou, lido do `run` de um `start` num host vazio. */
  async function hashDoRun(): Promise<string> {
    const { rodar, chamadas } = duplo([{ quando: ['run'], entao: comSaida('c0ffee\n') }]);
    await new DockerViaCli(rodar).start(SPEC);
    const run = chamadas.find((c) => c[0] === 'run') as string[];
    expect(run.slice(1, 3)).toEqual(['--label', expect.stringMatching(/^brabo\.spec\.hash=[0-9a-f]{64}$/)]);
    return (run[2] as string).split('=')[1] as string;
  }

  function inspecaoComHash(hash: string | undefined): ResultadoDoCli {
    return comSaida(
      JSON.stringify({ Id: 'c0ffee', Config: { Labels: hash === undefined ? {} : { 'brabo.spec.hash': hash } } }),
    );
  }

  const PARADO = linhaDePs('brabo-exp002-f52be111', 'exited');

  it('parado com o MESMO hash de spec é RELIGADO, nunca recriado', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(PARADO) },
      { quando: ['inspect'], entao: inspecaoComHash(await hashDoRun()) },
    ]);

    const iniciado = await new DockerViaCli(rodar).start(SPEC);

    expect(iniciado).toMatchObject({ jaEstavaDePe: false, recriado: false });
    expect(chamadas.some((c) => c[0] === 'start')).toBe(true);
    expect(chamadas.some((c) => c[0] === 'run' || c[0] === 'rm')).toBe(false);
  });

  it('parado com spec DIFERENTE (porta nova) é removido e recriado, recriado=true', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(PARADO) },
      { quando: ['inspect'], entao: inspecaoComHash(await hashDoRun()) },
      { quando: ['run'], entao: comSaida('novo\n') },
    ]);

    const iniciado = await new DockerViaCli(rodar).start({
      ...SPEC,
      portas: [{ host: 13001, container: 3000, protocolo: 'tcp' }],
    });

    expect(iniciado).toMatchObject({ containerId: 'novo', jaEstavaDePe: false, recriado: true });
    expect(chamadas.some((c) => c[0] === 'start')).toBe(false);
    const rm = chamadas.findIndex((c) => c[0] === 'rm' && c.includes('--force'));
    expect(rm).toBeGreaterThanOrEqual(0);
    expect(chamadas.findIndex((c) => c[0] === 'run')).toBeGreaterThan(rm);
  });

  it('parado sem rótulo de hash (container antigo) é recriado', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(PARADO) },
      { quando: ['inspect'], entao: inspecaoComHash(undefined) },
    ]);
    const iniciado = await new DockerViaCli(rodar).start(SPEC);
    expect(iniciado.recriado).toBe(true);
    expect(chamadas.some((c) => c[0] === 'start')).toBe(false);
  });

  it('homônimo `created` (nunca rodou) é removido e recriado, mesmo com o hash igual', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'created')) },
      { quando: ['inspect'], entao: inspecaoComHash(await hashDoRun()) },
      { quando: ['run'], entao: comSaida('novo\n') },
    ]);
    const iniciado = await new DockerViaCli(rodar).start(SPEC);
    expect(iniciado.recriado).toBe(true);
    expect(chamadas.some((c) => c[0] === 'start')).toBe(false);
    expect(chamadas.some((c) => c[0] === 'rm' && c.includes('--force'))).toBe(true);
  });

  it('o `run` que falha remove o container que ele deixou `Created`, e o erro do `run` sobe', async () => {
    const nome = 'brabo-exp002-f52be111';
    const { rodar, chamadas } = duplo([
      // 1º `ps` (resolver) não acha nada; depois do `run` o resto aparece.
      { quando: ['run'], entao: { ...OK, exitCode: 125, stderr: 'bind: address already in use' } },
    ]);
    let psChamado = 0;
    const comResto: RodarDocker = async (args, t) => {
      if (args[0] === 'ps') {
        psChamado += 1;
        if (args.some((a) => a.startsWith('label=brabo.managed')) && psChamado > 1) {
          return comSaida(linhaDePs(nome, 'created', 'resto1'));
        }
      }
      return rodar(args, t);
    };

    await expect(new DockerViaCli(comResto).start(SPEC)).rejects.toBeInstanceOf(
      ComandoDeDockerFalhouError,
    );
    expect(chamadas).toContainEqual(['rm', '--force', 'resto1']);
  });
});

describe('DockerViaCli.recursosDoHost', () => {
  const insp = (o: object) => JSON.stringify(o);
  const gerenciado = {
    Id: 'a1',
    Name: '/brabo-p1',
    Config: { Labels: { 'brabo.managed': 'true', 'brabo.project.id': 'p1' } },
    State: { Status: 'running' },
    NetworkSettings: { Ports: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '13000' }] } },
  };
  const terceiro = {
    Id: 'b2',
    Name: '/nginx-do-vizinho',
    Config: { Image: 'nginx', Labels: { 'com.x': 'y' } },
    State: { Status: 'running' },
    NetworkSettings: { Ports: { '80/tcp': [{ HostIp: '0.0.0.0', HostPort: '8080' }] } },
  };
  const parado = {
    Id: 'c3',
    Name: '/brabo-qa-p2-k1-redis',
    Config: { Labels: { 'brabo.managed': 'true', 'brabo.project.id': 'p2', 'brabo.qa.dono': 'x' } },
    State: { Status: 'exited' },
    NetworkSettings: { Ports: {} },
  };

  it('porta de terceiro sai só como número; o gerenciado leva projectId; parado não segura porta', async () => {
    const { rodar, chamadas } = duplo([
      {
        quando: ['ps'],
        entao: comSaida(['a1', 'b2', 'c3'].map((ID) => JSON.stringify({ ID })).join('\n')),
      },
      { quando: ['inspect'], entao: comSaida([gerenciado, terceiro, parado].map(insp).join('\n')) },
      { quando: ['network', 'ls'], entao: comSaida(JSON.stringify({ ID: 'n1' })) },
      {
        quando: ['network', 'inspect'],
        entao: comSaida(insp({ Id: 'n1', Name: 'brabo-qa-w', Labels: { 'brabo.project.id': 'p2' } })),
      },
    ]);

    const r = await new DockerViaCli(rodar).recursosDoHost();

    expect(r.portas).toEqual([
      { host: 13000, ip: '127.0.0.1', protocolo: 'tcp', projectId: 'p1' },
      { host: 8080, ip: '0.0.0.0', protocolo: 'tcp', projectId: null },
    ]);
    expect(r.containers).toEqual([
      { projectId: 'p1', papel: 'trabalho', estado: 'running', nome: 'brabo-p1' },
      { projectId: 'p2', papel: 'servico_qa', estado: 'exited', nome: 'brabo-qa-p2-k1-redis' },
    ]);
    expect(r.redes).toEqual([{ projectId: 'p2', nome: 'brabo-qa-w' }]);
    expect(JSON.stringify(r)).not.toContain('nginx');
    // Um `inspect` só, para todos os ids.
    expect(chamadas.filter((c) => c[0] === 'inspect')).toHaveLength(1);
  });

  it('host vazio não chama `inspect` (docker inspect sem id é erro)', async () => {
    const { rodar, chamadas } = duplo([]);
    expect(await new DockerViaCli(rodar).recursosDoHost()).toEqual({
      portas: [],
      containers: [],
      redes: [],
    });
    expect(chamadas.some((c) => c[0] === 'inspect')).toBe(false);
  });
});

describe('DockerViaCli.removerPorProjeto', () => {
  it('remove por rótulo gerenciado + projeto: containers primeiro, redes depois', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-qa-w-k1', 'running', 'c1')) },
      { quando: ['network', 'ls'], entao: comSaida(JSON.stringify({ ID: 'n1' })) },
      { quando: ['network', 'inspect'], entao: comSaida(JSON.stringify({ Id: 'n1', Name: 'brabo-qa-w' })) },
    ]);

    const r = await new DockerViaCli(rodar).removerPorProjeto('p9');

    expect(r).toEqual({ containers: ['brabo-qa-w-k1'], redes: ['brabo-qa-w'] });
    const ps = chamadas.find((c) => c[0] === 'ps') as string[];
    expect(ps).toContain('label=brabo.managed=true');
    expect(ps).toContain('label=brabo.project.id=p9');
    const rm = chamadas.findIndex((c) => c[0] === 'rm');
    const netRm = chamadas.findIndex((c) => c[0] === 'network' && c[1] === 'rm');
    expect(chamadas[rm]).toEqual(['rm', '--force', 'c1']);
    expect(chamadas[netRm]).toEqual(['network', 'rm', 'n1']);
    expect(rm).toBeLessThan(netRm);
  });

  it('projectId vazio é recusado antes de qualquer chamada', async () => {
    const { rodar, chamadas } = duplo([]);
    await expect(new DockerViaCli(rodar).removerPorProjeto(' ')).rejects.toThrow();
    expect(chamadas).toHaveLength(0);
  });
});

describe('rede de QA', () => {
  it('nasce com o rótulo brabo.project.id', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['network', 'inspect'], entao: { ...OK, exitCode: 1 } },
      { quando: ['run'], entao: comSaida('c0ffee\n') },
    ]);
    await new DockerViaCli(rodar).start({
      ...SPEC,
      qa: { chave: 'k1', servicos: [{ nome: 'redis', imagem: 'redis:7', usuario: '999:999', dados: ['/data'], compartilhado: true }] },
    });
    const criar = chamadas.find((c) => c[0] === 'network' && c[1] === 'create') as string[];
    expect(criar.join(' ')).toContain(`--label brabo.project.id=${SPEC.projectId}`);
  });
});

describe('DockerViaCli — o rótulo brabo.managed é a fronteira', () => {
  it('recusa agir sobre container homônimo SEM o rótulo, em vez de tratá-lo como ausente', async () => {
    // O primeiro `ps` (filtrado por rótulo) não acha nada; o segundo (só por
    // nome) acha — é exatamente o container de outra pessoa.
    let chamadasDePs = 0;
    const rodar: RodarDocker = async (args) => {
      if (args[0] === 'ps') {
        chamadasDePs += 1;
        return chamadasDePs === 1
          ? comSaida('')
          : comSaida(linhaDePs('brabo-exp002-f52be111', 'running', 'alheio'));
      }
      return OK;
    };

    await expect(new DockerViaCli(rodar).stop('exp002-f52be111')).rejects.toThrowError(
      ContainerNaoGerenciadoError,
    );
  });

  it('a busca do container SEMPRE filtra pelo rótulo', async () => {
    const { rodar, chamadas } = duplo([{ quando: ['ps'], entao: comSaida('') }]);

    await new DockerViaCli(rodar).stop('exp002-f52be111');

    const primeiroPs = chamadas.find((c) => c[0] === 'ps') as string[];
    expect(primeiroPs.join(' ')).toContain(`--filter label=${ROTULO_GERENCIADO}=true`);
    expect(primeiroPs.join(' ')).toContain('--filter name=^/brabo-exp002-f52be111$');
  });

  it('parar o que não existe é no-op, não erro', async () => {
    const { rodar, chamadas } = duplo([{ quando: ['ps'], entao: comSaida('') }]);

    await expect(new DockerViaCli(rodar).stop('exp002-f52be111')).resolves.toBeUndefined();
    expect(chamadas.some((c) => c[0] === 'stop')).toBe(false);
  });
});

describe('DockerViaCli.inspect', () => {
  it('devolve o estado OBSERVADO do daemon', async () => {
    const { rodar } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'running')) },
      {
        quando: ['inspect'],
        entao: comSaida(
          JSON.stringify({
            Id: 'c0ffee',
            Name: '/brabo-exp002-f52be111',
            Config: { Image: 'node:24-bookworm' },
            State: { Status: 'running', StartedAt: '2026-09-01T10:00:00.000Z' },
          }),
        ),
      },
    ]);

    await expect(new DockerViaCli(rodar).inspect('exp002-f52be111')).resolves.toEqual({
      containerId: 'c0ffee',
      nome: 'brabo-exp002-f52be111',
      estado: 'running',
      imagem: 'node:24-bookworm',
      iniciadoEm: '2026-09-01T10:00:00.000Z',
    });
  });

  it('ausência é `null`, e não um estado inventado', async () => {
    const { rodar } = duplo([{ quando: ['ps'], entao: comSaida('') }]);
    await expect(new DockerViaCli(rodar).inspect('exp002-f52be111')).resolves.toBeNull();
  });

  it('a data zero do daemon vira `null` — ano 1 numa tela é pior que ausência declarada', async () => {
    const { rodar } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'created')) },
      {
        quando: ['inspect'],
        entao: comSaida(
          JSON.stringify({
            Id: 'c0ffee',
            Config: { Image: 'node:24-bookworm' },
            State: { Status: 'created', StartedAt: '0001-01-01T00:00:00Z' },
          }),
        ),
      },
    ]);

    const observado = await new DockerViaCli(rodar).inspect('exp002-f52be111');
    expect(observado?.iniciadoEm).toBeNull();
    expect(observado?.estado).toBe('created');
  });
});

describe('DockerViaCli.exec', () => {
  it('roda o comando como UM argumento de `sh -c`, com o workdir do bind', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'running')) },
      { quando: ['exec'], entao: { ...OK, stdout: 'ola brabo' } },
    ]);

    const resultado = await new DockerViaCli(rodar).exec('exp002-f52be111', {
      comando: 'echo -n "ola brabo" && exit 0',
    });

    expect(resultado).toEqual({ exitCode: 0, output: 'ola brabo', timedOut: false });
    const exec = chamadas.find((c) => c[0] === 'exec') as string[];
    expect(exec.slice(-5, -1)).toEqual(['/bin/sh', '-c', EMBRULHO_DO_EXEC, 'brabo-exec']);
    expect(exec).toContain('BRABO_EXEC_CMD=echo -n "ola brabo" && exit 0');
    expect(exec.slice(exec.indexOf('/bin/sh')).join(' ')).not.toContain('ola brabo');
    expect(exec.join(' ')).toContain('--workdir /work');
  });

  it('combina stdout e stderr, como o executor da máquina faz', async () => {
    const { rodar } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'running')) },
      { quando: ['exec'], entao: { exitCode: 3, stdout: 'out', stderr: 'err', timedOut: false } },
    ]);

    const resultado = await new DockerViaCli(rodar).exec('exp002-f52be111', { comando: 'x' });
    expect(resultado.output).toBe('outerr');
    expect(resultado.exitCode).toBe(3);
  });

  it('trunca a saída no teto, com marca que declara o tamanho REAL', async () => {
    const { rodar } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'running')) },
      { quando: ['exec'], entao: comSaida('a'.repeat(500)) },
    ]);

    const resultado = await new DockerViaCli(rodar).exec('exp002-f52be111', {
      comando: 'x',
      maxBytes: 100,
    });

    expect(resultado.output.startsWith('a'.repeat(100))).toBe(true);
    expect(resultado.output).toContain('100 de 500 bytes');
  });

  it('timeout devolve o sentinela -1 e DIZ que o processo pode ter sobrevivido', async () => {
    const { rodar } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'running')) },
      { quando: ['exec'], entao: { exitCode: -1, stdout: '', stderr: '', timedOut: true } },
    ]);

    const resultado = await new DockerViaCli(rodar).exec('exp002-f52be111', {
      comando: 'sleep 60',
      timeoutMs: 200,
    });

    expect(resultado.timedOut).toBe(true);
    expect(resultado.exitCode).toBe(-1);
    expect(resultado.output).toContain('pode continuar rodando DENTRO do container');
  });

  it('no estouro mata o grupo do comando DENTRO do container, pelo mesmo marcador (RN-807)', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'running')) },
      { quando: ['exec', '--workdir'], entao: { exitCode: -1, stdout: '', stderr: '', timedOut: true } },
    ]);

    const resultado = await new DockerViaCli(rodar).exec('exp002-f52be111', {
      comando: 'sleep 60',
      timeoutMs: 200,
    });

    const [execDoComando, kill] = chamadas.filter((c) => c[0] === 'exec');
    expect(kill?.at(-2)).toBe('brabo-kill');
    expect(kill?.at(-1)).toBe(execDoComando?.at(-1));
    expect(resultado.exitCode).toBe(-1);
    expect(resultado.output).toContain('foi encerrado DENTRO do container');
  });

  it('sem container de pé não há onde executar — lança em vez de devolver saída vazia', async () => {
    const { rodar } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'exited')) },
    ]);

    await expect(
      new DockerViaCli(rodar).exec('exp002-f52be111', { comando: 'x' }),
    ).rejects.toThrowError(ContainerAusenteError);
  });
});

describe('DockerViaCli — falha classificada, nunca stack trace cru', () => {
  it('daemon fora vira DockerIndisponivelError, com origem infra e o que fazer', async () => {
    // `docker version` reprova: é ele quem responde "o cliente alcança o
    // servidor?", e é por ele que a classificação passa — nunca por substring
    // da mensagem de um comando qualquer.
    const rodar: RodarDocker = async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock.',
      timedOut: false,
    });

    const erro = await new DockerViaCli(rodar, '/var/run/docker.sock')
      .ping()
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(DockerIndisponivelError);
    const indisponivel = erro as DockerIndisponivelError;
    expect(indisponivel.origem).toBe('infra');
    expect(indisponivel.name).toBe('DockerIndisponivelError');
    expect(indisponivel.endereco).toBe('/var/run/docker.sock');
    // A mensagem ENSINA — é lida por quem está na frente da própria máquina.
    expect(indisponivel.message).toContain('docker info');
    expect(indisponivel.message).toContain('grupo `docker`');
    expect(indisponivel.message).toContain('Nenhum container foi tocado');
  });

  it('daemon fora no meio de uma operação também vira o erro NOMEADO', async () => {
    // Toda chamada falha — inclusive o `version` de confirmação, que é como o
    // adaptador separa "daemon fora" de "daemon recusou este comando".
    const rodar: RodarDocker = async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'Cannot connect to the Docker daemon',
      timedOut: false,
    });

    await expect(new DockerViaCli(rodar).start(SPEC)).rejects.toThrowError(DockerIndisponivelError);
  });

  it('daemon VIVO que recusa o comando não vira falha de infra — o motivo dele é repassado', async () => {
    const rodar: RodarDocker = async (args) => {
      if (args[0] === 'version') return OK; // o daemon está lá
      if (args[0] === 'ps') return comSaida('');
      return {
        exitCode: 125,
        stdout: '',
        stderr: 'docker: Error response from daemon: No such image: node:24-bookworm',
        timedOut: false,
      };
    };

    const erro = await new DockerViaCli(rodar)
      .start(SPEC)
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ComandoDeDockerFalhouError);
    const falha = erro as ComandoDeDockerFalhouError;
    expect(falha.exitCode).toBe(125);
    expect(falha.message).toContain('No such image');
    // Sem `origem`: classificar isto seria diagnóstico por eliminação, que é o
    // que o ADR 0020 registra como o defeito a não repetir.
    expect('origem' in falha).toBe(false);
  });

  it('o executável `docker` ausente é um erro PRÓPRIO, não "daemon fora"', async () => {
    // O ÚNICO teste desta suíte que executa `execFile` de verdade — e ele
    // existe porque os dois casos parecem o mesmo para quem lê "não consegui
    // falar com o Docker", e se consertam de formas diferentes: instalar o
    // Docker, ou subir o daemon. É a mesma lição da RN-475 (chave ausente vs.
    // chave recusada), aplicada um andar abaixo.
    //
    // `PATH` vazio é o que torna o caso REPRODUZÍVEL numa máquina que TEM
    // Docker instalado — sem ele, este teste só passaria onde não há docker,
    // que é justamente onde ninguém o roda.
    const pathOriginal = process.env.PATH;
    process.env.PATH = '';
    try {
      const erro = await rodarDockerDeVerdade(['version'], 5_000).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(DockerCliAusenteError);
      const ausente = erro as DockerCliAusenteError;
      expect(ausente.origem).toBe('infra');
      expect(ausente.message).toContain('não encontrei o executável `docker`');
      expect(ausente.message).toContain('Nenhum container foi tocado');
    } finally {
      process.env.PATH = pathOriginal;
    }
  });
});

/**
 * AT-234 — nasceu como REPRODUÇÃO, vermelha na base `73ba0b2bca`: o pull de
 * uma imagem ausente acontecia DENTRO do `docker run`, sob o teto de controle
 * de 30 s, e o estouro saía como "código -1, sem saída de erro" — sem nome, e
 * com `origem: null` do broker até a api.
 *
 * A asserção MUDOU com a decisão do mantenedor (opção D, RN-605): só dar nome.
 * O pull passa a ser um passo explícito (`image inspect` → `pull`) sob o MESMO
 * teto de controle; imagem cujo pull passa dele NÃO sobe, e o desfecho é
 * `PullExcedeuTetoError`, com `origem: 'infra'`. O caso em que o pull cabe no
 * teto continua subindo.
 *
 * O duplo modela o DAEMON, não a implementação: ele lembra se a imagem está
 * presente, e um `docker run` de imagem AUSENTE faz o pull dentro dele (como o
 * CLI de verdade faz). O tempo é simulado — `rodar` recebe o teto que o
 * adaptador aplicou e responde `timedOut` quando a operação levaria mais que
 * ele —, então o teste não dorme e não depende de rede.
 */
describe('DockerViaCli.start — imagem ausente cujo pull passa do teto de controle (AT-234)', () => {
  function daemonComImagemAusente(pullSimuladoMs: number): {
    rodar: RodarDocker;
    chamadas: Array<{ args: string[]; timeoutMs: number }>;
  } {
    let imagemPresente = false;
    const chamadas: Array<{ args: string[]; timeoutMs: number }> = [];
    const rodar: RodarDocker = async (args, timeoutMs) => {
      chamadas.push({ args: [...args], timeoutMs });
      const [verbo, sub] = args;
      if (verbo === 'image' && sub === 'inspect') {
        return imagemPresente
          ? OK
          : { ...OK, exitCode: 1, stderr: `Error: No such image: ${SPEC.imagem}` };
      }
      if (verbo === 'pull') {
        if (timeoutMs < pullSimuladoMs) return { ...OK, exitCode: -1, timedOut: true };
        imagemPresente = true;
        return OK;
      }
      if (verbo === 'run') {
        const duracao = imagemPresente ? 1_000 : pullSimuladoMs;
        if (timeoutMs < duracao) return { ...OK, exitCode: -1, timedOut: true };
        imagemPresente = true;
        return comSaida('c0ffeebabe\n');
      }
      // `ps` vazio (nenhum container) e `version` respondendo (daemon vivo).
      return OK;
    };
    return { rodar, chamadas };
  }

  it('pull de 45 s NÃO sobe, e o desfecho é NOMEADO — nunca "código -1, sem saída de erro"', async () => {
    const { rodar, chamadas } = daemonComImagemAusente(45_000);

    const erro = await new DockerViaCli(rodar).start(SPEC).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(PullExcedeuTetoError);
    const pull = erro as PullExcedeuTetoError;
    expect(pull.name).toBe('PullExcedeuTetoError');
    expect(pull.origem).toBe('infra');
    expect(pull.imagem).toBe(SPEC.imagem);
    expect(pull.tetoMs).toBe(TIMEOUT_DE_CONTROLE_MS);
    // A mensagem diz a imagem, o teto e a CONSEQUÊNCIA inteira.
    expect(pull.message).toContain(SPEC.imagem);
    expect(pull.message).toContain(`${TIMEOUT_DE_CONTROLE_MS}ms`);
    expect(pull.message).toContain('foi cancelado');
    expect(pull.message).toContain('Imagem grande não sobe por este caminho');
    expect(pull.message).toContain('Nenhum container foi criado');
    // O pull rodou sob o MESMO teto de controle (opção D: nada de teto maior),
    // e nenhum `run` foi tentado depois dele.
    const doPull = chamadas.find((c) => c.args[0] === 'pull');
    expect(doPull?.timeoutMs).toBe(TIMEOUT_DE_CONTROLE_MS);
    expect(chamadas.some((c) => c.args[0] === 'run')).toBe(false);
  });

  it('pull que estoura com o daemon FORA é daemon fora, não pull longo', async () => {
    const { rodar: base } = daemonComImagemAusente(45_000);
    const rodar: RodarDocker = async (args, timeoutMs) =>
      args[0] === 'version'
        ? { ...OK, exitCode: 1, stderr: 'Cannot connect to the Docker daemon' }
        : base(args, timeoutMs);

    await expect(new DockerViaCli(rodar).start(SPEC)).rejects.toThrowError(
      DockerIndisponivelError,
    );
  });

  it('pull que CABE no teto sobe na primeira tentativa, com o pull antes do `run`', async () => {
    const { rodar, chamadas } = daemonComImagemAusente(20_000);

    const iniciado = await new DockerViaCli(rodar).start(SPEC);

    expect(iniciado).toEqual({
      containerId: 'c0ffeebabe',
      nome: 'brabo-exp002-f52be111',
      jaEstavaDePe: false,
      recriado: false,
    });
    const verbos = chamadas.map((c) => c.args[0]);
    expect(verbos.indexOf('pull')).toBeGreaterThan(-1);
    expect(verbos.indexOf('pull')).toBeLessThan(verbos.indexOf('run'));
  });

  it('imagem já presente não é baixada de novo', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['image', 'inspect'], entao: comSaida('sha256:abc\n') },
      { quando: ['run'], entao: comSaida('c0ffeebabe\n') },
    ]);

    await new DockerViaCli(rodar).start(SPEC);

    expect(chamadas.some((c) => c[0] === 'pull')).toBe(false);
  });

  it('o pior caso do `start` tem NOVE chamadas de controle em série', () => {
    // ps gerenciado + inspect do hash + rm + image inspect + pull + run +
    // version + (ps + rm do resto do `run`). É o número de que a api
    // (`TETO_DE_MUTACAO_MS`) e o engine derivam os tetos deles (RN-605);
    // mudou aqui, muda lá.
    expect(CHAMADAS_DE_CONTROLE_NO_START).toBe(9);
  });
});

describe('estourouOTeto (RN-807)', () => {
  it('erro nulo depois do teto É estouro — o `docker exec` sai 0 ao receber SIGTERM', () => {
    expect(estourouOTeto(3_010, 3_000, null)).toBe(true);
  });

  it('comando que termina antes do teto não é estouro, com ou sem erro', () => {
    expect(estourouOTeto(120, 3_000, null)).toBe(false);
    expect(estourouOTeto(120, 3_000, Object.assign(new Error('x'), { killed: false }))).toBe(false);
  });
});

/**
 * O defeito só existe com o CLIENTE `docker exec` de verdade — processo local
 * morre do SIGTERM e marca `killed`. Sem Docker na máquina, pula NOMEANDO.
 */
const temDocker = await (async () => {
  try {
    const r = await rodarDockerDeVerdade(['version', '--format', '{{.Server.Version}}'], 5_000);
    return r.exitCode === 0 && !r.timedOut;
  } catch {
    return false;
  }
})();

describe.skipIf(!temDocker)('DockerViaCli.exec contra Docker real (sem daemon: pulado)', () => {
  it('o comando que estoura volta timedOut e MORRE dentro do container', async () => {
    const nome = `brabo-at482-${process.pid}`;
    const criado = await rodarDockerDeVerdade(
      ['run', '-d', '--rm', '--name', nome, 'alpine:3.20', 'sleep', '120'],
      60_000,
    );
    expect(criado.exitCode).toBe(0);
    try {
      // `ps` responde pelo duplo (o container de teste não leva o rótulo
      // gerenciado); o id devolvido é o nome do container REAL, e todo o
      // resto vai ao CLI de verdade.
      const docker = new DockerViaCli((args, t) =>
        args[0] === 'ps'
          ? Promise.resolve(comSaida(linhaDePs('brabo-at482', 'running', nome)))
          : rodarDockerDeVerdade(args, t),
      );

      const ok = await docker.exec('at482', { comando: 'echo -n oi', cwd: '/' });
      expect(ok).toEqual({ exitCode: 0, output: 'oi', timedOut: false });

      const estouro = await docker.exec('at482', {
        comando: 'sleep 30; echo FIM',
        cwd: '/',
        timeoutMs: 2_000,
      });
      expect(estouro.timedOut).toBe(true);
      expect(estouro.exitCode).toBe(-1);
      expect(estouro.output).toContain('foi encerrado DENTRO do container');

      const ps = await rodarDockerDeVerdade(['exec', nome, 'ps', '-o', 'stat,args'], 10_000);
      const vivos = ps.stdout.split('\n').filter((l) => l.includes('sleep 30') && !/^\s*Z/.test(l));
      expect(vivos).toEqual([]);

      // RN-947: o comando não está no argv de processo nenhum.
      const auto = await docker.exec('at482', {
        comando: 'pkill -f "trecho-unico-947"; echo VIVO',
        cwd: '/',
      });
      expect(auto).toEqual({ exitCode: 0, output: 'VIVO\n', timedOut: false });

      const filho = await docker.exec('at482', {
        comando: 'sleep 300 & echo $! >/tmp/p947; pkill -f "sleep 300"; sleep 1; echo OK',
        cwd: '/',
      });
      expect(filho.exitCode).toBe(0);
      expect(filho.output).toContain('OK');
      const vivo = await rodarDockerDeVerdade(['exec', nome, 'ps', '-o', 'stat,args'], 10_000);
      expect(vivo.stdout.split('\n').filter((l) => l.includes('sleep 300') && !/^\s*Z/.test(l))).toEqual([]);

      expect((await docker.exec('at482', { comando: 'exit 3', cwd: '/' })).exitCode).toBe(3);

      const seguro = docker.exec('at482', { comando: 'sleep 20; echo marca-947-visivel', cwd: '/', timeoutMs: 8_000 });
      await new Promise((r) => setTimeout(r, 1_500));
      const ps947 = await rodarDockerDeVerdade(['exec', nome, 'ps', '-eo', 'args'], 10_000);
      expect(ps947.stdout).not.toContain('marca-947-visivel');
      await seguro;
    } finally {
      await rodarDockerDeVerdade(['rm', '-f', nome], 30_000);
    }
  }, 90_000);
});

describe('DockerViaCli — spec ampliada (ADR 0228/0229)', () => {
  const rodarStart = async (spec: EspecificacaoDeContainer) => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['run'], entao: comSaida('c0ffeebabe\n') },
    ]);
    await new DockerViaCli(rodar).start(spec);
    return chamadas.find((c) => c[0] === 'run') as string[];
  };

  it('NÃO-REGRESSÃO: campos novos ausentes = run byte a byte o de sempre', async () => {
    const args = await rodarStart(SPEC);
    // O único acréscimo ao run de sempre é o rótulo de hash, logo depois do `run`.
    expect(args.slice(0, 3)).toEqual(['run', '--label', expect.stringMatching(/^brabo\.spec\.hash=[0-9a-f]{64}$/)]);
    expect(['run', ...args.slice(3)]).toEqual([
      'run', '--detach', '--init', '--restart', 'unless-stopped',
      '--name', 'brabo-exp002-f52be111',
      '--label', 'brabo.managed=true',
      '--label', `brabo.project.id=${SPEC.projectId}`,
      '--label', 'brabo.project.slug=exp002',
      '--label', `brabo.workspace.id=${SPEC.workspaceId}`,
      '--label', 'brabo.image.version=3',
      '--volume', '/home/alguem/dev/exp002:/work:rw',
      '--workdir', '/work',
      '--network', 'bridge',
      '--cpus', '2', '--memory', '2048m', '--pids-limit', '512',
      '--cap-drop', 'ALL',
      'node:24-bookworm', 'sleep', 'infinity',
    ]);
  });

  it('comandoDoApp vai como ARGUMENTO do supervisor constante; aspas, ; e $() não escapam', async () => {
    const comando = `echo "a'b"; $(rm -rf /) \`x\``;
    const args = await rodarStart({ ...SPEC, comandoDoApp: comando });
    const i = args.indexOf('node:24-bookworm');
    expect(args.slice(i + 1, i + 4)).toEqual(['/bin/sh', '-c', SUPERVISOR_DO_APP]);
    expect(args.slice(i + 4)).toEqual(['brabo-app', comando]);
    expect(SUPERVISOR_DO_APP).not.toContain(comando);
    expect(args).not.toContain('infinity');
  });

  it('portas só em 127.0.0.1, dns e add-host', async () => {
    const args = await rodarStart({
      ...SPEC,
      portas: [{ host: 8080, container: 3000, protocolo: 'tcp' }],
      dns: ['1.1.1.1'],
      hostsExtras: [{ nome: 'meu.host', ip: '10.0.0.5' }],
    });
    expect(args.join(' ')).toContain('-p 127.0.0.1:8080:3000 --dns 1.1.1.1 --add-host meu.host:10.0.0.5');
    expect(args.join(' ')).not.toContain('0.0.0.0');
  });

  it('inspect lê NetworkSettings.Ports como portasPublicadas', async () => {
    const { rodar } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'running')) },
      {
        quando: ['inspect'],
        entao: comSaida(
          JSON.stringify({
            Id: 'abc',
            State: { Status: 'running', StartedAt: '2026-10-29T10:00:00Z' },
            Config: { Image: 'x:1' },
            NetworkSettings: {
              Ports: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '8080' }], '9/tcp': null },
            },
          }),
        ),
      },
    ]);
    const e = await new DockerViaCli(rodar).inspect('exp002-f52be111');
    expect(e?.portasPublicadas).toEqual([
      { ip: '127.0.0.1', host: 8080, container: 3000, protocolo: 'tcp' },
    ]);
  });

  const DIGEST = `postgres@sha256:${'a'.repeat(64)}`;
  const NOME_QA = 'brabo-qa-exp002-f52be111-abcd1234';
  const QA: EspecificacaoDeContainer = {
    ...SPEC,
    qa: {
      chave: 'abcd1234',
      servicos: [
        {
          nome: 'db',
          imagem: DIGEST,
          env: { POSTGRES_PASSWORD: 'x' },
          usuario: '999:999',
          dados: ['/var/lib/postgresql/data'],
        },
      ],
    },
  };

  it('QA: sem --restart, rótulos de QA, serviço em container:<qa> com cap-drop e sem porta', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['run'], entao: comSaida('id\n') },
    ]);
    const r = await new DockerViaCli(rodar, undefined, SEM_ESPERA).start(QA);
    expect(r.nome).toBe(NOME_QA);
    const runs = chamadas.filter((c) => c[0] === 'run');
    const qa = runs[0] as string[];
    expect(qa).not.toContain('--restart');
    expect(qa.join(' ')).toContain('--label brabo.papel=qa --label brabo.qa.instancia=abcd1234');
    const svc = (runs[1] as string[]).join(' ');
    expect(svc).toContain(`--network container:${NOME_QA}`);
    expect(svc).toContain('--cap-drop ALL');
    expect(svc).toContain('--tmpfs /var/lib/postgresql/data');
    expect(svc).toContain('--label brabo.papel=qa');
    expect(svc).not.toMatch(/--privileged|--cap-add|--publish| -p /);
  });

  it('QA: serviço PRÓPRIO tem nome <instância>-<serviço> (nunca o da instância), --user, dono do tmpfs e comando depois da imagem', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['run'], entao: comSaida('id\n') },
    ]);
    const spec: EspecificacaoDeContainer = {
      ...QA,
      qa: {
        chave: 'abcd1234',
        servicos: [
          { nome: 'db', imagem: DIGEST, usuario: '70:70', dados: ['/var/lib/postgresql/data'] },
          { nome: 'web', imagem: DIGEST, usuario: '33:33', dados: ['/srv'], comando: ['httpd', '-f', '-p', '9000'] },
        ],
      },
    };
    await new DockerViaCli(rodar, undefined, SEM_ESPERA).start(spec);
    const runs = chamadas.filter((c) => c[0] === 'run') as string[][];
    const nomeDe = (a: string[]) => a[a.indexOf('--name') + 1];
    expect(nomeDe(runs[0] as string[])).toBe(NOME_QA);
    expect(nomeDe(runs[1] as string[])).toBe(`${NOME_QA}-db`);
    expect(nomeDe(runs[1] as string[])).not.toBe(NOME_QA);
    const db = (runs[1] as string[]).join(' ');
    expect(db).toContain('--user 70:70');
    expect(db).toContain('--tmpfs /var/lib/postgresql/data:uid=70,gid=70,mode=0700');
    const web = runs[2] as string[];
    expect(web.slice(-5)).toEqual([DIGEST, 'httpd', '-f', '-p', '9000']);
    expect(web.join(' ')).toContain('--user 33:33');
    expect(db).toContain('--cap-drop ALL');
    expect(db).not.toMatch(/--privileged|--cap-add|--publish| -p /);
  });

  it('QA: remove só alcança brabo.papel=qa; homônimo sem o papel é não gerenciado e nada é removido', async () => {
    const chamadas: string[][] = [];
    const rodar: RodarDocker = async (args) => {
      chamadas.push([...args]);
      if (args[0] !== 'ps') return OK;
      // O container existe, mas SEM o rótulo de QA: só o `ps` sem filtro de papel o vê.
      return args.includes('label=brabo.papel=qa') || args.some((a) => a.startsWith('label=brabo.qa.dono'))
        ? comSaida('')
        : args.includes('label=brabo.managed=true')
          ? comSaida('')
          : comSaida(linhaDePs(NOME_QA, 'running'));
    };
    await expect(
      new DockerViaCli(rodar, undefined, SEM_ESPERA).remove('exp002-f52be111', { papel: 'qa', chave: 'abcd1234' }),
    ).rejects.toBeInstanceOf(ContainerNaoGerenciadoError);
    expect(chamadas.flat()).toContain('label=brabo.papel=qa');
    expect(chamadas.some((c) => c[0] === 'rm')).toBe(false);
  });

  it('QA: remove apaga os serviços da instância por rótulo e depois a instância', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs(NOME_QA, 'running', 'qaid')) },
    ]);
    await new DockerViaCli(rodar, undefined, SEM_ESPERA).remove('exp002-f52be111', { papel: 'qa', chave: 'abcd1234' });
    expect(chamadas.flat()).toContain(`label=brabo.qa.dono=${NOME_QA}`);
    expect(chamadas.filter((c) => c[0] === 'rm').every((c) => c[1] === '--force')).toBe(true);
  });

  it('QA: serviço compartilhado vive em rede privada --internal e a instância se liga a ela', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['network', 'inspect'], entao: { ...OK, exitCode: 1 } },
      { quando: ['run'], entao: comSaida('id\n') },
    ]);
    await new DockerViaCli(rodar, undefined, SEM_ESPERA).start({
      ...SPEC,
      qa: { chave: 'abcd1234', servicos: [{ nome: 'db', imagem: DIGEST, usuario: '999:999', dados: ['/data'], compartilhado: true }] },
    });
    const j = chamadas.map((c) => c.join(' '));
    expect(j.some((c) => c.startsWith('network create --internal'))).toBe(true);
    expect(
      j.some((c) => c.includes('--label brabo.qa.compartilhado=1') && c.includes('--network-alias db')),
    ).toBe(true);
    expect(j).toContain(`network connect brabo-qa-exp002-f52be111 ${NOME_QA}`);
  });
});

describe('DockerViaCli — serviços no container de trabalho e run.env (RN-1518)', () => {
  const DIGEST = `postgres@sha256:${'b'.repeat(64)}`;
  const NOME = 'brabo-exp002-f52be111';
  const COM_BANCO: EspecificacaoDeContainer = {
    ...SPEC,
    env: { DATABASE_URL: 'postgres://teste:teste@127.0.0.1:5432/teste' },
    servicos: [
      { nome: 'db', imagem: DIGEST, usuario: '999:999', dados: ['/var/lib/postgresql/data'] },
    ],
  };
  const runs = (chamadas: string[][]) => chamadas.filter((c) => c[0] === 'run');
  const nomeDe = (a: string[]) => a[a.indexOf('--name') + 1];

  it('serviço no localhost do trabalho (container:<trabalho>), --env no trabalho, dono pelo rótulo', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['run'], entao: comSaida('id\n') },
    ]);
    await new DockerViaCli(rodar, undefined, SEM_ESPERA).start(COM_BANCO);
    const [trabalho, servico] = runs(chamadas) as [string[], string[]];
    expect(trabalho.join(' ')).toContain('--env DATABASE_URL=postgres://teste:teste@127.0.0.1:5432/teste');
    expect(nomeDe(servico)).toBe(`${NOME}-db`);
    const s = servico.join(' ');
    expect(s).toContain(`--network container:${NOME}`);
    expect(s).toContain(`--label brabo.qa.dono=${NOME}`);
    expect(s).toContain('--cap-drop ALL');
    expect(s).toContain('--tmpfs /var/lib/postgresql/data:uid=999,gid=999,mode=0700');
    expect(s).not.toMatch(/--privileged|--cap-add|--publish| -p /);
  });

  it('sem serviço nem env o start é o de sempre: mesmo hash e nenhuma chamada a mais', async () => {
    const a = duplo([{ quando: ['ps'], entao: comSaida('') }]);
    await new DockerViaCli(a.rodar, undefined, SEM_ESPERA).start(SPEC);
    const b = duplo([{ quando: ['ps'], entao: comSaida('') }]);
    await new DockerViaCli(b.rodar, undefined, SEM_ESPERA).start({ ...SPEC, servicos: [] });
    expect(b.chamadas).toEqual(a.chamadas);
    expect(a.chamadas.filter((c) => c[0] === 'run')).toHaveLength(1);
  });

  it('declarar serviço muda o hash da spec (recria o trabalho parado)', async () => {
    const hash = async (spec: EspecificacaoDeContainer) => {
      const { rodar, chamadas } = duplo([{ quando: ['ps'], entao: comSaida('') }]);
      await new DockerViaCli(rodar, undefined, SEM_ESPERA).start(spec);
      return (runs(chamadas)[0] as string[])[2];
    };
    expect(await hash(COM_BANCO)).not.toBe(await hash(SPEC));
  });

  it('falha no serviço desfaz os serviços e o trabalho, e relança o erro', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs(`${NOME}-db`, 'running', 'svc1')) },
    ]);
    let n = 0;
    const falha: RodarDocker = async (args, t) => {
      if (args[0] === 'run' && ++n === 2) return { ...OK, exitCode: 125, stderr: 'boom' };
      return rodar(args, t);
    };
    await expect(new DockerViaCli(falha, undefined, SEM_ESPERA).start(COM_BANCO)).rejects.toBeInstanceOf(
      ComandoDeDockerFalhouError,
    );
    const rm = chamadas.filter((c) => c[0] === 'rm');
    expect(rm.length).toBeGreaterThanOrEqual(1);
  });

  it('stop e remove do trabalho levam os serviços (rótulo de dono)', async () => {
    for (const op of ['stop', 'remove'] as const) {
      const { rodar, chamadas } = duplo([
        { quando: ['ps'], entao: comSaida(linhaDePs(NOME, 'running')) },
      ]);
      await new DockerViaCli(rodar, undefined, SEM_ESPERA)[op]('exp002-f52be111');
      expect(
        chamadas.some((c) => c[0] === 'ps' && c.join(' ').includes(`label=brabo.qa.dono=${NOME}`)),
      ).toBe(true);
    }
  });

  it('trabalho parado com a MESMA spec é religado e os serviços são recriados', async () => {
    const hashSpec = duplo([{ quando: ['ps'], entao: comSaida('') }]);
    await new DockerViaCli(hashSpec.rodar, undefined, SEM_ESPERA).start(COM_BANCO);
    const rotulo = (runs(hashSpec.chamadas)[0] as string[])[2]?.split('=')[1];
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs(NOME, 'exited')) },
      { quando: ['inspect'], entao: comSaida(JSON.stringify({ Config: { Labels: { 'brabo.spec.hash': rotulo } } })) },
    ]);
    const r = await new DockerViaCli(rodar, undefined, SEM_ESPERA).start(COM_BANCO);
    expect(r.recriado).toBe(false);
    expect(chamadas.some((c) => c[0] === 'start')).toBe(true);
    expect(nomeDe(runs(chamadas)[0] as string[])).toBe(`${NOME}-db`);
  });
});

describe('serviço de dados conferido (RN-1539, RN-1540)', () => {
  const DIGEST = `postgres@sha256:${'c'.repeat(64)}`;
  const NOME = 'brabo-exp002-f52be111';
  const SENHA = 'senha-secreta-123';
  const COM_BANCO: EspecificacaoDeContainer = {
    ...SPEC,
    servicos: [
      {
        nome: 'db',
        imagem: DIGEST,
        env: { POSTGRES_PASSWORD: SENHA },
        usuario: '999:999',
        dados: ['/var/lib/postgresql/data'],
      },
    ],
  };
  const duploComEstado = (estado: object, log = '') =>
    duplo([
      { quando: ['ps'], entao: comSaida('') },
      { quando: ['run'], entao: comSaida('id\n') },
      { quando: ['inspect'], entao: comSaida(JSON.stringify({ State: estado })) },
      { quando: ['logs'], entao: { ...OK, stderr: log } },
    ]);

  it('serviço que saiu: ServicoDeDadosMorreuError com código, 3 últimas linhas e env mascarado, sem resto', async () => {
    const { rodar, chamadas } = duploComEstado(
      { Status: 'exited', ExitCode: 1 },
      `l1\nl2 ${SENHA}\nl3\nfailed switching to 'postgres': operation not permitted ${SENHA}\n`,
    );
    const espera: number[] = [];
    const erro = await new DockerViaCli(rodar, undefined, async (ms) => void espera.push(ms))
      .start(COM_BANCO)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ServicoDeDadosMorreuError);
    const e = erro as ServicoDeDadosMorreuError;
    expect(e.code).toBe('servico_de_dados_morreu');
    expect(e.exitCode).toBe(1);
    expect(e.servico).toBe('db');
    expect(e.ultimasLinhas).toEqual(['l2 ***', 'l3', "failed switching to 'postgres': operation not permitted ***"]);
    expect(e.message).not.toContain(SENHA);
    expect(espera).toEqual([JANELA_DE_CONFERENCIA_DE_SERVICO_MS]);
    expect(chamadas.some((c) => c[0] === 'logs' && c.includes('3'))).toBe(true);
    // o catch de `criar` procura os serviços do dono para remover (RN-1502)
    expect(chamadas.some((c) => c[0] === 'ps' && c.join(' ').includes(`label=brabo.qa.dono=${NOME}`))).toBe(true);
  });

  it('serviço de pé depois da janela: o start devolve normalmente', async () => {
    const { rodar } = duploComEstado({ Status: 'running', ExitCode: 0 });
    const r = await new DockerViaCli(rodar, undefined, SEM_ESPERA).start(COM_BANCO);
    expect(r.nome).toBe(NOME);
  });

  it('instância de QA: serviço próprio que saiu também falha nomeado', async () => {
    const { rodar } = duploComEstado({ Status: 'exited', ExitCode: 137 });
    const spec: EspecificacaoDeContainer = {
      ...SPEC,
      qa: { chave: 'abcd1234', servicos: COM_BANCO.servicos ?? [] },
    };
    await expect(new DockerViaCli(rodar, undefined, SEM_ESPERA).start(spec)).rejects.toMatchObject({
      code: 'servico_de_dados_morreu',
      exitCode: 137,
    });
  });

  it('todo rm --force de serviço leva -v (sem volume anônimo)', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs(NOME, 'running', 'svc1')) },
    ]);
    await new DockerViaCli(rodar, undefined, SEM_ESPERA).stop('exp002-f52be111');
    const rm = chamadas.filter((c) => c[0] === 'rm');
    expect(rm.length).toBeGreaterThan(0);
    expect(rm.every((c) => c.includes('-v'))).toBe(true);
  });

  it('nenhum caminho monta o run de serviço sem usuario ou dados, e o cap-drop segue ALL sem cap-add', () => {
    const base = { nome: 'db', imagem: DIGEST };
    expect(() => argsDeServicoDeQa(SPEC, base, 'x-db', 'container:x', 'x')).toThrow(EspecificacaoInvalidaError);
    expect(() => argsDeServicoDeQa(SPEC, { ...base, usuario: '999:999' }, 'x-db', 'container:x', 'x')).toThrow(
      EspecificacaoInvalidaError,
    );
    const args = argsDeServicoDeQa(SPEC, { ...base, usuario: '999:999', dados: ['/d'] }, 'x-db', 'container:x', 'x');
    expect(args.join(' ')).toContain('--cap-drop ALL --tmpfs /tmp --user 999:999 --tmpfs /d:uid=999,gid=999,mode=0700');
    expect(args).not.toContain('--cap-add');
  });
});

describe('DockerViaCli.reiniciarApp (RN-1024)', () => {
  const rodando = { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'running')) };

  it('o comando viaja só como $1 do script constante, e nenhuma outra chamada é feita', async () => {
    const comando = `echo "a'b"; $(rm -rf /) \`x\``;
    const { rodar, chamadas } = duplo([rodando, { quando: ['exec'], entao: OK }]);
    const r = await new DockerViaCli(rodar).reiniciarApp('exp002-f52be111', comando);
    expect(r).toEqual({ reiniciou: true });
    const exec = chamadas.filter((c) => c[0] === 'exec');
    expect(exec).toEqual([['exec', 'c0ffee', '/bin/sh', '-c', REINICIAR_APP, 'brabo-restart', comando]]);
    expect(REINICIAR_APP).not.toContain(comando);
    expect(chamadas.some((c) => ['stop', 'rm', 'run', 'start'].includes(c[0] ?? ''))).toBe(false);
  });

  it('sem container running: motivo sem_container, sem exec', async () => {
    const { rodar, chamadas } = duplo([
      { quando: ['ps'], entao: comSaida(linhaDePs('brabo-exp002-f52be111', 'exited')) },
    ]);
    expect(await new DockerViaCli(rodar).reiniciarApp('exp002-f52be111', 'x')).toEqual({
      reiniciou: false,
      motivo: 'sem_container',
    });
    expect(chamadas.some((c) => c[0] === 'exec')).toBe(false);
  });

  it('app que caiu: app_saiu com o código, sem repassar stdout/stderr (nunca log)', async () => {
    const { rodar } = duplo([
      rodando,
      { quando: ['exec'], entao: { exitCode: 64, stdout: 'app-exit:3\n', stderr: 'JWT_SECRET=abc', timedOut: false } },
    ]);
    const r = await new DockerViaCli(rodar).reiniciarApp('exp002-f52be111', 'x');
    expect(r).toEqual({ reiniciou: false, motivo: 'app_saiu', exitCode: 3 });
    expect(JSON.stringify(r)).not.toContain('JWT_SECRET');
  });

  it('timeout e falha de exec têm motivo próprio; 64 sem app-exit é falha_no_exec', async () => {
    const t = duplo([rodando, { quando: ['exec'], entao: { ...OK, exitCode: -1, timedOut: true } }]);
    expect(await new DockerViaCli(t.rodar).reiniciarApp('exp002-f52be111', 'x')).toEqual({
      reiniciou: false,
      motivo: 'tempo_esgotado',
    });
    for (const [exitCode, stdout] of [[1, 'app-exit:3'], [64, 'lixo']] as const) {
      const f = duplo([rodando, { quando: ['exec'], entao: { ...OK, exitCode, stdout } }]);
      expect(await new DockerViaCli(f.rodar).reiniciarApp('exp002-f52be111', 'x')).toEqual({
        reiniciou: false,
        motivo: 'falha_no_exec',
      });
    }
  });

  it('o supervisor e o reinício usam o mesmo lançador, que grava o .pid', () => {
    expect(SUPERVISOR_DO_APP).toContain('/tmp/brabo-app.pid');
    expect(SUPERVISOR_DO_APP.endsWith('exec sleep infinity')).toBe(true);
    expect(REINICIAR_APP).toContain('/tmp/brabo-app.pid');
  });
});

// Shell de verdade (sem Docker): o script roda em `sh` local; os caminhos de /tmp
// são os mesmos do container, então o teste limpa antes e depois.
describe('REINICIAR_APP em sh real (RN-1024)', () => {
  const limpar = () => spawnSync('rm', ['-f', '/tmp/brabo-app.pid', '/tmp/brabo-app.exit', '/tmp/brabo-app.log']);
  const vivo = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const rodarScript = (script: string, comando: string) =>
    spawnSync('/bin/sh', ['-c', script, 'brabo-restart', comando], {
      encoding: 'utf8',
      env: { ...process.env, BRABO_REINICIO_ESPERA: '1' },
    });
  const lerPid = () => Number(readFileSync('/tmp/brabo-app.pid', 'utf8').trim());
  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  beforeEach(limpar);
  afterEach(() => {
    if (existsSync('/tmp/brabo-app.pid')) {
      try {
        process.kill(-lerPid(), 'SIGKILL');
      } catch {
        // ja morto
      }
    }
    limpar();
  });

  it('sem .pid só lança; com .pid mata o grupo antigo e grava o novo', async () => {
    expect(rodarScript(REINICIAR_APP, 'sleep 60').status).toBe(0);
    const antigo = lerPid();
    expect(vivo(antigo)).toBe(true);

    expect(rodarScript(REINICIAR_APP, 'sleep 61').status).toBe(0);
    const novo = lerPid();
    expect(novo).not.toBe(antigo);
    await esperar(200);
    expect(vivo(antigo)).toBe(false);
    expect(vivo(novo)).toBe(true);
  });

  it('app que ignora TERM leva KILL depois de 5 s', async () => {
    expect(rodarScript(REINICIAR_APP, 'trap "" TERM; while :; do sleep 1; done').status).toBe(0);
    const teimoso = lerPid();
    await esperar(300);
    expect(rodarScript(REINICIAR_APP, 'sleep 63').status).toBe(0);
    expect(vivo(teimoso)).toBe(false);
  }, 20_000);

  it('app que cai dentro da espera: sai 64 com app-exit, sem o log no stdout', () => {
    const r = rodarScript(REINICIAR_APP, 'echo SEGREDO=abc; exit 3');
    expect(r.status).toBe(64);
    expect(r.stdout.trim()).toBe('app-exit:3');
    expect(r.stdout + r.stderr).not.toContain('SEGREDO');
  });

  it('o supervisor também grava o .pid do app (grupo próprio)', async () => {
    const fundo = spawn('/bin/sh', ['-c', SUPERVISOR_DO_APP, 'brabo-app', 'sleep 62'], { stdio: 'ignore' });
    try {
      await esperar(400);
      const pid = lerPid();
      expect(vivo(pid)).toBe(true);
      expect(pid).not.toBe(fundo.pid);
    } finally {
      fundo.kill('SIGKILL');
    }
  });
});
