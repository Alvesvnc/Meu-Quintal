import type { FastifyInstance } from 'fastify';
import { ler } from '../lib/armazenamento.js';
import { CONTENT_TYPE } from '../lib/imagem.js';

/**
 * Serve as fotos enviadas. **Rota pública, sem autenticação.**
 *
 * Não é descuido: `<img src>` não manda cabeçalho `Authorization`, então uma
 * imagem exigindo token simplesmente não aparece. E o conteúdo é público por
 * natureza — é a foto do prato no cardápio, feita pra ser vista por qualquer
 * pessoa que sentar numa mesa.
 *
 * O que protege é a chave: 128 bits aleatórios. Não dá pra listar a pasta nem
 * adivinhar a foto da cozinha vizinha; quem tem o endereço é porque viu o
 * cardápio.
 */
export async function fotosRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { chave: string } }>('/api/fotos/:chave', async (req, reply) => {
    const data = await ler(req.params.chave);
    if (!data) return reply.code(404).send({ error: 'Foto nao encontrada.' });

    return (
      reply
        // Fixo, nunca deduzido do arquivo: tudo que entra é reencodado pra
        // webp, então qualquer outra coisa aqui seria mentira.
        .header('content-type', CONTENT_TYPE)
        // A chave nunca é reaproveitada — trocar a foto gera chave nova. Então
        // o arquivo desta URL é imutável e pode ficar no cache pra sempre.
        .header('cache-control', 'public, max-age=31536000, immutable')
        // Sem isto, um navegador antigo poderia decidir sozinho que o conteúdo
        // é outra coisa e executá-lo.
        .header('x-content-type-options', 'nosniff')
        .send(data)
    );
  });
}
