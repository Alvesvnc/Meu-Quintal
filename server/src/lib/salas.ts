/**
 * Nomes das salas de Socket.io, num lugar so.
 *
 * POR QUE ID E NAO SLUG: a partir do multi-tenant, Kitchen.slug e unico apenas
 * DENTRO de um quintal (`@@unique([spaceId, slug])`). Dois clientes diferentes
 * do SaaS podem ter cada um a sua "lou-burger" — com o slug no nome da sala,
 * as duas cairiam na MESMA sala e uma veria os pedidos da outra.
 *
 * O payload dos eventos continua carregando `kitchenSlug`, que e o que o front
 * usa pra exibir. So o enderecamento mudou.
 */
export const salaDaCozinha = (kitchenId: string) => `kitchen:${kitchenId}`;

export const salaDoPedido = (orderId: string) => `order:${orderId}`;
