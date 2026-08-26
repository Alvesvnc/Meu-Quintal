import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { io as conectar, type Socket } from 'socket.io-client';
import { criarPrismaMock, type PrismaMock } from '../test/prismaMock.js';

const prismaMock: PrismaMock = criarPrismaMock();
vi.mock('../lib/prisma.js', () => ({ prisma: prismaMock }));

const { buildApp } = await import('../app.js');

/**
 * Teste de integração real do Socket.io: sobe o servidor numa porta efêmera e
 * conecta com o cliente de verdade.
 *
 * Por que não testar a função de middleware isolada: o valor está justamente
 * no caminho do handshake — `io.use`, o formato de `socket.handshake.auth`, o
 * `next(new Error(...))` que vira `connect_error` no cliente. Chamar a função
 * na mão testaria a minha própria suposição sobre esse caminho, não o caminho.
 *
 * Este arquivo cobre a correção do vazamento em que qualquer pessoa entrava na
 * sala `kitchen:{slug}` de qualquer cozinha e assistia aos pedidos de um
 * concorrente em tempo real.
 */

let app: FastifyInstance;
let url: string;

const MESA = {
  id: 'table-1',
  spaceId: 'space-1',
  isActive: true,
};

const COZINHA = {
  id: 'kitchen-1',
  slug: 'lou-burger',
  status: 'ativa' as const,
};

beforeAll(async () => {
  app = await buildApp({ socket: true, logger: false, cron: false });
  // Porta 0 = o SO escolhe uma livre. Porta fixa faria os testes brigarem com
  // qualquer coisa rodando na máquina.
  await app.listen({ port: 0, host: '127.0.0.1' });
  const endereco = app.server.address();
  if (!endereco || typeof endereco === 'string') throw new Error('sem endereco');
  url = `http://127.0.0.1:${endereco.port}`;
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  Object.assign(prismaMock, criarPrismaMock());
});

/** Tenta conectar e devolve 'conectou' ou a mensagem da recusa. */
function tentarConectar(auth?: Record<string, unknown>): Promise<string> {
  return new Promise((resolve) => {
    const s = conectar(url, {
      transports: ['websocket'],
      auth,
      reconnection: false,
      timeout: 4000,
    });
    const fim = (r: string) => {
      s.close();
      resolve(r);
    };
    s.on('connect', () => fim('conectou'));
    s.on('connect_error', (e) => fim(e.message));
    setTimeout(() => fim('timeout'), 5000);
  });
}

/** Conecta de verdade e devolve o socket aberto (o chamador fecha). */
function conectarOk(auth: Record<string, unknown>): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = conectar(url, {
      transports: ['websocket'],
      auth,
      reconnection: false,
      timeout: 4000,
    });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(new Error(`nao conectou: ${e.message}`)));
  });
}

/** Em qual sala o socket entrou, perguntado ao servidor. */
function salasDo(socketId: string): string[] {
  const s = app.io.sockets.sockets.get(socketId);
  // O socket.io coloca todo socket numa sala com o próprio id; ela não conta.
  return s ? [...s.rooms].filter((r) => r !== socketId) : [];
}

/** Espera o servidor processar o emit — não há ack nessas rotas. */
const respirar = () => new Promise((r) => setTimeout(r, 120));

// ─── Handshake ──────────────────────────────────────────────────────────────

