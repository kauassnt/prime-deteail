/**
 * Gera a função serverless do Vercel como um único arquivo `api/index.js`.
 *
 * O Vercel só compila arquivos dentro de `api/`; `server.ts` e `src/server/store.ts`
 * ficavam de fora e o import `../server` quebrava em runtime. Aqui o backend é
 * empacotado com esbuild, resolvendo os imports relativos do projeto.
 *
 * As dependências de `node_modules` ficam externas (o Vercel instala e empacota
 * via file tracing), exceto `web-push`, que é CommonJS e precisa entrar no bundle
 * para o import default funcionar. Isso evita o erro de `require` dinâmico do
 * `debug`/`body-parser` que aparece ao empacotar o Express inteiro.
 */
import { build } from 'esbuild';

const isWebPush = path => path === 'web-push' || path.startsWith('web-push/');

const plugin = {
  name: 'externalize-node-modules',
  setup(build) {
    build.onResolve({ filter: /^[a-zA-Z@]/ }, args => {
      if (args.kind === 'entry-point') return null;
      if (isWebPush(args.path)) return null; // empacota o web-push
      return { external: true }; // demais pacotes ficam em node_modules
    });
  },
};

await build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/index.js',
  sourcemap: false,
  legalComments: 'none',
  // Remove o ramo de desenvolvimento (import dinâmico de "vite") do bundle.
  minifySyntax: true,
  plugins: [plugin],
  logLevel: 'info',
});
