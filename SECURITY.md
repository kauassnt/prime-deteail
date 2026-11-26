# Segurança — PK Detail / Prime Detail

Documento técnico da arquitetura de segurança aplicada ao projeto. Não é uma garantia de
imunidade: segurança é processo contínuo e depende também de hospedagem, DNS, TLS,
monitoramento externo e disciplina operacional.

## Arquitetura atual

- **Frontend:** React + Vite (SPA), servido pelo mesmo processo Express (`server.ts`).
- **Backend:** Express 5 com endpoints de estado compartilhado, SSE, identidade visual,
  snapshot público e agendamento público.
- **Persistência:** arquivos JSON em `storage/` (`storage/realtime/state.json`,
  `storage/brand-identity/`), não há banco SQL nem Supabase — portanto RLS/SQL Injection
  não se aplicam a este desenho.
- **Sessão:** cookie `pk_sid` HttpOnly, SameSite=Strict, Secure em HTTPS; sessões opacas
  em memória no servidor com expiração deslizante de 8h.

## Controles implementados

| Área | Controle | Status |
| --- | --- | --- |
| Autenticação | Login validado exclusivamente no servidor (`POST /api/auth/login`) | Implementado e testado |
| Credencial | Senha individual por funcionário com hash scrypt + salt (`storage/security/user-credentials.json`); PIN da empresa como fallback até a primeira senha | Implementado e testado |
| Gestão de acessos | Admin define/redefine senha no módulo Funcionários; painel exibido conforme Perfil + Permissões | Implementado e testado |
| Sessão | Cookie HttpOnly / SameSite=Strict / Secure em HTTPS, TTL 8h, rotação no login, logout revoga | Implementado e testado |
| APIs internas | `/api/state` (GET/POST) e `/api/events` exigem sessão | Implementado e testado |
| RBAC | Logomarca (POST/DELETE) exige sessão com papel `admin` validado no servidor | Implementado e testado (403 para gerente) |
| Anti-força-bruta | Limite por IP/conta (5 falhas / 10 min → bloqueio 15 min) + limite global de auth | Implementado e testado (429) |
| CSRF | SameSite=Strict + validação de `Origin` contra `Host` em escritas | Implementado e testado (403 origem externa) |
| Vazamento de PIN | `kioskPin` removido de `/api/public/snapshot` | Implementado e testado |
| Mass assignment | Agendamento público com whitelist de campos, limites e validação de data/hora/preço | Implementado e testado (400 em payload inválido) |
| Uploads | Whitelist de formatos, magic bytes, limite 5 MB, sanitização de SVG | Implementado (código existente; upload inválido rejeitado) |
| Erros | Handler central sem stack trace; 404 de API padronizado | Implementado |
| Headers | CSP, HSTS (HTTPS), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP | Implementado e testado |
| Rate limit geral | 600 req/min por IP na API; 120 escritas/min | Implementado |
| Logs de segurança | `storage/security/security.log` com eventos de login/falha/bloqueio, e-mail em SHA-256 | Implementado e testado |
| Backup | `bun run backup` — AES-256-GCM com chave via `PK_BACKUP_KEY`, verificação e restauração | Implementado e testado (integridade + chave errada) |
| Dependências | `bun audit` | Sem vulnerabilidades conhecidas (246 pacotes) |
| Source maps | Build de produção sem `.map` | Implementado e verificado |

## Pendências e riscos residuais

- **MFA/TOTP para administradores:** pendente. Exige cadastro de segredo por usuário e
  verificação em um segundo fator; não foi simulado.
- **Sessões em memória:** reiniciar o servidor encerra todas as sessões. Para produção com
  múltiplas réplicas, usar armazenamento compartilhado (Redis/DB) — pendente.
- **PIN no estado compartilhado:** o PIN usado pelo modo quiosque ainda existe em
  `pk_detail_portal_config_v1` no arquivo do servidor para permitir a edição na tela do
  portal. Ele não vai mais para o snapshot público nem para o bundle, mas a migração para
  uma credencial dedicada (somente hash, com endpoint de troca) é recomendada.
- **Criptografia em repouso do `state.json`:** não aplicada. O backup é cifrado, mas o
  arquivo ativo não é.
- **HTTPS/TLS, DNS, WAF e monitoramento de domínios clones:** dependem da hospedagem.
  Use TLS válido, HSTS já habilitado, e monitore domínios/marca externamente.
- **Isolamento multiusuário no banco:** não aplicável ao modelo atual de arquivo único.
  Ao migrar para Supabase/Postgres, aplicar RLS por `user_id` e nunca usar `service_role`
  no cliente.
- **Retenção/LGPD:** política de retenção e fluxo formal de acesso/exclusão ainda precisam
  ser definidos com o responsável legal.
- **Testes E2E:** a suíte Playwright do projeto está desatualizada e não foi executada.

## Operação

### Senhas da equipe
Cada funcionário tem login próprio (e-mail + senha individual). O administrador define ou
redefine a senha em **Funcionários → Editar funcionário → Senha de acesso**. Enquanto não
houver senha própria, o login usa o PIN da empresa como compatibilidade.

Recuperação emergencial (no servidor):
```bash
bun run reset-password -- funcionario@empresa.com "NovaSenhaForte"
```
O comando grava apenas o hash e não imprime a senha.

### Rotação do PIN da empresa
O hash é sincronizado automaticamente quando o PIN é alterado no painel do portal.
Depois da troca, faça login novamente para validar.

### Backup
```bash
PK_BACKUP_KEY="chave-longa-e-secreta" bun run backup
PK_BACKUP_KEY="..." bun run backup -- restore backups/pk-backup-....enc --verify
PK_BACKUP_KEY="..." bun run backup -- restore backups/pk-backup-....enc --write
```
Guarde `PK_BACKUP_KEY` fora do repositório e do servidor da aplicação. Teste a restauração
periodicamente; backup só é válido depois de restaurado com sucesso.

### Produção
- Defina `NODE_ENV=production` (redireciona HTTP→HTTPS e aplica CSP estrita).
- Sirva atrás de proxy TLS e mantenha `X-Forwarded-Proto` correto.
- Restrinja `storage/` e `backups/` fora do diretório público.
- Monitore `storage/security/security.log` e falhas de login.
