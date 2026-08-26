import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * O que estes testes protegem: que nenhum token de mesa, JWT de cozinha ou
 * senha saia daqui pra um terceiro.
 *
 * A redacao do LOG ja foi feita antes (pino `redact`). Plugar o Sentry sem o
 * mesmo cuidado anularia aquele trabalho — e o vazamento seria silencioso,
 * porque ninguem inspeciona o que o SDK manda.
 *
 * Estrategia: capturar o `beforeSend` que o `Sentry.init` recebeu e passar por
 * ele eventos montados a mao. E o mesmo caminho que um evento real percorre
 * imediatamente antes de virar requisicao de rede.
 */

const initSpy = vi.fn();
const captureExceptionSpy = vi.fn();

vi.mock('@sentry/node', () => ({
  init: (opcoes: unknown) => initSpy(opcoes),
  captureException: (e: unknown) => captureExceptionSpy(e),
  withScope: (fn: (escopo: unknown) => void) => {
    const escopo = { setTag: vi.fn(), setFingerprint: vi.fn() };
    fn(escopo);
    return escopo;
  },
  flush: vi.fn().mockResolvedValue(true),
  close: vi.fn().mockResolvedValue(true),
}));

/** Recarrega os modulos com o env desejado e devolve o beforeSend registrado. */
async function carregar(dsn?: string) {
  vi.resetModules();
  initSpy.mockClear();
  captureExceptionSpy.mockClear();

  // Vazio, e nao `delete`: apagar a chave faz o `dotenv` — que roda de novo a
  // cada `resetModules` — reler o .env da maquina e devolver o DSN de verdade.
  // O teste passava so em quem nao tinha Sentry configurado.
  //
  // String vazia e "configurado como ausente": o dotenv nao sobrescreve chave
  // existente, e o parseEnv trata vazio como nao definido.
  process.env.SENTRY_DSN = dsn ?? '';

  const mod = await import('./sentry.js');
  mod.setupSentry();

  const opcoes = initSpy.mock.calls[0]?.[0] as
    | { beforeSend?: (e: Record<string, unknown>) => unknown; sendDefaultPii?: boolean }
    | undefined;

  return { mod, opcoes };
}

const DSN = 'https://abc123@o1.ingest.sentry.io/456';

beforeEach(() => {
  delete process.env.SENTRY_DSN;
});

afterEach(() => {
  delete process.env.SENTRY_DSN;
});

describe('Sentry desligado', () => {
  it('sem DSN nao chama init', async () => {
    const { opcoes } = await carregar();
    expect(initSpy).not.toHaveBeenCalled();
    expect(opcoes).toBeUndefined();
  });

  it('sem DSN, capturarErro nao envia nada', async () => {
    const { mod } = await carregar();
    mod.capturarErro(new Error('boom'), {
      requestId: 'req-1',
      metodo: 'GET',
      rota: '/x',
    });
    expect(captureExceptionSpy).not.toHaveBeenCalled();
  });

  it('sem DSN, encerrar nao quebra', async () => {
    const { mod } = await carregar();
    await expect(mod.encerrarSentry()).resolves.toBeUndefined();
  });
});

describe('configuracao', () => {
  it('sendDefaultPii vem FALSO — IP, cookie e header nao saem por padrao', async () => {
    const { opcoes } = await carregar(DSN);
    expect(opcoes?.sendDefaultPii).toBe(false);
  });

  it('amostragem de tracing e 0 por padrao — protege a cota do plano free', async () => {
    const { opcoes } = await carregar(DSN);
    expect((opcoes as { tracesSampleRate?: number })?.tracesSampleRate).toBe(0);
  });
});

// ── O ponto alto: nada sensivel pode atravessar o beforeSend ────────────────

