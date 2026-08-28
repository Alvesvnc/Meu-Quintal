import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * Prazo por caso e por hook, acima do padrao (5s e 10s).
     *
     * ─── POR QUE MEXER NISTO ────────────────────────────────────────────────
     *
     * Nao e pra fazer teste lento passar. E porque o caso mais lento da suite
     * leva ~555ms, quase todo ele montando um Fastify novo no beforeEach — e
     * numa maquina sob carga (build, dev server, outro processo pesado) esse
     * numero estica. Com 5s, bastava um fator 10 pra virar falha por prazo, que
     * aparece como "teste instavel" e nao como "maquina ocupada".
     *
     * O prazo continua existindo pra pegar TRAVAMENTO — promessa que nunca
     * resolve, socket que nao fecha. 15s pega isso do mesmo jeito; o que ele
     * deixa de pegar e lentidao passageira, que nunca foi bug.
     *
     * Nao e chute: a hipotese do argon2 (64MB por hash) foi medida e
     * descartada — 41ms sozinho, 669ms com 24 em paralelo. Ver pendencias.txt.
     */
    testTimeout: 15_000,
    hookTimeout: 20_000,
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
      // Estes dois FALTAVAM. O efeito nao era teste falhando — era teste que
      // nunca rodava: criar um `.test.ts` em apps/restaurante nao dava erro
      // nenhum, so silencio, e a suite seguia verde sem executar nada dali.
      // Pior ainda porque `coverage.include` ja listava `apps/*/src/lib/**`,
      // entao a configuracao dizia cobrir um codigo que nao tinha como ser
      // exercitado.
      {
        test: {
          name: 'restaurante',
          root: './apps/restaurante',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'dono',
          root: './apps/dono',
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
