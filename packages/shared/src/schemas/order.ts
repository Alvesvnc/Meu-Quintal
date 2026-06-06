import { z } from 'zod';

/** Body de POST /api/m/pedido */
export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        qty: z.number().int().min(1).max(20),
        note: z.string().max(140).optional(),
      }),
    )
    .min(1, 'Pelo menos um item no pedido.')
    .max(50, 'Máximo de 50 itens por pedido.'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Resposta de POST /api/m/pedido */
export interface CreateOrderResponse {
  id: string;
  shortId: string;
}
