import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha de pelo menos 6 chars'),
});

export const motivoCancelamentoSchema = z.enum([
  'sem-ingrediente',
  'equipamento',
  'demanda-alta',
  'fim-de-expediente',
  'item-errado-no-cardapio',
  'cliente-desistiu',
  'outro',
]);

/**
 * Body de PATCH /api/r/pedido/:id/cancelar.
 *
 * `motivo` e a categoria que vira metrica; `reason` e o texto que o cliente le.
 */
export const cancelOrderSchema = z
  .object({
    motivo: motivoCancelamentoSchema,
    reason: z.string().max(140).optional(),
  })
  .refine((d) => d.motivo !== 'outro' || (d.reason?.trim().length ?? 0) >= 3, {
    // Sem esta regra, "outro" vira a escolha padrao por ser a mais rapida — e
    // a metrica volta a nao dizer nada.
    message: 'Escolhendo "outro", explique o motivo.',
    path: ['reason'],
  });

// ─── Cardapio (o proprio restaurante edita) ──────────────────────────────────

export const categoriaMenuSchema = z.enum(['entradas', 'pratos', 'sobremesas', 'bebidas']);
export const badgeMenuSchema = z.enum(['novo', 'esgotando', 'sem-estoque']);

/**
 * Campos de um item do cardapio.
 *
 * `priceCents` inteiro e >= 0: preco em centavos nunca e fracionado, e float
 * aqui vira erro de arredondamento no fim do mes.
 */
const itemCardapioBase = {
  category: categoriaMenuSchema,
  name: z.string().trim().min(2, 'Nome muito curto').max(80),
  description: z.string().trim().max(280).nullable().default(null),
  priceCents: z.number().int().min(0).max(100_000_00),
  photoUrl: z.string().url('URL invalida').max(500).nullable().default(null),
  available: z.boolean().default(true),
  badge: badgeMenuSchema.nullable().default(null),
  sortOrder: z.number().int().min(0).max(999).default(0),
};

/** Body de POST /api/r/cardapio */
export const criarItemCardapioSchema = z.object(itemCardapioBase);

/**
 * Body de PATCH /api/r/cardapio/:id — tudo opcional.
 *
 * `.partial()` e nao um objeto novo: assim os limites nao divergem entre criar
 * e editar. Um preco maximo diferente nos dois lugares seria bug esperando.
 */
export const editarItemCardapioSchema = z
  .object(itemCardapioBase)
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada pra alterar.' });

// ─── Perfil publico da cozinha ───────────────────────────────────────────────

/**
 * Body de PATCH /api/r/perfil.
 *
 * O `slug` NAO entra: ele e o endereco da cozinha dentro do quintal, e mudar
 * quebraria QR impresso, link salvo e sala de socket. Trocar slug e operacao do
 * dono do espaco, nao da cozinha.
 */
export const perfilCozinhaSchema = z
  .object({
    name: z.string().trim().min(2, 'Nome muito curto').max(80),
    category: z.string().trim().max(40).nullable(),
    tagline: z.string().trim().max(120).nullable(),
    description: z.string().trim().max(600).nullable(),
    photoUrl: z.string().url('URL invalida').max(500).nullable(),
    // 1..120: SLA de zero prometeria o impossivel e deixaria todo pedido
    // "atrasado" no segundo seguinte; acima de 2h nao e mais fila de balcao.
    slaMinutes: z.number().int().min(1).max(120),
    /** `rascunho` nao entra: so o fluxo de convite cria cozinha nesse estado. */
    status: z.enum(['ativa', 'pausada']),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada pra alterar.' });

// ─── Historico e metricas ────────────────────────────────────────────────────

/** Query de GET /api/r/historico e GET /api/r/metricas. */
export const janelaDiasSchema = z.object({
  dias: z.coerce.number().int().min(1).max(90).default(1),
});

export type CriarItemCardapioInput = z.infer<typeof criarItemCardapioSchema>;
export type EditarItemCardapioInput = z.infer<typeof editarItemCardapioSchema>;
export type PerfilCozinhaInput = z.infer<typeof perfilCozinhaSchema>;
