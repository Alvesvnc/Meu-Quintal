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

  /**
   * Quem está pedindo. OPCIONAL de propósito.
   *
   * Serve pra separar as contas quando várias pessoas dividem a mesa e cada uma
   * pede do próprio celular — sem ele, "fechar conta" pega os pedidos de todo
   * mundo daquela mesa.
   *
   * Quem não preencher cai na conta da mesa, que é como funcionava antes.
   * Tornar obrigatório devolveria o atrito que este campo existe pra evitar:
   * mais uma tela entre a pessoa e a comida.
   *
   * NÃO É CREDENCIAL. Vem digitado do aparelho do cliente; rotula e agrupa,
   * nunca autoriza.
   */
  nomeCliente: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .optional()
    // String vazia é o que um campo em branco manda. Tratar como "não informou"
    // evita gravar `''`, que depois não casaria nem com nome nem com nulo no
    // filtro de fechar conta.
    .or(z.literal('').transform(() => undefined)),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Resposta de POST /api/m/pedido */
export interface CreateOrderResponse {
  id: string;
  shortId: string;
}
