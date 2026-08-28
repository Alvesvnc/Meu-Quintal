/**
 * Resposta de GET /api/r/push/chave.
 *
 * `chavePublica` nula significa "push não está configurado neste servidor" —
 * não é erro. O app usa isso pra decidir se mostra o botão de ligar o aviso:
 * oferecer o botão sem chave levaria a pessoa a dar permissão de notificação
 * pra nada, e permissão negada uma vez é difícil de recuperar.
 */
export interface ChavePushResponse {
  chavePublica: string | null;
  /**
   * Quantos aparelhos desta cozinha já estão inscritos — CONTANDO os outros,
   * não só este. É o que deixa a tela dizer "o tablet do balcão já avisa"
   * para quem abriu no celular, em vez de sugerir que ninguém está coberto.
   */
  aparelhos: number;
}

/** Resposta de POST e DELETE /api/r/push/inscrever. */
export interface InscricaoPushResponse {
  ok: true;
  /** Quantos aparelhos desta cozinha estão inscritos depois da operação. */
  aparelhos: number;
}

/**
 * O que viaja dentro do aviso, cifrado de ponta a ponta.
 *
 * O service worker do app do restaurante lê exatamente esta forma. Mudar aqui
 * sem mudar lá deixa a notificação sem título — e o navegador exibe um texto
 * genérico do sistema no lugar, sem nenhum erro em canto nenhum.
 */
export interface AvisoPushPayload {
  titulo: string;
  corpo: string;
  tag: string;
  url: string;
}
