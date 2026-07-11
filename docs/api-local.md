# API REST local (opcional)

A API Fastify (`yarn dev`) roda em **`http://localhost:3333`** e serve para **desenvolvimento e debug**. No fluxo recomendado (scrap local → Supabase → Function no site), **você não precisa** expor esta API na internet nem usá-la em produção.

**Quando vale a pena:**

- Cadastrar perfil sem abrir o SQL Editor ([alternativa ao setup §4](setup-supabase.md#4-cadastrar-o-perfil)).
- Inspecionar o cache com `curl` antes de integrar o front.
- Testar o contrato JSON que espelha o que está no Supabase.

**Quando pular:** se você já cadastrou o perfil via SQL e só usa `yarn scrape` + [integracao-site.md](integracao-site.md).

---

## Subir a API

```bash
yarn dev
```

Requer no `.env`: `SUPABASE_*`, `API_KEY` e `PORT` (padrão `3333`).

Autenticação: header `x-api-key: <API_KEY>` em todas as rotas de dados.  
`GET /health` é público.

---

## Endpoints

### Saúde

```bash
curl http://localhost:3333/health
```

### Cadastrar perfil

```bash
curl -X POST http://localhost:3333/profiles \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  -d '{"username":"seu-username-linkedin"}'
```

Body opcional: `intervaloColetaHoras` (número).

### Listar perfis

```bash
curl http://localhost:3333/profiles -H "x-api-key: $API_KEY"
```

### Posts em cache

```bash
curl "http://localhost:3333/profiles/seu-username-linkedin/posts?limit=5" \
  -H "x-api-key: $API_KEY"
```

---

## Cron interno

Com `yarn dev`, um `node-cron` pode coletar perfis ativos periodicamente (`intervalo_coleta_horas`). Isso é **independente** do Agendador de Tarefas do Windows.

Para uso típico (poucos posts), ignore o cron e use:

- `yarn scrape <username>` — manual
- `yarn scrape:on-logon` — no logon ([coleta-local-logon.md](coleta-local-logon.md))

---

## Produção

Para o site público, leia o Supabase direto na Function do **seu** projeto ([integracao-site.md](integracao-site.md)). Não hospede esta API Fastify só para servir posts ao portfólio.

Deploy deste repo na Vercel (legado): [alternativa-vercel.md](alternativa-vercel.md).
