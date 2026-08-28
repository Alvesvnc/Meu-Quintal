import { z } from 'zod';

/**
 * Valores default que so fazem sentido em desenvolvimento. Se algum deles
 * sobreviver ate producao, e sinal de que a var nao foi configurada — o schema
 * abaixo trata isso como erro fatal em vez de subir um server inseguro.
 */
const DEV_ONLY_SECRETS = [
  'trocar-em-producao',
  'ci-secret-nao-usar-em-producao',
  'dev-secret',
  'changeme',
  'secret',
];

const baseSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa ter ao menos 16 chars'),
  /** Janela e teto do rate limit global (por IP). */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  /** Tamanho maximo de body aceito, em bytes. */
  BODY_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(256 * 1024),
  /**
   * Habilita GET /metrics e serve de senha pra ela. Vazio = rota desabilitada.
   * Gerar com: openssl rand -hex 32
   */
  METRICS_TOKEN: z.string().min(16).optional(),

  /**
   * Pasta das fotos enviadas pelas cozinhas.
   *
   * Em producao PRECISA ser um volume montado. Sem volume, o cardapio inteiro
   * perde as imagens no primeiro deploy — e nada avisa: a rota devolve 404 por
   * foto e o app so mostra buraco.
   */
  UPLOADS_DIR: z.string().default('./uploads'),

  /**
   * Resend. VAZIO = nenhum email sai, e nada quebra: o convite continua
   * devolvendo o link na tela. Mesma escolha do SENTRY_DSN.
   */
  RESEND_API_KEY: z.string().optional(),

  /**
   * Remetente. Precisa ser de dominio verificado no Resend — sem isso ele
   * recusa o envio, e o erro so aparece no log.
   */
  EMAIL_FROM: z.string().default('QRO <nao-responda@qro.app>'),

  /**
   * Onde o app do RESTAURANTE esta publicado. Entra no link do convite.
   *
   * O convite leva a pessoa pro app onde ela vai trabalhar depois — nao pro do
   * dono. Sem isto o link nasceria relativo e o email mandaria pra lugar nenhum.
   */
  APP_RESTAURANTE_URL: z.string().url().default('http://localhost:5174'),

  /**
   * Onde o app do DONO esta publicado. Entra no link de primeiro acesso.
   *
   * Separado do app do restaurante de proposito: quem acabou de assinar vai
   * administrar o quintal, nao operar uma cozinha.
   */
  APP_DONO_URL: z.string().url().default('http://localhost:5175'),

  /**
   * DSN do Sentry. VAZIO = Sentry desligado, sem nenhum efeito no runtime.
   * Nao e segredo (vai no bundle do front em outros projetos), mas aqui e so
   * do server.
   */
  SENTRY_DSN: z.string().url().or(z.literal('')).optional(),

  /** Rotulo do ambiente no Sentry: producao, homologacao, etc. */
  SENTRY_ENVIRONMENT: z.string().optional(),

  /**
   * Fracao de requisicoes rastreadas (0..1). PADRAO 0 — tracing gera um evento
   * por requisicao e queimaria a cota do plano free em horas. Subir com
   * cuidado e olhando o consumo.
   */
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),

  /**
   * Tarefas periodicas do processo (encerrar propostas vencidas).
   * A operacao e idempotente, entao rodar em varias replicas nao duplica
   * trabalho — ver lib/expiracao.ts. Desligar so se a varredura ficar cara.
   */
  CRON_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),

  /**
   * Dias de teste gratis que uma conta NOVA recebe. 0 = TESTE DESLIGADO.
   *
   * Com 0 a conta nasce com o teste ja vencido: a pessoa entra, ve tudo e nao
   * altera nada ate assinar. Nao e o mesmo que `trialEndsAt` NULL no banco, que
   * significa "esta conta nao paga por teste" (cortesia) e e decisao POR CONTA,
   * nao configuracao global.
   *
   * Quem le isto e `lib/trial.ts`. Ver la o comentario sobre o painel.
   */
  TRIAL_DIAS: z.coerce.number().int().min(0).max(365).default(7),

  // ─── Asaas: a mensalidade que o DONO paga pro QRO ────────────────────────
  // Nao confundir com a cobranca que o dono faz das cozinhas dele, que nao
  // passa por provedor nenhum. Ver packages/shared/src/types/assinatura.ts.

  /**
   * Chave da API. VAZIA = pagamento desligado: nenhuma requisicao sai, o
   * webhook responde 503 e a tela do dono diz que ainda nao esta ligado.
   * Mesma escolha do RESEND_API_KEY e do SENTRY_DSN.
   */
  ASAAS_API_KEY: z.string().optional(),

  /**
   * Qual base o cliente HTTP usa. PADRAO SANDBOX, de proposito: o default
   * seguro e o que nao move dinheiro de verdade. Producao e escolha explicita.
   */
  ASAAS_AMBIENTE: z.enum(['sandbox', 'producao']).default('sandbox'),

  /**
   * Segredo que o Asaas devolve no header `asaas-access-token` de todo webhook.
   * E o unico jeito de saber que o POST veio mesmo dele.
   *
   * NAO PODE SER A CHAVE DA API — o proprio Asaas alerta isso, e o refine
   * abaixo recusa. Gerar com: openssl rand -hex 32
   */
  ASAAS_WEBHOOK_TOKEN: z.string().min(16).optional(),

  /**
   * Mensalidade de cada plano, EM CENTAVOS.
   *
   * Sem default de proposito. Um numero chutado aqui viraria uma assinatura
   * cobrando o valor errado sem ninguem perceber — a rota de checkout recusa
   * com mensagem dizendo qual var falta. Preco e decisao comercial, nao
   * fallback de codigo.
   */
  PRECO_RESTAURANTE_CENTS: z.coerce.number().int().positive().optional(),
  PRECO_PRACA_CENTS: z.coerce.number().int().positive().optional(),

  // ─── Web Push: o aviso que chega com o app fechado ───────────────────────

  /**
   * Par VAPID: e o que identifica ESTE servidor pro servico de push do
   * navegador (Google, Apple, Mozilla). Gerar UMA vez com:
   *   pnpm --filter @mq/server exec web-push generate-vapid-keys
   *
   * VAZIO = push desligado, e nada quebra: a rota da chave responde que nao
   * ha, o app nao oferece o botao e o aviso in-app (som + vibracao) segue
   * igual. Mesma escolha do RESEND_API_KEY e do SENTRY_DSN.
   *
   * TROCAR A CHAVE INVALIDA TODA INSCRICAO EXISTENTE. Os aparelhos ja
   * inscritos passam a receber 403 do servico de push e sao apagados na
   * primeira tentativa (ver lib/push.ts) — ou seja, todo mundo precisa
   * autorizar de novo, sem nenhum aviso na tela. Guarde a privada como
   * segredo de verdade.
   */
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  /**
   * Como o servico de push fala com voce se algo der errado. Precisa ser
   * `mailto:` ou uma URL https — e exigencia do protocolo, nao nossa.
   */
  VAPID_SUBJECT: z.string().default('mailto:suporte@qro.app'),

  /** Confiar em X-Forwarded-For. Ligar SOMENTE atras de um proxy conhecido. */
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
});

