/**
 * Entrada serverless do Vercel.
 *
 * Todo o backend (Express) é servido por esta única função; os arquivos
 * estáticos ficam no CDN do Vercel (dist/). O estado persistente vive no
 * Redis (UPSTASH_REDIS_REST_URL/TOKEN) — ver src/server/store.ts.
 */
import handler from '../server';

export default handler;
