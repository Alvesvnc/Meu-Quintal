import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Um projeto por workspace: cada um roda no ambiente certo e os testes
    // ficam ao lado do codigo que eles cobrem.
    projects: [
      {
        test: {
          name: 'server',
          root: './server',
          environment: 'node',
          // Define as env vars antes de lib/env.ts ser importado — ele valida
          // no topo do modulo e mata o processo se faltar variavel.
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'shared',
          root: './packages/shared',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'design-system',
          root: './packages/design-system',
          // jsdom: os testes de hook precisam de document (visibilitychange).
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'cliente',
          root: './apps/cliente',
          // jsdom: o store do carrinho usa `persist` do zustand, que precisa de
          // localStorage. Tambem deixa o caminho aberto pra testes de componente.
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'server/src/lib/**',
        'server/src/modules/**',
        // plugins/ ESTAVA DE FORA e e onde mora auth de mesa, de cozinha, de
        // dono, socket e error handler. Medir cobertura escondendo justamente
        // o codigo de seguranca produz um numero que engana.
        'server/src/plugins/**',
        'packages/shared/src/**',
        'apps/*/src/stores/**',
        'apps/*/src/lib/**',
      ],
      exclude: [
        '**/*.test.*',
        '**/node_modules/**',
        // Arquivos so de tipo nao tem runtime: entram como 0% e derrubam o
        // numero sem que exista nada pra testar.
        '**/types/**',
        '**/*.d.ts',
        // Instancia o PrismaClient e mais nada.
        'server/src/lib/prisma.ts',
        // Efeito colateral de boot; o que ele chama e coberto em sentry.test.
        'server/src/instrument.ts',
      ],
    },
  },
});
