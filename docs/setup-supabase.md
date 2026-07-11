# Setup do Supabase

O Supabase é o **único serviço em nuvem obrigatório**: guarda o cache de posts e metadados do perfil. Você não precisa hospedar este repositório — só apontar o CLI local (e depois a Function do seu site) para o mesmo projeto.

**Tempo estimado:** 10–15 minutos na primeira vez.

---

## 1. Criar o projeto

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo (região próxima a você; plano **Free** basta).
2. Aguarde o provisionamento do banco.
3. Em **Project Settings → API**, copie:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** (em *Project API keys*, chave **secret**) → `SUPABASE_SERVICE_ROLE_KEY`

> **Segurança:** a `service_role` ignora RLS e tem acesso total ao banco. Use **somente** no `.env` deste CLI (máquina local) e em código **server-side** do seu site (Function, API route). **Nunca** em variáveis `VITE_*`, `NEXT_PUBLIC_*` ou qualquer código que vá para o browser.

---

## 2. Aplicar a migração

1. No dashboard: **SQL Editor** → **New query**.
2. Abra no repositório o arquivo [`supabase/migrations/20260709180000_initial_schema.sql`](../supabase/migrations/20260709180000_initial_schema.sql), copie **todo** o conteúdo e execute (**Run**).

Isso cria:

| Tabela | Função |
|--------|--------|
| `linkedin_posts_profiles` | Perfis monitorados (username, última coleta, falhas) |
| `linkedin_posts_posts` | Cache dos posts (upsert por `post_id`) |

O prefixo `linkedin_posts_` permite usar o mesmo projeto Supabase para outros apps sem conflito de nomes.

**RLS** fica ativo **sem** policy pública: visitantes com chave `anon` não leem nada. Leitura no site usa `service_role` no servidor ([integracao-site.md](integracao-site.md)).

**Conferir:** **Table Editor** → devem aparecer as duas tabelas.

---

## 3. Configurar o `.env` local

Na raiz do clone:

```bash
cp .env.example .env
```

Mínimo para começar:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
API_KEY=uma-chave-aleatoria-forte
SESSION_STORAGE_PROVIDER=local
SESSION_LOCAL_PATH=storage/session.json
SCRAPE_USERNAME=seu-username-linkedin
```

- **`SCRAPE_USERNAME`** — slug do perfil: `https://www.linkedin.com/in/seu-username-linkedin/` → `seu-username-linkedin`.
- **`API_KEY`** — só para a API local opcional (`yarn dev`); invente uma string longa.

Lista completa: [`.env.example`](../.env.example).

---

## 4. Cadastrar o perfil

A coleta só roda se existir uma linha em `linkedin_posts_profiles`. Escolha **uma** forma:

### Opção A — SQL (recomendada)

No SQL Editor, substitua o username:

```sql
insert into public.linkedin_posts_profiles (username, url, ativo, intervalo_coleta_horas)
values (
  'seu-username-linkedin',
  'https://www.linkedin.com/in/seu-username-linkedin/',
  true,
  168
)
on conflict (username) do nothing;
```

`intervalo_coleta_horas` só importa se você usar o cron interno (`yarn dev`). No fluxo normal (`yarn scrape` / logon), a coleta é **sob demanda**.

### Opção B — API local

```bash
yarn dev
```

Em outro terminal:

```bash
curl -X POST http://localhost:3333/profiles \
  -H "x-api-key: SUA_API_KEY" \
  -H "content-type: application/json" \
  -d "{\"username\":\"seu-username-linkedin\"}"
```

Detalhes: [api-local.md](api-local.md).

---

## 5. Validar

```bash
yarn scrape:on-logon --dry-run
```

- Se a migração não foi aplicada ou as credenciais estiverem erradas, o comando ou a coleta falham com mensagem explícita.
- No **Table Editor**, `linkedin_posts_profiles` deve listar seu username.

---

## Próximo passo

→ [coleta-local-logon.md](coleta-local-logon.md) — `yarn auth:login`, primeira coleta e automação no Windows.
