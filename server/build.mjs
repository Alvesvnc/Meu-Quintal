import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

/**
 * Bundle de producao do server.
 *
 * Por que bundle e nao `tsc`: `@mq/shared` e um pacote do workspace que exporta
 * TypeScript cru (`main: src/index.ts`). O `tsc` deixa o `import '@mq/shared'`
 * intacto no dist, e em runtime o Node resolveria pra um `.ts` — que so funciona
 * por causa do type stripping do Node 24 e some numa imagem que nao carrega o
 * codigo-fonte do monorepo. O esbuild inlina o `@mq/*` e o problema acaba.
 *
 * Tudo que veio do npm fica `external` e e instalado na imagem: bundlar
 * @prisma/client (que carrega engine nativo) e argon2 (binding .node) quebra.
 */
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// A versao que vale e a da RAIZ do monorepo — os workspaces ficam em 0.0.1 de
// proposito, por serem privados e nunca publicados. Ver CHANGELOG.md.
const raiz = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// `prisma` (o CLI) esta em dependencies pra viajar na imagem e rodar
// `migrate deploy` — mas nao e importado pelo codigo, entao fica de fora.
const external = Object.keys(pkg.dependencies ?? {}).filter(
  (d) => !d.startsWith('@mq/') && d !== 'prisma',
);

const result = await build({
  // bootstrap.ts entra no bundle pra poder rodar NA IMAGEM de producao, onde
  // o tsx foi podado e nao ha codigo-fonte. E o comando de onboarding de
  // cliente novo — ver docs/runbook-operacao.md.
  entryPoints: ['src/server.ts', 'src/bootstrap.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  // sem isto o esbuild acha um base dir comum e aninha a saida
  outbase: 'src',
  minify: false, // stack trace legivel vale mais que os KB economizados
  external,
  define: { __VERSAO__: JSON.stringify(raiz.version) },
  logLevel: 'info',
  metafile: true,
  banner: {
    // Algumas deps (pino/thread-stream) chamam require() mesmo em contexto ESM.
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
});

const bytes = Object.values(result.metafile.outputs).reduce((a, o) => a + o.bytes, 0);
console.log(
  `bundle: ${(bytes / 1024).toFixed(1)} KB · externals: ${external.length} · v${raiz.version}`,
);