const schema = baseSchema.superRefine((cfg, ctx) => {
  // ── Vale em TODO ambiente: meia chave VAPID e pior que nenhuma ─────────
  //
  // Com so uma das duas, o `web-push` lanca no primeiro envio — dentro do
  // fluxo de criar pedido, que e o caminho quente. Falhar no boot e melhor
  // que descobrir isso no meio de um turno.
  const meiaChave = Boolean(cfg.VAPID_PUBLIC_KEY) !== Boolean(cfg.VAPID_PRIVATE_KEY);
  if (meiaChave) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['VAPID_PUBLIC_KEY'],
      message:
        'VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY andam juntas: configure as duas ou nenhuma. Gerar: pnpm --filter @mq/server exec web-push generate-vapid-keys',
    });
  }

  if (cfg.NODE_ENV !== 'production') return;

  // ── Em producao os defaults de dev nao passam ─────────────────────────────
  if (DEV_ONLY_SECRETS.includes(cfg.JWT_SECRET.toLowerCase())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET esta com um valor de exemplo. Gere um novo: openssl rand -base64 48',
    });
  }

  if (cfg.JWT_SECRET.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'Em producao JWT_SECRET precisa de 32+ chars. Gere: openssl rand -base64 48',
    });
  }

  const origins = cfg.CORS_ORIGINS.split(',').map((s) => s.trim());

  if (origins.includes('*')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ORIGINS'],
      message: 'CORS_ORIGINS="*" com credentials:true e invalido e inseguro. Liste os dominios.',
    });
  }

  const locais = origins.filter((o) => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(o));
  if (locais.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ORIGINS'],
      message: `CORS_ORIGINS aponta pra localhost em producao: ${locais.join(', ')}`,
    });
  }

  const inseguros = origins.filter((o) => o.startsWith('http://'));
  if (inseguros.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ORIGINS'],
      message: `CORS_ORIGINS sem https em producao: ${inseguros.join(', ')}`,
    });
  }

  // ── Asaas ────────────────────────────────────────────────────────────────
  // Estas so valem quando ha chave: sem ela o pagamento esta desligado e nao
  // ha nada pra proteger.
  if (cfg.ASAAS_API_KEY) {
    if (!cfg.ASAAS_WEBHOOK_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ASAAS_WEBHOOK_TOKEN'],
        message:
          'Com ASAAS_API_KEY configurada, ASAAS_WEBHOOK_TOKEN e obrigatorio — sem ele qualquer um consegue ativar contas fingindo ser o Asaas. Gere: openssl rand -hex 32',
      });
    }

    // O proprio Asaas alerta pra isso. Reusar a chave da API como token de
    // webhook a exporia a qualquer um que ja recebe os nossos webhooks — e a
    // chave da API move dinheiro.
    if (cfg.ASAAS_WEBHOOK_TOKEN && cfg.ASAAS_WEBHOOK_TOKEN === cfg.ASAAS_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ASAAS_WEBHOOK_TOKEN'],
        message: 'ASAAS_WEBHOOK_TOKEN nao pode ser igual a ASAAS_API_KEY. Gere um proprio.',
      });
    }

    // PRODUCAO APONTANDO PRO SANDBOX E O ERRO CARO E SILENCIOSO: o checkout
    // abre, o cliente "paga" com dinheiro de mentira, o webhook chega, a conta
    // ativa — e nunca entrou um centavo. Nada nesse caminho parece quebrado.
    if (cfg.ASAAS_AMBIENTE !== 'producao') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ASAAS_AMBIENTE'],
        message:
          'NODE_ENV=production com ASAAS_AMBIENTE=sandbox: os pagamentos seriam de mentira e ninguem perceberia. Use ASAAS_AMBIENTE=producao.',
      });
    }
  }
});

