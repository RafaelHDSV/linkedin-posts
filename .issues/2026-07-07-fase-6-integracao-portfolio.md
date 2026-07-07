# Fase 6 — Integração com o portfólio

## 1. Resumo executivo

Validar o caso de uso original da epic: consumir a API de posts (Fase 5) a partir do portfólio pessoal, exibindo uma seção "posts recentes" com dados reais do LinkedIn, atualizada automaticamente conforme o scheduler coleta novos posts.

## 2. Contexto e referências

- Epic de origem: [`.issues/epic.md`](./epic.md) — seção 5.7 (Integração com o portfólio)
- Depende da Fase 5 (API REST) estar disponível e populada por pelo menos um ciclo do scheduler (Fase 4)
- Roadmap: seção 8 do epic, Fase 6 (estimativa: 1 dia)
- Repositório afetado: portfólio pessoal (fora do `linkedin-posts-api`) — a identificar/confirmar caminho do repositório do portfólio antes da implementação

## 3. Regras de negócio

- O portfólio consome a API via `GET /profiles/rafael-vieira1720/posts?limit=3` (ou quantidade equivalente definida pelo design da seção).
- A seção deve refletir novos posts automaticamente conforme o cache é atualizado pelo scheduler — sem necessidade de redeploy do portfólio a cada novo post.
- Cada post exibido deve linkar para a publicação original no LinkedIn (`PostDTO.url`).
- Falha na chamada à API (indisponibilidade, timeout) não pode quebrar a renderização do portfólio — deve haver um estado de fallback/vazio tratado no frontend.

## 4. Critérios de aceitação

- [ ] Seção "posts recentes" do portfólio exibe os 3 posts mais recentes reais vindos da API
- [ ] Cada post exibido linka corretamente para a publicação original no LinkedIn
- [ ] Novo post coletado pelo scheduler aparece na seção sem necessidade de redeploy do portfólio
- [ ] Falha/indisponibilidade da API é tratada com um estado de fallback (ex.: seção oculta ou mensagem neutra), sem quebrar o restante da página

## 5. Análise do código existente

**Pendente de confirmação:** qual repositório e stack o portfólio pessoal já usa (ex.: Next.js, Vite/React) para definir se o consumo será client-side (`fetch` em componente) ou server-side (SSR/SSG com revalidação). Ver Dúvidas em aberto (seção 14).

## 6. Arquitetura proposta

```
Portfolio (frontend)
  → fetch(`${LINKEDIN_POSTS_API_URL}/profiles/rafael-vieira1720/posts?limit=3`, { headers: { "x-api-key": ... } })
  → renderiza lista de cards de posts (texto resumido, data, link para o LinkedIn)
  → em caso de erro/timeout: renderiza estado de fallback (nenhuma quebra de página)
```

Se o portfólio for renderizado estaticamente (SSG), recomenda-se revalidação periódica (ex.: `revalidate` do Next.js) alinhada ao intervalo de coleta do scheduler, para refletir novos posts sem exigir chamada em toda requisição.

## 7. Mudanças por arquivo

| Arquivo | Tipo | Descrição da mudança |
|---|---|---|
| `<repo-portfolio>/.env` ou equivalente | alterar | adicionar `LINKEDIN_POSTS_API_URL` e `LINKEDIN_POSTS_API_KEY` |
| `<repo-portfolio>/src/services/linkedinPosts.ts` (ou equivalente) | criar | client HTTP para consumir a API de posts |
| `<repo-portfolio>/src/components/RecentPosts/` (ou equivalente) | criar | componente de UI da seção "posts recentes" |
| Página/seção principal do portfólio | alterar | incluir o novo componente na página inicial |

*Caminhos exatos dependem da estrutura real do repositório do portfólio, a confirmar antes da implementação (ver seção 14).*

## 8. Contratos e tipos

```typescript
interface RecentPost {
  postId: string;
  texto: string;
  url: string;
  publicadoEm: string;
  tipoMidia: string;
}

async function fetchRecentPosts(limit = 3): Promise<RecentPost[]>;
```

## 9. Impactos colaterais e dependências

- Depende de a API (Fase 5) estar publicada e acessível a partir do ambiente onde o portfólio roda (rede/CORS, se aplicável).
- Depende de a `API_KEY` do serviço estar disponível como variável de ambiente segura no ambiente de build/deploy do portfólio (não deve ser exposta no bundle client-side sem cuidado — avaliar proxy server-side se o portfólio for client-side puro).
- Introduz uma dependência externa em tempo de build/runtime do portfólio, que antes não existia.

## 10. Plano de execução em etapas

1. Confirmar stack e estrutura do repositório do portfólio (ver dúvida aberta).
2. Implementar o client HTTP de consumo da API (`fetchRecentPosts`).
3. Implementar o componente de UI da seção "posts recentes", com estado de loading/erro.
4. Integrar o componente na página principal do portfólio e validar visualmente com dados reais.

## 11. Riscos, trade-offs e alternativas consideradas

- **Consumo client-side direto vs proxy server-side:** se o portfólio expõe a chamada diretamente do navegador, a `API_KEY` ficaria exposta publicamente; recomenda-se proxy server-side (rota interna do próprio portfólio) que injeta a API key no backend, mantendo-a fora do bundle do cliente.
- Falha da API não pode ser um ponto único de quebra do portfólio — mitigado pelo estado de fallback exigido no critério de aceitação.

## 12. Plano de testes

- Teste manual: validar renderização da seção com a API real, incluindo estado de loading.
- Teste de fallback: simular API indisponível (ex.: apontar para URL inválida) e confirmar que o portfólio continua funcional.
- Teste visual (screenshot) comparando a seção antes/depois da integração.

## 13. Observabilidade e rollback

- Log (client-side ou server-side, conforme a stack do portfólio) de falhas na chamada à API de posts.
- Rollback simples: remover/ocultar o componente da seção sem afetar o restante do portfólio, já que é um módulo isolado.

## 14. Dúvidas em aberto

1. **Repositório e stack do portfólio:** qual é o repositório do portfólio pessoal e sua stack atual (Next.js, Vite/React, outro)? Isso define se a integração será SSR/SSG com revalidação ou client-side com proxy. Sem essa informação, os caminhos de arquivo na seção 7 ficam genéricos.
2. **Exposição da API key:** o portfólio já possui algum mecanismo de rota server-side (ex.: API routes do Next.js) para atuar como proxy, evitando expor a `API_KEY` no cliente?

## 15. Aprovação

Status: aguardando aprovação
