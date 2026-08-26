/**
 * Env do processo de teste.
 *
 * Precisa rodar ANTES de qualquer import de lib/env.ts, que valida no topo do
 * modulo e chama process.exit(1) se faltar variavel. Como setupFiles do Vitest
 * executam antes dos arquivos de teste, e aqui que isso cabe.
 *
 * Estes valores nao apontam pra lugar nenhum de verdade: os testes de rota
 * mockam o Prisma, entao a DATABASE_URL nunca chega a ser usada. Ela existe so
 * pra satisfazer o schema de validacao.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://teste:teste@localhost:5432/teste';
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-aqui';
process.env.CORS_ORIGINS = 'http://localhost:5173';

// Rate limit alto: os testes disparam varias requisicoes na mesma janela e um
// teto baixo faria um teste derrubar o seguinte com 429, criando falha que
// depende da ordem de execucao.
process.env.RATE_LIMIT_MAX = '100000';

// O .env DA MAQUINA nao pode influenciar teste. `dotenv` roda quando lib/env.ts
// e importado, e um DSN de verdade no arquivo faria os testes do Sentry
// medirem outra coisa. Vazio = ausente, e o dotenv nao sobrescreve chave que
// ja existe.
process.env.SENTRY_DSN = '';
process.env.METRICS_TOKEN = '';
process.env.RESEND_API_KEY = '';
