import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // Reset (idempotente — chama db:reset antes pra wipe completo)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategoria.deleteMany();
  await prisma.kitchenUser.deleteMany();
  await prisma.kitchen.deleteMany();
  await prisma.table.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.space.deleteMany();
  await prisma.accountUser.deleteMany();
  await prisma.account.deleteMany();

  // Senha padrao pra dev — TODOS os users tem a mesma. NUNCA usar em prod.
  const DEV_PASSWORD = 'quintal2026';
  const passwordHash = await argon2.hash(DEV_PASSWORD);

  // ─── Conta (o cliente do SaaS) ─────────────────────────────────────────
  const account = await prisma.account.create({
    data: {
      slug: 'quintal-sao-sebastiao',
      name: 'Quintal São Sebastião',
      plan: 'praca',
      status: 'ativa',
      users: {
        create: {
          email: 'marina@qro.app',
          passwordHash,
          name: 'Marina',
          role: 'owner',
        },
      },
    },
  });

  // ─── Espaco ────────────────────────────────────────────────────────────
  const space = await prisma.space.create({
    data: {
      accountId: account.id,
      slug: 'sao-sebastiao',
      name: 'Meu Quintal · São Sebastião',
      defaultCommissionPct: 15,
      closingDay: 5,
    },
  });

  // ─── Mesas (16) ────────────────────────────────────────────────────────
  // QR tokens previsiveis pra desenvolvimento: "mesa-{N}-dev"
  const tables = await Promise.all(
    Array.from({ length: 16 }, (_, i) => {
      const numero = i + 1;
      return prisma.table.create({
        data: {
          numero,
          qrToken: `mesa-${numero}-dev`,
          spaceId: space.id,
        },
      });
    }),
  );

  // ─── Cozinhas (5 ativas + 1 pausada) ───────────────────────────────────
  const PHOTOS = {
    burger:    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80&auto=format&fit=crop',
    moqueca:   'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80&auto=format&fit=crop',
    pastel:    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80&auto=format&fit=crop',
    salada:    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80&auto=format&fit=crop',
    doce:      'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=80&auto=format&fit=crop',
    batata:    'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&q=80&auto=format&fit=crop',
    refri:     'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80&auto=format&fit=crop',
    cerveja:   'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&q=80&auto=format&fit=crop',
    smashVeg:  'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=400&q=80&auto=format&fit=crop',
    brownie:   'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&q=80&auto=format&fit=crop',
    agua:      'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&q=80&auto=format&fit=crop',
  };

  // Helper pra criar user da cozinha
  async function createOwner(kitchenId: string, email: string, name: string) {
    return prisma.kitchenUser.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        kitchenId,
        role: 'owner',
      },
    });
  }

  interface ItemDoSeed {
    name: string;
    description?: string;
    priceCents: number;
    photoUrl?: string;
    sortOrder?: number;
    available?: boolean;
    badge?: 'novo' | 'esgotando' | 'sem_estoque';
  }

  /**
   * Cria as secoes do cardapio e os itens de cada uma.
   *
   * Duas escritas, e nao um `create` aninhado na cozinha: o item aponta pro ID
   * da secao, e um create aninhado nao le o id de um irmao criado no mesmo
   * comando. A ordem das secoes e a ordem em que elas aparecem aqui — que e
   * como a cozinha ordena no app.
   *
   * Os nomes variam de cozinha pra cozinha DE PROPOSITO: desde 2026-08-27 os
   * topicos sao escritos por quem cozinha, e um banco de dev em que todo mundo
   * usa "Entradas/Pratos/Sobremesas/Bebidas" esconderia justamente isso.
   */
  async function cardapio(
    kitchenId: string,
    secoes: Array<{ nome: string; itens: ItemDoSeed[] }>,
  ) {
    for (const [i, secao] of secoes.entries()) {
      const categoria = await prisma.menuCategoria.create({
        data: { kitchenId, name: secao.nome, sortOrder: i },
      });
      if (secao.itens.length > 0) {
        await prisma.menuItem.createMany({
          data: secao.itens.map((item) => ({ ...item, kitchenId, categoriaId: categoria.id })),
        });
      }
    }
  }

  // Lou Burger
  const louBurger = await prisma.kitchen.create({
    data: {
      slug: 'lou-burger',
      name: 'Lou Burger',
      category: 'Hamburgueria',
      tagline: 'Hambúrguer de pasto, batata-doce frita.',
      photoUrl: PHOTOS.burger,
      slaMinutes: 12,
      status: 'ativa',
      spaceId: space.id,
      // Acordo: comissao padrao do quintal (15%), sem aluguel
      chargeCommission: true,
      chargeRent: false,
    },
  });

  await cardapio(louBurger.id, [
    {
      nome: 'Pra começar',
      itens: [
        { name: 'Batata-doce frita', description: 'Cubos rústicos, sal de ervas, maionese de páprica defumada.', priceCents: 1800, photoUrl: PHOTOS.batata, sortOrder: 1 },
        { name: 'Onion rings',       description: 'Cebola roxa em anéis grossos, empanado leve, molho ranch da casa.', priceCents: 2200, photoUrl: PHOTOS.batata, sortOrder: 2 },
      ],
    },
    {
      nome: 'Os smash',
      itens: [
        { name: 'Smash Lou',         description: 'Dois smashes de 90g, queijo prato derretido, picles, molho da casa.', priceCents: 3200, photoUrl: PHOTOS.burger, sortOrder: 1, badge: 'novo' },
        { name: 'Smash duplo bacon', description: 'Dois smashes 90g, bacon caramelizado, cheddar inglês, cebola crispy.', priceCents: 3800, photoUrl: PHOTOS.burger, sortOrder: 2 },
        { name: 'Smash vegetariano', description: 'Burger de grão-de-bico e beterraba, queijo coalho, rúcula.', priceCents: 2900, photoUrl: PHOTOS.smashVeg, sortOrder: 3 },
        { name: 'Smash triplo',      description: 'Três smashes 90g, cheddar duplo, sem firula.', priceCents: 4600, photoUrl: PHOTOS.burger, sortOrder: 4, available: false, badge: 'sem_estoque' },
      ],
    },
    {
      nome: 'Doce',
      itens: [
        { name: 'Brownie quente', description: 'Brownie meio amargo recém-saído do forno, sorvete de baunilha.', priceCents: 2400, photoUrl: PHOTOS.brownie, sortOrder: 1 },
      ],
    },
    {
      nome: 'Bebidas',
      itens: [
        { name: 'Refrigerante lata', description: 'Coca, Guaraná, Sprite, Coca zero.', priceCents: 700, photoUrl: PHOTOS.refri, sortOrder: 1 },
        { name: 'Água com gás',      description: '500ml, limão opcional.', priceCents: 600, photoUrl: PHOTOS.agua, sortOrder: 2 },
        { name: 'Chopp artesanal',   description: 'Pilsen da microcervejaria parceira, 350ml.', priceCents: 1400, photoUrl: PHOTOS.cerveja, sortOrder: 3, badge: 'esgotando' },
      ],
    },
  ]);

  await createOwner(louBurger.id, 'marcos@louburger.com', 'Marcos');

  // Cumbuca Caicara
  const cumbuca = await prisma.kitchen.create({
    data: {
      slug: 'cumbuca-caicara',
      name: 'Cumbuca Caiçara',
      category: 'Frutos do mar',
      tagline: 'Moqueca, peixe do dia, arroz de coco.',
      photoUrl: PHOTOS.moqueca,
      slaMinutes: 18,
      status: 'ativa',
      spaceId: space.id,
      // Acordo: comissao menor negociada + aluguel da casinha
      chargeCommission: true,
      commissionPct: 12,
      chargeRent: true,
      rentCents: 80_000,
    },
  });

  await cardapio(cumbuca.id, [
    {
      nome: 'Do mar',
      itens: [
        { name: 'Moqueca de peixe', description: 'Peixe branco do dia, leite de coco, dendê, arroz de coco e farofa.', priceCents: 5800, photoUrl: PHOTOS.moqueca, sortOrder: 1 },
        { name: 'Moqueca grande',   description: 'Pra duas pessoas. Acompanha pirão.', priceCents: 8800, photoUrl: PHOTOS.moqueca, sortOrder: 2 },
      ],
    },
    {
      nome: 'Sucos',
      itens: [
        { name: 'Suco de maracujá', description: 'Polpa fresca, sem açúcar.', priceCents: 1200, photoUrl: PHOTOS.refri, sortOrder: 1 },
      ],
    },
  ]);

  await createOwner(cumbuca.id, 'ana@cumbuca.com', 'Ana');

  // Pasteloka
  const pasteloka = await prisma.kitchen.create({
    data: {
      slug: 'pasteloka',
      name: 'Pasteloka',
      category: 'Feira',
      tagline: 'Pastel de feira, caldo de cana, queijo coalho.',
      photoUrl: PHOTOS.pastel,
      slaMinutes: 8,
      status: 'ativa',
      spaceId: space.id,
      // Acordo: so aluguel — volume alto, ticket baixo
      chargeCommission: false,
      chargeRent: true,
      rentCents: 60_000,
    },
  });

  await cardapio(pasteloka.id, [
    {
      nome: 'Pastéis',
      itens: [
        { name: 'Pastel de carne',  description: 'Massa fininha, carne moída temperada.', priceCents: 1200, photoUrl: PHOTOS.pastel, sortOrder: 1 },
        { name: 'Pastel de queijo', description: 'Queijo coalho derretido, recheio fartos.', priceCents: 1200, photoUrl: PHOTOS.pastel, sortOrder: 2 },
      ],
    },
    {
      nome: 'Pra beber',
      itens: [
        { name: 'Caldo de cana 300ml', description: 'Da hora, com limão opcional.', priceCents: 900, photoUrl: PHOTOS.refri, sortOrder: 1 },
      ],
    },
  ]);

  await createOwner(pasteloka.id, 'seujose@pasteloka.com', 'Seu José');

  // Horta do Ze
  const horta = await prisma.kitchen.create({
    data: {
      slug: 'horta-do-ze',
      name: 'Horta do Zé',
      category: 'Vegetariano',
      tagline: 'Tigela de grãos, vegetais grelhados, missô.',
      photoUrl: PHOTOS.salada,
      slaMinutes: 10,
      status: 'ativa',
      spaceId: space.id,
      // Acordo: comissao padrao + aluguel
      chargeCommission: true,
      chargeRent: true,
      rentCents: 50_000,
    },
  });

  // Uma secao so: o cardapio pequeno tambem tem que ficar bem.
  await cardapio(horta.id, [
    {
      nome: 'Tigelas',
      itens: [
        { name: 'Tigela do Zé',  description: 'Quinoa, grão-de-bico, vegetais assados, molho de missô.', priceCents: 3200, photoUrl: PHOTOS.salada, sortOrder: 1 },
        { name: 'Bowl de grãos', description: 'Arroz vermelho, feijão azuki, ovo, abobrinha.', priceCents: 2800, photoUrl: PHOTOS.salada, sortOrder: 2 },
      ],
    },
  ]);

  await createOwner(horta.id, 'ze@hortadoze.com', 'Zé');

  // Dolce Marina
  const dolce = await prisma.kitchen.create({
    data: {
      slug: 'dolce-marina',
      name: 'Dolce Marina',
      category: 'Doceria',
      tagline: 'Brigadeiro de colher, pudim, café coado.',
      photoUrl: PHOTOS.doce,
      slaMinutes: 5,
      status: 'ativa',
      spaceId: space.id,
      // Acordo: comissao maior, sem aluguel (quiosque pequeno)
      chargeCommission: true,
      commissionPct: 18,
      chargeRent: false,
    },
  });

  await cardapio(dolce.id, [
    {
      nome: 'Doces',
      itens: [
        { name: 'Brigadeiro de colher', description: 'Pote 200g, com granulado belga.', priceCents: 1800, photoUrl: PHOTOS.doce, sortOrder: 1 },
        { name: 'Pudim de leite',       description: 'Tradicional, calda escura.', priceCents: 1600, photoUrl: PHOTOS.doce, sortOrder: 2 },
      ],
    },
    {
      nome: 'Café',
      itens: [
        { name: 'Café coado', description: 'Especial do dia, 200ml.', priceCents: 800, photoUrl: PHOTOS.refri, sortOrder: 1 },
      ],
    },
  ]);

  await createOwner(dolce.id, 'marina@dolcemarina.com', 'Marina');

  // Taverna do Pico (pausada — exemplo de cozinha que ainda nao publicou)
  const taverna = await prisma.kitchen.create({
    data: {
      slug: 'taverna-do-pico',
      name: 'Taverna do Pico',
      category: 'Drinkeria',
      tagline: 'Drinks autorais, petiscos.',
      slaMinutes: 15,
      status: 'pausada',
      spaceId: space.id,
      // Acordo: ancora, entra sem cobranca nenhuma no primeiro ano
      chargeCommission: false,
      chargeRent: false,
    },
  });

  // Secoes escritas, nenhum item ainda: e o estado de quem acabou de entrar e
  // ja organizou o cardapio de cabeca. O app do cliente pula secao vazia.
  await cardapio(taverna.id, [
    { nome: 'Drinks', itens: [] },
    { nome: 'Petiscos', itens: [] },
  ]);

  console.log(`
✓ Seed completo
  Space:   ${space.slug}
  Mesas:   ${tables.length} (qrTokens: mesa-1-dev .. mesa-16-dev)
  Cozinhas: 5 ativas + 1 pausada

Cliente (sem cadastro, via QR):
  curl -H "Authorization: Bearer mesa-12-dev" http://localhost:3001/api/m/quintal

Restaurante (login email/senha — senha unica de DEV: "${DEV_PASSWORD}"):
  - marcos@louburger.com       → Lou Burger
  - ana@cumbuca.com            → Cumbuca Caiçara
  - seujose@pasteloka.com      → Pasteloka
  - ze@hortadoze.com           → Horta do Zé
  - marina@dolcemarina.com     → Dolce Marina

  curl -X POST -H "Content-Type: application/json" \\
    -d '{"email":"marcos@louburger.com","password":"${DEV_PASSWORD}"}' \\
    http://localhost:3001/api/r/auth/login

Item ID pra criar pedido cliente (use no body):
  ${louBurger.id}
`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