describe('handshake — quem entra', () => {
  it('sem auth nenhuma e recusado', async () => {
    expect(await tentarConectar()).toMatch(/token ausente/i);
  });

  it('auth vazia e recusada', async () => {
    expect(await tentarConectar({})).toMatch(/token ausente/i);
  });

  it('token vazio e recusado', async () => {
    expect(await tentarConectar({ kind: 'mesa', token: '' })).toMatch(/token ausente/i);
  });

  it('kind desconhecido e recusado', async () => {
    expect(await tentarConectar({ kind: 'admin', token: 'x' })).toMatch(/kind precisa ser/i);
  });

  it('kind ausente e recusado', async () => {
    expect(await tentarConectar({ token: 'x' })).toMatch(/kind precisa ser/i);
  });

  it('qrToken inexistente e recusado', async () => {
    prismaMock.table.findUnique.mockResolvedValue(null);
    expect(await tentarConectar({ kind: 'mesa', token: 'inventado' })).toMatch(/mesa invalida/i);
  });

  it('mesa desativada e recusada — desativar tem efeito imediato', async () => {
    prismaMock.table.findUnique.mockResolvedValue({ ...MESA, isActive: false });
    expect(await tentarConectar({ kind: 'mesa', token: 'mesa-4-dev' })).toMatch(/mesa invalida/i);
  });

  it('JWT forjado e recusado', async () => {
    expect(await tentarConectar({ kind: 'cozinha', token: 'eyJhbGciOiJIUzI1NiJ9.e30.x' })).toMatch(
      /credencial invalida/i,
    );
  });

  it('cozinha pausada e recusada', async () => {
    prismaMock.kitchen.findUnique.mockResolvedValue({ ...COZINHA, status: 'pausada' });
    const token = app.jwt.sign({
      kind: 'cozinha' as const,
      sub: 'u1',
      kitchenId: COZINHA.id,
      kitchenSlug: COZINHA.slug,
      email: 'a@b.c',
      role: 'owner',
    });
    expect(await tentarConectar({ kind: 'cozinha', token })).toMatch(/cozinha invalida|inativa/i);
  });

  it('mesa valida conecta', async () => {
    prismaMock.table.findUnique.mockResolvedValue(MESA);
    expect(await tentarConectar({ kind: 'mesa', token: 'mesa-4-dev' })).toBe('conectou');
  });

  it('cozinha ativa conecta', async () => {
    prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
    const token = app.jwt.sign({
      kind: 'cozinha' as const,
      sub: 'u1',
      kitchenId: COZINHA.id,
      kitchenSlug: COZINHA.slug,
      email: 'a@b.c',
      role: 'owner',
    });
    expect(await tentarConectar({ kind: 'cozinha', token })).toBe('conectou');
  });
});

// ─── Sala do pedido: a mesa só vê o que é dela ──────────────────────────────

describe('order:subscribe', () => {
  beforeEach(() => {
    prismaMock.table.findUnique.mockResolvedValue(MESA);
  });

  it('entra na sala do proprio pedido', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ tableId: MESA.id });
    const s = await conectarOk({ kind: 'mesa', token: 'mesa-4-dev' });

    s.emit('order:subscribe', 'pedido-1');
    await respirar();

    expect(salasDo(s.id!)).toContain('order:pedido-1');
    s.close();
  });

  // A trava principal desta sala
  it('NAO entra na sala de pedido de outra mesa', async () => {
    // Pedido existe, mas é de outra mesa. Sem esta checagem, uma mesa válida
    // espiaria o pedido de qualquer outra só sabendo o id.
    prismaMock.order.findUnique.mockResolvedValue({ tableId: 'table-DE-OUTRA-MESA' });
    const s = await conectarOk({ kind: 'mesa', token: 'mesa-4-dev' });

    s.emit('order:subscribe', 'pedido-alheio');
    await respirar();

    expect(salasDo(s.id!)).not.toContain('order:pedido-alheio');
    expect(salasDo(s.id!)).toHaveLength(0);
    s.close();
  });

  it('pedido inexistente nao cria sala', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    const s = await conectarOk({ kind: 'mesa', token: 'mesa-4-dev' });

    s.emit('order:subscribe', 'nao-existe');
    await respirar();

    expect(salasDo(s.id!)).toHaveLength(0);
    s.close();
  });

  it('ignora payload que nao e string', async () => {
    const s = await conectarOk({ kind: 'mesa', token: 'mesa-4-dev' });

    s.emit('order:subscribe', { malicioso: true });
    s.emit('order:subscribe', 42);
    s.emit('order:subscribe', null);
    await respirar();

    expect(salasDo(s.id!)).toHaveLength(0);
    s.close();
  });

  it('unsubscribe tira da sala', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ tableId: MESA.id });
    const s = await conectarOk({ kind: 'mesa', token: 'mesa-4-dev' });

    s.emit('order:subscribe', 'pedido-1');
    await respirar();
    expect(salasDo(s.id!)).toContain('order:pedido-1');

    s.emit('order:unsubscribe', 'pedido-1');
    await respirar();
    expect(salasDo(s.id!)).not.toContain('order:pedido-1');
    s.close();
  });
});