describe('scrubbing', () => {
  it('apaga o Authorization do request', async () => {
    const { opcoes } = await carregar(DSN);
    const saida = opcoes!.beforeSend!({
      request: {
        url: '/api/m/quintal',
        headers: {
          authorization: 'Bearer mesa-4-dev-TOKEN-SECRETO',
          'user-agent': 'curl/8',
        },
      },
    }) as { request: { headers: Record<string, string> } };

    expect(JSON.stringify(saida)).not.toContain('TOKEN-SECRETO');
    expect(saida.request.headers.authorization).toBe('[redigido]');
    // O que nao e sensivel continua vindo — senao o evento perde utilidade
    expect(saida.request.headers['user-agent']).toBe('curl/8');
  });

  it('apaga qrToken mesmo aninhado fundo', async () => {
    const { opcoes } = await carregar(DSN);
    const saida = opcoes!.beforeSend!({
      extra: {
        handshake: { auth: { kind: 'mesa', qrToken: 'mesa-9-dev-SEGREDO' } },
      },
    });
    expect(JSON.stringify(saida)).not.toContain('SEGREDO');
  });

  it('apaga senha e hash', async () => {
    const { opcoes } = await carregar(DSN);
    const saida = opcoes!.beforeSend!({
      extra: {
        body: { email: 'a@b.com', password: 'SENHA-EM-CLARO' },
        user: { passwordHash: '$argon2id$HASH-AQUI' },
      },
    });
    const texto = JSON.stringify(saida);
    expect(texto).not.toContain('SENHA-EM-CLARO');
    expect(texto).not.toContain('HASH-AQUI');
  });

  it('descarta a query string inteira', async () => {
    const { opcoes } = await carregar(DSN);
    const saida = opcoes!.beforeSend!({
      request: { url: '/x', query_string: 'token=SEGREDO-NA-URL&espaco=abc' },
    }) as { request: Record<string, unknown> };
    // Link compartilhado com token na query e uma forma classica de vazamento
    expect(saida.request.query_string).toBeUndefined();
    expect(JSON.stringify(saida)).not.toContain('SEGREDO-NA-URL');
  });

  it('limpa breadcrumb — o lugar mais facil de vazar sem perceber', async () => {
    const { opcoes } = await carregar(DSN);
    const saida = opcoes!.beforeSend!({
      breadcrumbs: [
        { category: 'http', data: { authorization: 'Bearer JWT-DA-COZINHA' } },
        { category: 'log', data: { msg: 'tudo bem por aqui' } },
      ],
    }) as { breadcrumbs: Array<{ data: Record<string, unknown> }> };

    expect(JSON.stringify(saida)).not.toContain('JWT-DA-COZINHA');
    expect(saida.breadcrumbs[1].data.msg).toBe('tudo bem por aqui');
  });

  it('e insensivel a maiuscula/minuscula na chave', async () => {
    const { opcoes } = await carregar(DSN);
    const saida = opcoes!.beforeSend!({
      extra: { Authorization: 'Bearer X-SECRETO', QRTOKEN: 'Y-SECRETO' },
    });
    const texto = JSON.stringify(saida);
    expect(texto).not.toContain('X-SECRETO');
    expect(texto).not.toContain('Y-SECRETO');
  });

  it('aguenta array, null e aninhamento absurdo sem estourar', async () => {
    const { opcoes } = await carregar(DSN);
    let fundo: Record<string, unknown> = { token: 'NO-FUNDO' };
    for (let i = 0; i < 30; i++) fundo = { nivel: fundo };

    expect(() =>
      opcoes!.beforeSend!({
        extra: {
          lista: [{ password: 'A-SECRETO' }, null, 'texto solto', 42],
          fundo,
        },
      }),
    ).not.toThrow();

    const saida = opcoes!.beforeSend!({
      extra: { lista: [{ password: 'A-SECRETO' }, null] },
    });
    expect(JSON.stringify(saida)).not.toContain('A-SECRETO');
  });

  it('evento sem campo nenhum passa limpo', async () => {
    const { opcoes } = await carregar(DSN);
    expect(() => opcoes!.beforeSend!({ message: 'oi' })).not.toThrow();
  });
});

describe('capturarErro', () => {
  it('com DSN, envia a excecao', async () => {
    const { mod } = await carregar(DSN);
    const erro = new Error('estourou');
    mod.capturarErro(erro, {
      requestId: 'req-9',
      metodo: 'POST',
      rota: '/api/m/pedido',
      accountId: 'acc-1',
    });
    expect(captureExceptionSpy).toHaveBeenCalledWith(erro);
  });
});
