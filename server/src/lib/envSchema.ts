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
  BODY_LIMIT: z.coerce.number().int().positive().default(256 * 1024),
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
  EMAIL_FROM: z.string().default('Meu Quintal <nao-responda@meuquintal.app>'),

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

  /** Confiar em X-Forwarded-For. Ligar SOMENTE atras de um proxy conhecido. */
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
});

const schema = baseSchema.superRefine((cfg, ctx) => {
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
