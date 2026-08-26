import { z } from 'zod';

/** Body de POST /api/a/auth/login */
export const donoLoginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha de pelo menos 6 chars'),
});

/** Body de POST /api/a/cozinhas/convite */
export const conviteCozinhaSchema = z
  .object({
    email: z.string().email('Email do responsavel invalido'),
    kitchenName: z.string().min(2, 'Nome muito curto').max(80),
    chargeCommission: z.boolean(),
    /** null = herda o padrao do quintal */
    commissionPct: z.number().min(0).max(100).nullable().default(null),
    chargeRent: z.boolean(),
    rentCents: z.number().int().min(0).default(0),
  })
  .refine((d) => !d.chargeRent || d.rentCents > 0, {
    message: 'Aluguel ligado exige valor maior que zero.',
    path: ['rentCents'],
  });

/** Body de PATCH /api/a/mesas/:numero */
export const mesaStatusSchema = z.object({
  status: z.enum(['livre', 'ocupada', 'precisa-limpar']),
});

/** Body de PATCH /api/a/cozinhas/:slug/acordo */
export const acordoSchema = z
  .object({
    chargeCommission: z.boolean(),
    commissionPct: z.number().min(0).max(100).nullable(),
    chargeRent: z.boolean(),
    rentCents: z.number().int().min(0),
  })
  .refine((d) => !d.chargeRent || d.rentCents > 0, {
    message: 'Aluguel ligado exige valor maior que zero.',
    path: ['rentCents'],
  });

/** Query de GET /api/a/financeiro */
export const financeiroQuerySchema = z.object({
  /** "2026-06"; ausente = mes corrente */
  refMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'refMonth deve ser "AAAA-MM"')
    .optional(),
});

export type ConviteCozinhaInput = z.infer<typeof conviteCozinhaSchema>;
export type AcordoInput = z.infer<typeof acordoSchema>;

/** Body de POST /api/a/financeiro/fechar */
export const fecharCicloSchema = z.object({
  refMonth: z.string().regex(/^\d{4}-\d{2}$/, 'refMonth deve ser "AAAA-MM"'),
});

/** Body de PATCH /api/a/cobrancas/:id */
export const cobrancaStatusSchema = z.object({
  status: z.enum(['fechada', 'paga', 'atrasada']),
  note: z.string().max(280).optional(),
});

/**
 * Body de POST /api/convite/:token/aceitar.
 *
 * O email NÃO vem daqui: ele está no convite. Aceitar do body deixaria alguém
 * com um link em mãos criar acesso para outro endereço.
 */
export const aceitarConviteSchema = z.object({
  password: z.string().min(8, 'Senha de pelo menos 8 caracteres'),
  name: z.string().trim().max(80).optional(),
});

/** Body de POST /api/acesso/:token/senha */
export const definirSenhaSchema = z.object({
  password: z.string().min(8, 'Senha de pelo menos 8 caracteres'),
});