/**
 * Valida uma fonte de variaveis de ambiente.
 *
 * Vive num modulo separado do env.ts de proposito: o env.ts chama
 * `process.exit(1)` quando a config e invalida — importa-lo num teste mataria
 * a suite inteira. Aqui nao ha efeito colateral nenhum.
 */
/**
 * `FOO=` num arquivo .env significa "nao configurado", nao "string vazia".
 *
 * O dotenv entrega `''`, e ai um campo opcional com regra — METRICS_TOKEN, que
 * exige 16 caracteres — REPROVA em vez de ser ignorado. O efeito e cruel: o
 * proprio .env.example lista `METRICS_TOKEN=` vazio como documentacao, entao
 * copiar o exemplo derruba o servidor no boot, com uma mensagem que fala de
 * tamanho minimo pra algo que a pessoa nunca quis preencher.
 *
 * Some com a chave antes de validar e o comportamento volta a ser o esperado:
 * vazio = ausente = usa o padrao, ou fica opcional mesmo.
 */
function semVazios(source: Record<string, unknown>): Record<string, unknown> {
  const limpo: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(source)) {
    if (typeof valor === 'string' && valor.trim() === '') continue;
    limpo[chave] = valor;
  }
  return limpo;
}

export function parseEnv(source: Record<string, unknown>) {
  return schema.safeParse(semVazios(source));
}

export type Env = z.infer<typeof baseSchema>;
