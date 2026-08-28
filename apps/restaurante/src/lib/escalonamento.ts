/**
 * Quando parar de esperar o celular do cliente e ir falar com ele.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * A cozinha propõe uma alteração e o cliente tem 5 minutos pra responder. Sem
 * resposta, o item é cancelado — o cliente nunca é cobrado por algo que não
 * aceitou, e isso está certo.
 *
 * O problema é que o aviso só chega se o cliente estiver com a tela do app
 * aberta. Celular no bolso, tela apagada, conversando com a mesa: a pergunta
 * não chega, o prazo corre, e a venda se perde em silêncio.
 *
 * Notificação de verdade (Web Push) não resolve: no iOS ela exige a pessoa
 * adicionar o site à tela de início, e ninguém faz isso no meio de uma
 * refeição. Ficaria só Android — justamente metade dos aparelhos.
 *
 * ─── A SAÍDA É O MUNDO FÍSICO ───────────────────────────────────────────────
 *
 * A cozinha sabe o número da mesa. Alguém anda dez metros e pergunta. Isso
 * funciona com o celular no bolso, sem bateria ou no modo avião — em qualquer
 * aparelho.
 *
 * O papel do app deixa de ser ENTREGAR a pergunta e passa a ser REGISTRAR a
 * resposta, que é onde software é bom. Tentar substituir o garçom por
 * notificação é exatamente onde isso quebra.
 */

/**
 * Segundos de silêncio antes de mandar alguém até a mesa.
 *
 * ─── POR QUE 75 ─────────────────────────────────────────────────────────────
 *
 * Quem está olhando o celular responde em dez ou vinte segundos. Passado mais
 * de um minuto, quase certamente não está olhando.
 *
 * Os dois erros possíveis não custam a mesma coisa. Escalar cedo demais gasta
 * uma caminhada à toa e a venda se salva do mesmo jeito. Escalar tarde demais
 * deixa pouco tempo pra caminhada e a venda se perde. Então o número pende pro
 * lado de avisar antes.
 *
 * O limite é o outro lado: aviso que dispara à toa toda hora vira aviso que
 * ninguém lê. 75 segundos deixam ainda quase quatro minutos pra resolver.
 *
 * ESTE NÚMERO É PRA SER AJUSTADO depois de ver operação de verdade. Se a
 * cozinha reclamar de caminhada perdida, sobe. Se venda continuar se perdendo,
 * desce.
 */
export const SEGUNDOS_ATE_ESCALAR = 75;

export type EstadoDaProposta =
  /** Ainda dentro da janela em que é razoável esperar o celular. */
  | 'aguardando'
  /** Silêncio demais: alguém precisa ir até a mesa. */
  | 'ir-na-mesa';

/**
 * Em que pé está uma proposta pendente.
 *
 * Pura e com `agora` recebido de fora: assim o teste não depende do relógio, e
 * o componente pode usar o mesmo tique que já move o contador na tela.
 */
export function estadoDaProposta(criadaEm: string, agora: number): EstadoDaProposta {
  const nascida = new Date(criadaEm).getTime();

  // Data inválida não pode virar escalonamento: `NaN` em comparação é sempre
  // falso, mas deixar explícito evita que uma mudança futura inverta o sinal e
  // passe a mandar a cozinha até a mesa por causa de um campo torto.
  if (Number.isNaN(nascida)) return 'aguardando';

  const segundos = (agora - nascida) / 1000;
  return segundos >= SEGUNDOS_ATE_ESCALAR ? 'ir-na-mesa' : 'aguardando';
}
