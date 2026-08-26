/**
 * Cria um SEGUNDO cliente do SaaS, usado pra provar o isolamento multi-tenant.
 *
 * De proposito ele repete o slug de cozinha "lou-burger", que existe no
 * quintal do outro cliente: e exatamente o caso que quebraria com o antigo
 * `slug @unique` global e que vazaria numa sala de socket enderecada por slug.
 *
 *   pnpm --filter @mq/server seed:tenant2
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('quintal2026');

  await prisma.account.deleteMany({ where: { slug: 'quintal-ubatuba' } });

  const account = await prisma.account.create({
    data: {
      slug: 'quintal-ubatuba',
      name: 'Quintal Ubatuba',
      plan: 'basico',
      status: 'ativa',
      users: {
        create: [
          {
            email: 'roberto@quintalubatuba.com',
            passwordHash,
            name: 'Roberto',
            role: 'owner',
          },
          {
            email: 'garcom@quintalubatuba.com',
            passwordHash,
            name: 'Tiago',
            role: 'staff',
          },
        ],
      },
    },
  });

  const space = await prisma.space.create({
    data: {
      accountId: account.id,
      slug: 'ubatuba-centro',
      name: 'Quintal Ubatuba · Centro',
      defaultCommissionPct: 20,
      closingDay: 10,
      tables: {
        create: [
          { numero: 1, qrToken: 'uba-mesa-1-dev' },
          { numero: 2, qrToken: 'uba-mesa-2-dev' },
        ],
      },
    },
  });

  // MESMO slug do outro cliente — permitido agora que o unique e por espaco.
  const cozinha = await prisma.kitchen.create({
    data: {
      spaceId: space.id,
      slug: 'lou-burger',
      name: 'Lou Burger Ubatuba',
      category: 'Hamburgueria',
      status: 'ativa',
      chargeCommission: true,
      chargeRent: false,
      menuItems: {
        create: [{ category: 'pratos', name: 'Smash Uba', priceCents: 3500, sortOrder: 1 }],
      },
      users: {
        create: {
          email: 'lou@ubatuba.com',
          passwordHash,
          name: 'Lou Ubatuba',
          role: 'owner',
        },
      },
    },
  });

  console.log('Segundo tenant criado:');
  console.log('  conta   :', account.slug, '(comissao padrao 20%)');
  console.log('  espaco  :', space.slug);
  console.log('  cozinha :', cozinha.slug, '<- MESMO slug do outro quintal');
  console.log('  dono    : roberto@quintalubatuba.com / quintal2026');
  console.log('  staff   : garcom@quintalubatuba.com / quintal2026');
  console.log('  mesa    : uba-mesa-1-dev');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
