import { z } from 'zod';

/**
 * Body de POST /api/r/push/inscrever.
 *
 * É o `PushSubscription` que o navegador devolve, achatado. O formato não é
 * escolha nossa: vem do `pushManager.subscribe()`, e o app só repassa.
 */
export const inscreverPushSchema = z.object({
  /**
   * URL do serviço de push do fabricante do navegador. Chega grande — o do
   * Chrome passa de 200 caracteres — e o teto alto aqui é de propósito: cortar
   * curto quebraria a inscrição de um navegador que ainda nem existe.
   */
  endpoint: z.string().url().max(2048),
  /** Chave pública do aparelho (P-256, base64url). */
  p256dh: z.string().min(1).max(255),
  /** Segredo de autenticação do aparelho (base64url). */
  auth: z.string().min(1).max(255),
});

/**
 * Body de DELETE /api/r/push/inscrever.
 *
 * Só o endpoint: é ele que identifica o aparelho. Quem desliga o aviso desliga
 * NESTE aparelho, e não nos outros da mesma cozinha — o tablet do balcão
 * continua avisando mesmo depois de o celular de alguém sair.
 */
export const desinscreverPushSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export type InscreverPushBody = z.infer<typeof inscreverPushSchema>;
export type DesinscreverPushBody = z.infer<typeof desinscreverPushSchema>;
