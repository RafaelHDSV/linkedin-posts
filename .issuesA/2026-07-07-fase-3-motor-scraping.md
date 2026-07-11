# Fase 3 — Motor de scraping

## 1. Resumo executivo

Implementar o `profileScraper`: navegação até a página de atividade de um perfil público do LinkedIn (usando a sessão autenticada da Fase 2) e extração dos posts recentes, normalizados em `PostDTO` pelo `postParser`.

## 2. Contexto e referências

- Epic de origem: [`.issues/epic.md`](./epic.md) — seção 5.3 (Motor de scraping)
- Depende da Fase 2 (sessão autenticada) e dos modelos/tipos da Fase 1
- Roadmap: seção 8 do epic, Fase 3 (estimativa: 2-3 dias) — maior estimativa entre as fases, por envolver extração de DOM sujeita a variações de layout

## 3. Regras de negócio

- O scraper opera apenas sobre perfis **públicos** informados via username/URL (decisão #1 da epic — multi-perfil).
- Extração mínima esperada: pelo menos os 5 posts mais recentes de um perfil válido.
- Campos extraídos por post: texto, link/URL, data de publicação, tipo de mídia, contador de reações (quando visível na página).
- O motor de scraping **não** persiste dados diretamente — apenas retorna uma lista de `PostDTO`; a persistência (upsert no MongoDB por `postId`) é responsabilidade do orquestrador da Fase 4 (scheduler), mantendo a separação de responsabilidades definida na arquitetura da epic.
- Regras anti-bloqueio (compartilhadas com a Fase 4): delays aleatórios entre ações, user-agent realista, backoff exponencial em erro/CAPTCHA.

## 4. Critérios de aceitação

- [x] Para um perfil público válido, o scraper retorna ao menos os 5 posts mais recentes normalizados (lógica pronta; validação de volume real depende de conta ao vivo)
- [x] Extração tolera scroll incremental (lazy-load) sem perder posts
- [x] Falhas de extração (0 posts, erro de navegação, CAPTCHA) são tratadas e logadas, sem derrubar o processo
- [x] `postParser` produz `PostDTO` válido conforme o contrato definido na Fase 1
- [ ] Testado contra pelo menos 2 perfis públicos reais com layouts/conteúdos diferentes (validação ao vivo — pendente de conta real; coberto por testes de fixture)

## 5. Análise do código existente

Reutiliza `src/scraper/browser.ts` e `session.ensureValidSession()` da Fase 2, e os tipos `PostDTO` da Fase 1. Nenhum motor de scraping preexistente no repositório — implementação nova, isolada em `profileScraper.ts` e `postParser.ts` conforme a árvore de diretórios da epic (seção 4).

## 6. Arquitetura proposta

```
src/scraper/
├── browser.ts         # (Fase 2) contexto autenticado
├── session.ts          # (Fase 2) validação de sessão
├── profileScraper.ts   # NOVO: navega e extrai posts de um perfil
└── postParser.ts       # NOVO: normaliza DOM/HTML em PostDTO
```

Fluxo:

```
profileScraper.scrape(username)
  → session.ensureValidSession()
  → browser.newContext(storageState)
  → page.goto(`https://www.linkedin.com/in/${username}/recent-activity/all/`)
  → scroll incremental até carregar N posts
  → para cada post no DOM → postParser.normalize(elementoDom) → PostDTO
  → retorna PostDTO[]
```

## 7. Mudanças por arquivo

| Arquivo | Tipo | Descrição da mudança |
|---|---|---|
| `src/scraper/profileScraper.ts` | criar | navegação, scroll incremental e extração dos posts de um perfil |
| `src/scraper/postParser.ts` | criar | normalização de cada elemento de post em `PostDTO` |
| `src/shared/retry.ts` | criar | utilitário de retry/backoff exponencial (mecanismo compartilhado, usado aqui e na Fase 4) |
| `src/shared/logger.ts` | criar | logger estruturado compartilhado (usado por scraper e, depois, scheduler/API) |
| `tests/profileScraper.spec.ts` | criar | testes contra fixtures de HTML/DOM salvos de perfis reais |

## 8. Contratos e tipos

```typescript
interface ScrapeResult {
  username: string;
  posts: PostDTO[];
  erro?: "sessao_invalida" | "perfil_nao_encontrado" | "captcha_detectado" | "erro_desconhecido";
}

function scrapeProfile(username: string, limite?: number): Promise<ScrapeResult>;
function normalizePost(domElement: unknown): PostDTO;
```

## 9. Impactos colaterais e dependências

- Depende diretamente da sessão válida gerada na Fase 2 — se a sessão expira, o scraping falha de forma controlada (não é um bug desta fase).
- Alimenta diretamente a Fase 4 (scheduler), que chamará `scrapeProfile()` periodicamente e persistirá (upsert) o `PostDTO[]` retornado usando o modelo `Post` da Fase 1.
- Sensível a mudanças de layout do LinkedIn — ver riscos na seção 10 do epic.

## 10. Plano de execução em etapas

1. Implementar navegação básica até a página de atividade de um perfil (sem extração ainda) e validar carregamento com sessão autenticada.
2. Implementar scroll incremental para carregar os N posts desejados.
3. Implementar `postParser.normalize()` para extrair texto, link, data, mídia e reações de cada post.
4. Adicionar tratamento de erros (perfil não encontrado, CAPTCHA, sessão inválida) e regras anti-bloqueio (delays, backoff).
5. Testar contra perfis reais e ajustar seletores conforme variações de layout encontradas.

## 11. Riscos, trade-offs e alternativas consideradas

- **Seletores DOM diretos vs parsing do JSON interno da página (quando disponível):** iniciar com seletores DOM por simplicidade; se o LinkedIn expuser dados estruturados internamente (ex.: `<script type="application/ld+json">` ou estado embutido), avaliar migração futura para reduzir fragilidade — não faz parte do escopo desta fase.
- Principal risco herdado da epic (seção 10): mudança de layout quebra o parser — mitigado por isolar toda lógica de extração em `postParser.ts` e por alertas quando a extração retorna 0 posts.

## 12. Plano de testes

- Testes automatizados com fixtures de HTML salvos localmente (sem depender de acesso ao LinkedIn em CI).
- Teste manual/E2E contra perfis reais em ambiente de desenvolvimento, validando ao menos 5 posts extraídos corretamente.
- Teste de resiliência: simular ausência de campos opcionais (ex.: post sem mídia, sem contador de reações) e confirmar que `postParser` não quebra.

## 13. Observabilidade e rollback

- Log estruturado por execução: perfil, quantidade de posts extraídos, duração, erros encontrados.
- Alerta quando a extração retorna 0 posts para um perfil historicamente ativo (possível indício de mudança de layout ou bloqueio).
- Rollback: motor de scraping é stateless por execução — reverter é apenas não chamar `scrapeProfile()` (ex.: desativar perfil via `ativo: false`, criado na Fase 1).

## 14. Dúvidas em aberto

Nenhuma dúvida bloqueante — escopo e regras já definidos na epic (seção 5.3).

## 15. Aprovação

Status: implementado em 07/07/2026 (parser coberto por testes de fixture; validação ao vivo contra perfis reais pendente de conta dedicada)
