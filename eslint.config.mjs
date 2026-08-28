import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      'server/src/generated/**',
      // Referencia de design, nao codigo do produto: o prototipo das telas e o
      // suporte dele rodam soltos no navegador, fora do build.
      'docs/design-system/qro/modernist/**',
    ],
  },

  // ─── Base: todo TS/TSX do monorepo ──────────────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // `any` desliga o compilador justamente onde a forma do valor e
      // desconhecida — que e quando ele mais serve. As ocorrencias legitimas
      // restantes sao decorators do Fastify, com eslint-disable pontual e
      // comentario explicando.
      '@typescript-eslint/no-explicit-any': 'error',
      // Permitir _prefixo pra argumento intencionalmente nao usado
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },

  // ─── Apps React (browser) ───────────────────────────────────────────────
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/design-system/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Exportar hook/constante junto de componente quebra o Fast Refresh: cada
      // salvamento remonta a tela e perde estado e rolagem.
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],

      // Regras do React Compiler (react-hooks v7). Foram 'warn' ate 2026-08-24,
      // quando as 22 violacoes foram zeradas. Agora sao 'error' pra nao voltarem
      // por descuido — sao bugs de verdade em modo concorrente, nao estilo.
      'react-hooks/purity': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  // ─── Server + scripts Node ──────────────────────────────────────────────
  {
    files: ['server/**/*.ts', '**/*.config.{ts,mts,js,mjs}'],
    languageOptions: { globals: globals.node },
    rules: {
      // server usa logger do Fastify, nao console
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // ─── Scripts de build e de banco ────────────────────────────────────────
  // Rodam no terminal, por uma pessoa. console.log NAO e debug esquecido aqui:
  // e a saida do comando (relatorio de build, resumo do seed, resultado da
  // prova de isolamento).
  {
    files: ['**/build.mjs', '**/scripts/**/*.{mjs,ts}', 'server/prisma/**/*.{mjs,ts}'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ─── Testes sao mais soltos ─────────────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },

  // desliga regras que brigam com o Prettier — precisa ser o ultimo
  prettier,
);
