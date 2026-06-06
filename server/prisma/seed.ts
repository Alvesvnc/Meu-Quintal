import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Reset (idempotente — chama db:reset antes pra wipe completo)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.kitchen.deleteMany();
  await prisma.table.deleteMany();
  await prisma.space.deleteMany();

  // ─── Espaco ────────────────────────────────────────────────────────────
  const space = await prisma.space.create({
    data: {
      slug: 'sao-sebastiao',
      name: 'Meu Quintal · São Sebastião',
      commissionPct: 15,
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
      menuItems: {
        create: [
          { category: 'entradas',   name: 'Batata-doce frita',     description: 'Cubos rústicos, sal de ervas, maionese de páprica defumada.',          priceCents: 1800, photoUrl: PHOTOS.batata,   sortOrder: 1 },
          { category: 'entradas',   name: 'Onion rings',           description: 'Cebola roxa em anéis grossos, empanado leve, molho ranch da casa.',     priceCents: 2200, photoUrl: PHOTOS.batata,   sortOrder: 2 },
          { category: 'pratos',     name: 'Smash Lou',             description: 'Dois smashes de 90g, queijo prato derretido, picles, molho da casa.',   priceCents: 3200, photoUrl: PHOTOS.burger,   sortOrder: 1, badge: 'novo' },
          { category: 'pratos',     name: 'Smash duplo bacon',     description: 'Dois smashes 90g, bacon caramelizado, cheddar inglês, cebola crispy.',  priceCents: 3800, photoUrl: PHOTOS.burger,   sortOrder: 2 },
          { category: 'pratos',     name: 'Smash vegetariano',     description: 'Burger de grão-de-bico e beterraba, queijo coalho, rúcula.',            priceCents: 2900, photoUrl: PHOTOS.smashVeg, sortOrder: 3 },
          { category: 'pratos',     name: 'Smash triplo',          description: 'Três smashes 90g, cheddar duplo, sem firula.',                          priceCents: 4600, photoUrl: PHOTOS.burger,   sortOrder: 4, available: false, badge: 'sem_estoque' },
          { category: 'sobremesas', name: 'Brownie quente',        description: 'Brownie meio amargo recém-saído do forno, sorvete de baunilha.',       priceCents: 2400, photoUrl: PHOTOS.brownie,  sortOrder: 1 },
          { category: 'bebidas',    name: 'Refrigerante lata',     description: 'Coca, Guaraná, Sprite, Coca zero.',                                     priceCents:  700, photoUrl: PHOTOS.refri,    sortOrder: 1 },
          { category: 'bebidas',    name: 'Água com gás',          description: '500ml, limão opcional.',                                                priceCents:  600, photoUrl: PHOTOS.agua,     sortOrder: 2 },
          { category: 'bebidas',    name: 'Chopp artesanal',       description: 'Pilsen da microcervejaria parceira, 350ml.',                            priceCents: 1400, photoUrl: PHOTOS.cerveja,  sortOrder: 3, badge: 'esgotando' },
        ],
      },
    },
  });

  // Cumbuca Caicara
  await prisma.kitchen.create({
    data: {
      slug: 'cumbuca-caicara',
      name: 'Cumbuca Caiçara',
      category: 'Frutos do mar',
      tagline: 'Moqueca, peixe do dia, arroz de coco.',
      photoUrl: PHOTOS.moqueca,
      slaMinutes: 18,
      status: 'ativa',
      spaceId: space.id,
      menuItems: {
        create: [
          { category: 'pratos', name: 'Moqueca de peixe', description: 'Peixe branco do dia, leite de coco, dendê, arroz de coco e farofa.', priceCents: 5800, photoUrl: PHOTOS.moqueca, sortOrder: 1 },
          { category: 'pratos', name: 'Moqueca grande',   description: 'Pra duas pessoas. Acompanha pirão.',                                  priceCents: 8800, photoUrl: PHOTOS.moqueca, sortOrder: 2 },
          { category: 'bebidas', name: 'Suco de maracujá',description: 'Polpa fresca, sem açúcar.',                                            priceCents: 1200, photoUrl: PHOTOS.refri,   sortOrder: 1 },
        ],
      },
    },
  });

  // Pasteloka
  await prisma.kitchen.create({
    data: {
      slug: 'pasteloka',
      name: 'Pasteloka',
      category: 'Feira',
      tagline: 'Pastel de feira, caldo de cana, queijo coalho.',
      photoUrl: PHOTOS.pastel,
      slaMinutes: 8,
      status: 'ativa',
      spaceId: space.id,
      menuItems: {
        create: [
          { category: 'pratos',  name: 'Pastel de carne',      description: 'Massa fininha, carne moída temperada.',  priceCents: 1200, photoUrl: PHOTOS.pastel, sortOrder: 1 },
          { category: 'pratos',  name: 'Pastel de queijo',     description: 'Queijo coalho derretido, recheio fartos.', priceCents: 1200, photoUrl: PHOTOS.pastel, sortOrder: 2 },
          { category: 'bebidas', name: 'Caldo de cana 300ml',  description: 'Da hora, com limão opcional.',             priceCents:  900, photoUrl: PHOTOS.refri,  sortOrder: 1 },
        ],
      },
    },
  });

  // Horta do Ze
  await prisma.kitchen.create({
    data: {
      slug: 'horta-do-ze',
      name: 'Horta do Zé',
      category: 'Vegetariano',
      tagline: 'Tigela de grãos, vegetais grelhados, missô.',
      photoUrl: PHOTOS.salada,
      slaMinutes: 10,
      status: 'ativa',
      spaceId: space.id,
      menuItems: {
        create: [
          { category: 'pratos', name: 'Tigela do Zé',     description: 'Quinoa, grão-de-bico, vegetais assados, molho de missô.',  priceCents: 3200, photoUrl: PHOTOS.salada, sortOrder: 1 },
          { category: 'pratos', name: 'Bowl de grãos',    description: 'Arroz vermelho, feijão azuki, ovo, abobrinha.',             priceCents: 2800, photoUrl: PHOTOS.salada, sortOrder: 2 },
        ],
      },
    },
  });

  // Dolce Marina
  await prisma.kitchen.create({
    data: {
      slug: 'dolce-marina',
      name: 'Dolce Marina',
      category: 'Doceria',
      tagline: 'Brigadeiro de colher, pudim, café coado.',
      photoUrl: PHOTOS.doce,
      slaMinutes: 5,
      status: 'ativa',
      spaceId: space.id,
      menuItems: {
        create: [
          { category: 'sobremesas', name: 'Brigadeiro de colher', description: 'Pote 200g, com granulado belga.', priceCents: 1800, photoUrl: PHOTOS.doce, sortOrder: 1 },
          { category: 'sobremesas', name: 'Pudim de leite',       description: 'Tradicional, calda escura.',       priceCents: 1600, photoUrl: PHOTOS.doce, sortOrder: 2 },
          { category: 'bebidas',    name: 'Café coado',           description: 'Especial do dia, 200ml.',           priceCents:  800, photoUrl: PHOTOS.refri, sortOrder: 1 },
        ],
      },
    },
  });

  // Taverna do Pico (pausada — exemplo de cozinha que ainda nao publicou)
  await prisma.kitchen.create({
    data: {
      slug: 'taverna-do-pico',
      name: 'Taverna do Pico',
      category: 'Drinkeria',
      tagline: 'Drinks autorais, petiscos.',
      slaMinutes: 15,
      status: 'pausada',
      spaceId: space.id,
    },
  });

  console.log(`
✓ Seed completo
  Space:   ${space.slug}
  Mesas:   ${tables.length} (qrTokens: mesa-1-dev .. mesa-16-dev)
  Cozinhas: 5 ativas + 1 pausada

Teste:
  curl -H "Authorization: Bearer mesa-12-dev" http://localhost:3001/api/m/quintal
  curl -H "Authorization: Bearer mesa-12-dev" http://localhost:3001/api/m/k/lou-burger

Item ID pra criar pedido (use no body): copie de qualquer item do Lou Burger:
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
