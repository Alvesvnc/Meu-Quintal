import { z } from 'zod';

/** Body de POST /api/r/pedido/:id/alteracao (cozinha propõe). */
export const criarAlteracaoSchema = z
  .object({
    /** Categoria — vira metrica. Ver types/cancelamento.ts. */
    motivo: z.enum([
      'sem-ingrediente',
      'equipamento',
      'demanda-alta',
      'fim-de-expediente',
      'item-errado-no-cardapio',
      'cliente-desistiu',
      'outro',
    ]),
    /** Aparece pro cliente. Vale a pena explicar: "acabou o pão". */
    reason: z.string().max(140).optional(),
  itens: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        /** 0 = cancelar o item. Só reduz — o servidor recusa aumento. */
        qtyProposta: z.number().int().min(0).max(20),
      }),
    )
    .min(1, 'Escolha ao menos um item.')
    .max(50),
  })
  .refine((d) => d.motivo !== 'outro' || (d.reason?.trim().length ?? 0) >= 3, {
    message: 'Escolhendo "outro", explique o motivo.',
    path: ['reason'],
  });

export type CriarAlteracaoInput = z.infer<typeof criarAlteracaoSchema>;
