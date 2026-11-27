// Wrapper CommonJS para o web-push: permite import default em ESM (Node e Bun)
// e faz o esbuild empacotar o pacote no bundle do Vercel.
module.exports = require('web-push');
