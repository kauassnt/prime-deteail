<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/892b740c-8816-4e29-803c-eb96a79571cb

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
# prime-deteail

## Deploy no Vercel

O app é Express + React (Vite). No Vercel ele roda em uma única função
serverless (`api/index.ts`) e os arquivos estáticos ficam no CDN (`dist/`).

Como o Vercel não tem disco persistente, todo o estado (clientes, OS, agenda,
financeiro, sessões, notificações e logo) fica em um Redis do Upstash.

### 1. Redis gratuito
1. Crie um banco em https://console.upstash.com
2. Copie a `UPSTASH_REDIS_REST_URL` e o `UPSTASH_REDIS_REST_TOKEN`

### 2. Variáveis no projeto do Vercel
| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | sim | conexão do Redis |
| `UPSTASH_REDIS_REST_TOKEN` | sim | token do Redis |
| `PK_BOOTSTRAP_ADMIN_EMAIL` | sim (1º deploy) | cria o admin inicial quando o Redis está vazio |
| `PK_BOOTSTRAP_ADMIN_NAME` | não | nome do admin inicial |
| `CRON_SECRET` | sim (push) | protege `/api/cron/push` |
| `PK_PUSH_SUBJECT` | não | contato VAPID (padrão `mailto:contato@pkdetail.com.br`) |
| `PK_PUSH_LEAD_MINUTES` | não | antecedência do aviso (padrão 60) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | não | fixa as chaves de push; sem elas são geradas e guardadas no Redis |

O primeiro login usa o PIN administrativo padrão `1234` — troque a senha no
primeiro acesso.

### 3. Migrar os dados que já existem localmente
Com as duas variáveis do Upstash no ambiente:

```bash
bun run seed:redis
```

Envia estado, senhas, chaves/inscrições de push e a identidade visual.

### 4. Notificações de agendamento
No Vercel não existe processo contínuo, então o agendador virou o endpoint
`GET /api/cron/push`. Configure um cron externo (por exemplo cron-job.org) para
chamar a cada minuto:

```
https://SEU-PROJETO.vercel.app/api/cron/push?key=SEU_CRON_SECRET
```

### 5. Sincronização entre dispositivos
Localmente o app usa SSE (`/api/events`). No Vercel o cliente detecta a falha do
stream e passa a buscar o estado a cada 5 segundos (`/api/state`).
