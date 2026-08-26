import * as Sentry from '@sentry/node';
import { env } from './env.js';

/**
 * Sentry — rastreamento de excecao.
 *
 * DESLIGADO enquanto SENTRY_DSN estiver vazio. Nada aqui tem efeito nesse
 * estado: nao ha requisicao de rede, nao ha hook, nao ha custo. E o padrao.
 *
 * Divisao de trabalho com o /metrics (docs/observabilidade.md):
 *   Prometheus -> "quanto e por quanto tempo"
 *   Sentry     -> "o que quebrou e em que linha"
 *
 * SOBRE COTA: o plano free tem teto fixo de eventos e descarta o que passa.
 * O momento de maior geracao de eventos e justamente o do incidente — um loop
 * de erro numa rota quente queima o mes em horas e deixa voce cego na hora
 * errada. Por isso aqui:
 *   - so 5xx DESCONHECIDO vira evento (4xx e 503 esperado sao filtrados)
 *   - tracing vem com amostragem 0 por padrao
 *   - `beforeSend` corta ruido repetido
 * Ligue tambem a spike protection e o rate limit por DSN key no painel.
 */

export const sentryAtivo = Boolean(env.SENTRY_DSN);

/**
 * Chaves cujo valor NUNCA pode sair daqui.
 *
 * O `authorization` carrega o qrToken da mesa e o JWT da cozinha — os mesmos
 * que ja sao redigidos do log. Mandar pro Sentry anularia esse cuidado.
 * O qrToken merece atencao extra: ele nao vive so em header, aparece em body
 * de handshake de socket e pode cair em breadcrumb.
 */
const CHAVES_PROIBIDAS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'qrtoken',
  'qr_token',
  'token',
  'password',
  'passwordhash',
  'senha',
  'secret',
  'jwt',
];

const REDIGIDO = '[redigido]';

/**
 * Varre um objeto e apaga qualquer valor sob chave proibida.
 *
 * Recursivo de proposito: o dado sensivel raramente esta no primeiro nivel —
 * costuma vir dentro de `request.headers`, `contexts.body`, `extra.payload`.
 */
function limpar(valor: unknown, profundidade = 0): unknown {
  // Guarda contra ciclo e contra objeto absurdamente aninhado
  if (profundidade > 8 || valor === null || typeof valor !== 'object') return valor;

  if (Array.isArray(valor)) return valor.map((v) => limpar(v, profundidade + 1));

  const saida: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (CHAVES_PROIBIDAS.includes(chave.toLowerCase())) {
      saida[chave] = REDIGIDO;
      continue;
    }
    saida[chave] = limpar(v, profundidade + 1);
  }
  return saida;
}

export function setupSentry(): void {
  if (!sentryAtivo) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    // A versao serve pra saber se o erro e novo ou se ja existia no release
    // anterior. Injetada no build — ver server/build.mjs.
    release: typeof __VERSAO__ === 'string' ? __VERSAO__ : undefined,

    // NAO enviar IP, cookie e header por padrao. O ganho de contexto nao
    // compensa mandar dado de cliente pra um terceiro.
    sendDefaultPii: false,

    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,

    beforeSend(evento) {
      // Ultima barreira antes da rede. Roda mesmo se alguem, no futuro,
      // ligar sendDefaultPii sem pensar.
      if (evento.request) {
        evento.request = limpar(evento.request) as typeof evento.request;
        // A query string pode carregar token em link compartilhado
        delete evento.request.query_string;
      }
      if (evento.extra) evento.extra = limpar(evento.extra) as typeof evento.extra;
      if (evento.contexts) evento.contexts = limpar(evento.contexts) as typeof evento.contexts;

      // Breadcrumb e o lugar mais facil de vazar sem perceber: ele grava
      // requisicoes e queries automaticamente.
      if (evento.breadcrumbs) {
        evento.breadcrumbs = evento.breadcrumbs.map((b) => ({
          ...b,
          data: limpar(b.data) as typeof b.data,
        }));
      }

      return evento;
    },
  });
}

/**
 * Registra um erro 5xx desconhecido.
 *
 * As tags nao sao enfeite:
 *   accountId — num SaaS multi-tenant, erro sem dono e erro do qual voce nao
 *               sabe qual cliente perdeu. E a primeira pergunta do suporte.
 *   requestId — costura o evento do Sentry com a linha do log e com o
 *               `x-request-id` que o usuario ve na tela.
 */
export function capturarErro(
  erro: unknown,
  contexto: {
    requestId: string;
    metodo: string;
    rota: string;
    accountId?: string;
    kitchenId?: string;
    spaceId?: string;
  },
): void {
  if (!sentryAtivo) return;

  Sentry.withScope((escopo) => {
    escopo.setTag('request_id', contexto.requestId);
    escopo.setTag('rota', contexto.rota);
    escopo.setTag('metodo', contexto.metodo);
    if (contexto.accountId) escopo.setTag('account_id', contexto.accountId);
    if (contexto.kitchenId) escopo.setTag('kitchen_id', contexto.kitchenId);
    if (contexto.spaceId) escopo.setTag('space_id', contexto.spaceId);

    // Agrupa por rota: 200 ocorrencias do mesmo erro viram 1 issue com 200
    // eventos, em vez de 200 issues. Faz diferenca direta na cota.
    escopo.setFingerprint(['{{ default }}', contexto.rota]);

    Sentry.captureException(erro);
  });
}

/**
 * Espera os eventos pendentes subirem antes do processo morrer.
 *
 * Sem isto, o erro que DERRUBOU o servico e justamente o que nunca chega ao
 * Sentry — o processo sai antes do envio terminar.
 */
export async function encerrarSentry(timeoutMs = 2000): Promise<void> {
  if (!sentryAtivo) return;
  try {
    await Sentry.flush(timeoutMs);
    await Sentry.close(timeoutMs);
  } catch {
    // Falhar o shutdown por causa do Sentry seria trocar um problema por outro
  }
}

declare const __VERSAO__: string;