// ─── Sala da cozinha: onde estava o vazamento ───────────────────────────────

describe('kitchen:subscribe', () => {
  function tokenCozinha(kitchenId = COZINHA.id, slug = COZINHA.slug) {
    return app.jwt.sign({
      kind: 'cozinha' as const,
      sub: 'u1',
      kitchenId,
      kitchenSlug: slug,
      email: 'a@b.c',
      role: 'owner',
    });
  }

  beforeEach(() => {
    prismaMock.kitchen.findUnique.mockResolvedValue(COZINHA);
  });

  it('a sala e endereçada pelo ID, nunca pelo slug', async () => {
    const s = await conectarOk({ kind: 'cozinha', token: tokenCozinha() });

    s.emit('kitchen:subscribe', COZINHA.slug);
    await respirar();

    // Slug só é único DENTRO do quintal: com o slug no nome da sala, duas
    // "lou-burger" de clientes diferentes do SaaS cairiam na MESMA sala.
    expect(salasDo(s.id!)).toContain(`kitchen:${COZINHA.id}`);
    expect(salasDo(s.id!)).not.toContain(`kitchen:${COZINHA.slug}`);
    s.close();
  });

  it('NAO entra na sala de outra cozinha', async () => {
    const s = await conectarOk({ kind: 'cozinha', token: tokenCozinha() });

    s.emit('kitchen:subscribe', 'cozinha-concorrente');
    await respirar();

    expect(salasDo(s.id!)).toHaveLength(0);
    s.close();
  });

  it('mesa NAO entra em sala de cozinha', async () => {
    prismaMock.table.findUnique.mockResolvedValue(MESA);
    const s = await conectarOk({ kind: 'mesa', token: 'mesa-4-dev' });

    s.emit('kitchen:subscribe', COZINHA.slug);
    await respirar();

    expect(salasDo(s.id!)).toHaveLength(0);
    s.close();
  });

  it('cozinha NAO entra em sala de pedido', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ tableId: MESA.id });
    const s = await conectarOk({ kind: 'cozinha', token: tokenCozinha() });

    s.emit('order:subscribe', 'pedido-1');
    await respirar();

    expect(salasDo(s.id!)).toHaveLength(0);
    s.close();
  });

  it('unsubscribe tira da sala da cozinha', async () => {
    const s = await conectarOk({ kind: 'cozinha', token: tokenCozinha() });

    s.emit('kitchen:subscribe', COZINHA.slug);
    await respirar();
    expect(salasDo(s.id!)).toContain(`kitchen:${COZINHA.id}`);

    s.emit('kitchen:unsubscribe');
    await respirar();
    expect(salasDo(s.id!)).toHaveLength(0);
    s.close();
  });
});

// ─── O evento realmente chega em quem deve ──────────────────────────────────

describe('entrega de evento', () => {
  it('quem esta na sala recebe; quem nao esta, nao', async () => {
    prismaMock.table.findUnique.mockResolvedValue(MESA);
    prismaMock.order.findUnique.mockResolvedValue({ tableId: MESA.id });

    const dentro = await conectarOk({ kind: 'mesa', token: 'mesa-4-dev' });
    const fora = await conectarOk({ kind: 'mesa', token: 'mesa-4-dev' });

    dentro.emit('order:subscribe', 'pedido-x');
    await respirar();

    const recebidoDentro: unknown[] = [];
    const recebidoFora: unknown[] = [];
    dentro.on('order:status', (e) => recebidoDentro.push(e));
    fora.on('order:status', (e) => recebidoFora.push(e));

    app.io.to('order:pedido-x').emit('order:status', { orderId: 'pedido-x', status: 'pronto' });
    await respirar();

    expect(recebidoDentro).toHaveLength(1);
    expect(recebidoFora).toHaveLength(0);

    dentro.close();
    fora.close();
  });
});
