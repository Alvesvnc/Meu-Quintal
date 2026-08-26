/**
 * Extrai a mensagem de erro que o servidor mandou.
 *
 * Todo handler do servidor responde `{ error: "..." }` — ver o error handler em
 * server/src/plugins/security.ts. Mas o erro que chega no `catch` do front pode
 * ser várias coisas: resposta HTTP com corpo, falha de rede sem resposta,
 * timeout do axios, ou um `Error` qualquer que estourou antes da requisição.
 *
 * Antes disto, cada tela fazia `catch (e: any)` e cavava
 * `e?.response?.data?.error` na mão. O `any` desliga o compilador justamente no
 * ponto em que a forma do valor é desconhecida — que é quando ele mais ajuda.
 *
 * Sem dependência de axios de propósito: a checagem é por formato, então
 * funciona com fetch, axios ou qualquer outro cliente.
 */

/** Resposta de erro que o servidor produz. */
interface CorpoDeErro {
  error?: unknown;
  requestId?: unknown;
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Mensagem pronta pra mostrar na tela.
 *
 * `padrao` é o que aparece quando não deu pra extrair nada — escreva pensando
 * no usuário final, não em depuração.
 */
export function mensagemDeErro(erro: unknown, padrao = 'Algo deu errado. Tente de novo.'): string {
  if (!ehObjeto(erro)) return padrao;

  // Caminho normal: o servidor respondeu com corpo
  const resposta = erro.response;
  if (ehObjeto(resposta)) {
    const dados = resposta.data as CorpoDeErro | undefined;
    if (ehObjeto(dados) && typeof dados.error === 'string' && dados.error.trim() !== '') {
      return dados.error;
    }
  }

  // fetch() já desembrulhado pelo chamador
  const dadosDiretos = erro as CorpoDeErro;
  if (typeof dadosDiretos.error === 'string' && dadosDiretos.error.trim() !== '') {
    return dadosDiretos.error;
  }

  // NAO cair no erro.message do axios: ele produz textos como
  // "Request failed with status code 500", que não dizem nada ao usuário e
  // ainda vazam detalhe de infraestrutura na tela.
  return padrao;
}

/**
 * O `requestId` que o servidor devolve em 5xx.
 *
 * Mostrar na tela de erro transforma "deu erro ontem" numa busca de uma linha
 * no log — ver docs/observabilidade.md.
 */
export function requestIdDoErro(erro: unknown): string | null {
  if (!ehObjeto(erro)) return null;
  const resposta = erro.response;
  if (!ehObjeto(resposta)) return null;
  const dados = resposta.data as CorpoDeErro | undefined;
  return ehObjeto(dados) && typeof dados.requestId === 'string' ? dados.requestId : null;
}

/** Status HTTP, quando houve resposta. */
export function statusDoErro(erro: unknown): number | null {
  if (!ehObjeto(erro)) return null;
  const resposta = erro.response;
  return ehObjeto(resposta) && typeof resposta.status === 'number' ? resposta.status : null;
}
