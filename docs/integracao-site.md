# Integrar posts no seu site

Depois que [setup-supabase.md](setup-supabase.md) e a [coleta local](coleta-local-logon.md) popularam o cache, seu **site** lê os dados — sem chamar este repositório e **sem** scrape no request do visitante.

---

## Arquitetura segura

```
Visitante (browser)
      ↓  fetch('/api/linkedin-posts')
Sua Function / API route (Vercel, Node, etc.)
      ↓  service_role (só no servidor)
Supabase → linkedin_posts_posts
      ↓
JSON → componente React / HTML
```

**Regra:** `SUPABASE_SERVICE_ROLE_KEY` **nunca** no front. Sem prefixo `VITE_` / `NEXT_PUBLIC_`.

Este repo **não** inclui o site: você adiciona a Function no projeto do portfólio (ou blog).

---

## 1. Variáveis no host do site

No painel do provedor (ex.: Vercel → **Environment Variables**):

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

Opcional (username fixo na Function):

```env
LINKEDIN_PROFILE_USERNAME=seu-username-linkedin
```

Use os **mesmos** valores do projeto Supabase configurado no CLI.

---

## 2. Endpoint sugerido

```http
GET /api/linkedin-posts?limit=3
```

Resposta `200`:

```json
{
  "profileUsername": "seu-username-linkedin",
  "posts": [
    {
      "postId": "urn:li:activity:...",
      "texto": "Conteúdo do post",
      "url": "https://www.linkedin.com/posts/...",
      "publicadoEm": "2026-07-09T12:00:00.000Z",
      "tipoMidia": "imagem",
      "midiaUrls": [],
      "reacoesCount": 0
    }
  ]
}
```

- Limite recomendado: **3–5** posts.
- Cache HTTP na Function (ex.: `Cache-Control: public, s-maxage=300`) reduz leituras no Supabase.

---

## 3. Query (PostgREST)

Equivalente SQL:

```sql
select post_id, texto, url, publicado_em, tipo_midia, midia_urls, reacoes_count
from public.linkedin_posts_posts
where profile_username = 'seu-username-linkedin'
order by publicado_em desc nulls last
limit 5;
```

Headers com service role:

```
apikey: <SUPABASE_SERVICE_ROLE_KEY>
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
```

---

## 4. Exemplo de Function (Vercel / Node)

```typescript
const PROFILE =
  process.env.LINKEDIN_PROFILE_USERNAME ?? "seu-username-linkedin";

export default async function handler(
  req: { method?: string },
  res: {
    statusCode: number;
    setHeader: (k: string, v: string) => void;
    end: (b: string) => void;
  },
) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "supabase_not_configured" }));
    return;
  }

  const qs = new URLSearchParams({
    select: "post_id,texto,url,publicado_em,tipo_midia,midia_urls,reacoes_count",
    profile_username: `eq.${PROFILE}`,
    order: "publicado_em.desc.nullslast",
    limit: "3",
  });

  const response = await fetch(`${url}/rest/v1/linkedin_posts_posts?${qs}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "linkedin_posts_unavailable" }));
    return;
  }

  const rows = (await response.json()) as Record<string, unknown>[];
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      profileUsername: PROFILE,
      posts: rows.map((p) => ({
        postId: p.post_id,
        texto: p.texto,
        url: p.url,
        publicadoEm: p.publicado_em,
        tipoMidia: p.tipo_midia,
        midiaUrls: p.midia_urls,
        reacoesCount: p.reacoes_count,
      })),
    }),
  );
}
```

No front (React, etc.):

```typescript
const res = await fetch("/api/linkedin-posts");
const { posts } = await res.json();
```

Trate **lista vazia** ou erro com link para o perfil no LinkedIn — o visitante não deve ver stack trace.

---

## 5. RLS e privacidade

A migração padrão **não** expõe leitura anônima. Só quem tem `service_role` no servidor lê `linkedin_posts_posts`. A tabela `linkedin_posts_profiles` não precisa ser exposta ao site.

---

## Checklist

- [ ] Pelo menos uma coleta com sucesso (`yarn scrape ...`)
- [ ] Env vars no host do site (sem prefixo público)
- [ ] Function deployada e retornando JSON
- [ ] UI com fallback se cache vazio ou API indisponível
- [ ] Nenhum scrape disparado pelo visitante

---

## Referência

Implementação de exemplo no portfólio do autor: repositório `RafaelHDSV/Portifolio` (`api/linkedin-posts.ts`, hook `useLinkedInPosts`).
