# Fase 4 — Scheduler, persistência e anti-bloqueio

## 1. Resumo executivo

Implementar o agendador (`cron`) que dispara o `profileScraper` para cada perfil ativo em intervalos configuráveis, persiste os posts coletados no MongoDB (upsert deduplicado por `postId`) e aplica as regras de proteção contra bloqueio da conta do LinkedIn (throttling, backoff exponencial).

## 2. Contexto e referências

- Epic de origem: [`.issues/epic.md`](./epic.md) — seções 5.4 (Scheduler) e 5.5 (Persistência)
- Depende da Fase 1 (modelos `Profile`/`Post`) e da Fase 3 (`profileScraper`)
- Roadmap: seção 8 do epic, Fase 4 (estimativa: 1-2 dias)

## 3. Regras de negócio

- Cada perfil ativo (`ativo: true`) é coletado no máximo uma vez por `intervaloColetaHoras` (campo do modelo `Profile`, Fase 1).
- Falha na coleta de um perfil **não** interrompe a coleta dos demais perfis agendados.
- Persistência de posts é feita por **upsert** usando `postId` como chave — o mesmo post coletado mais de uma vez não gera duplicata; campos como texto/reações são atualizados se tiverem mudado.
- Após cada execução (sucesso ou erro), o campo `ultimaColetaEm` e `ultimoStatus` do `Profile` são atualizados.
- Regras anti-bloqueio: delays aleatórios entre ações do navegador, limite de concorrência (`SCRAPE_CONCURRENCY`), backoff exponencial após erro/CAPTCHA antes de tentar novamente o mesmo perfil.

## 4. Critérios de aceitação

- [x] Nenhum perfil é coletado mais de uma vez por intervalo configurado (`intervaloColetaHoras`)
- [x] Falha em um perfil não bloqueia a coleta dos demais perfis da fila
- [x] Rodar a coleta duas vezes seguidas para o mesmo perfil não gera posts duplicados no MongoDB
- [x] `ultimaColetaEm` e `ultimoStatus` do `Profile` são atualizados a cada execução
- [x] Backoff exponencial é aplicado após falha/CAPTCHA antes de nova tentativa no mesmo perfil

## 5. Análise do código existente

Reutiliza `profileScraper.scrape()` (Fase 3), os modelos `Profile`/`Post` e a conexão MongoDB (Fase 1), além do `retry.ts` e `logger.ts` compartilhados criados na Fase 3.

## 6. Arquitetura proposta

```
src/scheduler/
└── cronJobs.ts   # agenda coletas periódicas por perfil e persiste resultados
```

Fluxo:

```
cronJobs (node-cron, a cada ciclo configurado)
  → busca perfis ativos com coleta vencida (agora - ultimaColetaEm >= intervaloColetaHoras)
  → para cada perfil (respeitando SCRAPE_CONCURRENCY):
      → profileScraper.scrape(username)
      → se sucesso: Post.bulkWrite (upsert por postId)
                    Profile.update({ ultimaColetaEm: agora, ultimoStatus: "sucesso" })
      → se erro: retry.comBackoff() até limite; se persistir, Profile.update({ ultimoStatus: "erro" }) + log de alerta
```

## 7. Mudanças por arquivo

| Arquivo | Tipo | Descrição da mudança |
|---|---|---|
| `src/scheduler/cronJobs.ts` | criar | agendamento (`node-cron`), fila de coleta, chamada ao scraper e upsert no MongoDB |
| `src/db/models/Post.ts` | alterar | adicionar método/helper de upsert em lote por `postId` (se necessário) |
| `src/shared/retry.ts` | alterar | ajustar backoff exponencial reutilizado aqui (criado como esqueleto na Fase 3) |
| `.env.example` | alterar | confirmar/documentar `SCRAPE_INTERVAL_HOURS` e `SCRAPE_CONCURRENCY` já previstos na Fase 1 |
| `src/index.ts` | alterar | inicializar o `cronJobs` junto ao bootstrap do serviço |

## 8. Contratos e tipos

```typescript
interface ColetaResultado {
  username: string;
  status: "sucesso" | "erro";
  postsColetados: number;
  erro?: string;
}

function agendarColetas(): void; // registra o cron interno
function executarColeta(username: string): Promise<ColetaResultado>;
function upsertPosts(username: string, posts: PostDTO[]): Promise<void>;
```

## 9. Impactos colaterais e dependências

- Depende da sessão autenticada (Fase 2) estar válida — falhas de sessão se propagam como `ColetaResultado.status = "erro"`.
- É o único componente que grava em `posts` no MongoDB — a API (Fase 5) apenas lê o que este componente persiste, reforçando a decisão #3 da epic (API nunca dispara scraping).
- Concorrência (`SCRAPE_CONCURRENCY`) impacta diretamente o risco de bloqueio da conta — valores mais altos aumentam o risco.

## 10. Plano de execução em etapas

1. Implementar a consulta de perfis com coleta vencida (`Profile.find` com filtro por `intervaloColetaHoras`).
2. Implementar o laço de execução com limite de concorrência, chamando `profileScraper.scrape()`.
3. Implementar `upsertPosts()` com `bulkWrite`/upsert por `postId`.
4. Implementar backoff exponencial e atualização de `ultimoStatus`/`ultimaColetaEm`.
5. Registrar o `cronJobs` na inicialização do serviço (`src/index.ts`).

## 11. Riscos, trade-offs e alternativas consideradas

- **Cron interno (node-cron) vs orquestrador externo (ex.: GitHub Actions, worker separado):** optou-se pelo cron interno ao processo por simplicidade operacional (decisão #3 da epic); um orquestrador externo foi considerado, mas adiciona complexidade de infraestrutura sem benefício claro no volume esperado de perfis monitorados.
- Principal risco herdado da epic (seção 10): bloqueio da conta do LinkedIn por excesso de coletas — mitigado por `SCRAPE_CONCURRENCY` baixo por padrão e backoff exponencial.

## 12. Plano de testes

- Teste de integração: cadastrar 2+ perfis com intervalos diferentes e validar que cada um é coletado apenas quando vencido.
- Teste de idempotência: rodar a mesma coleta duas vezes seguidas e confirmar ausência de posts duplicados.
- Teste de isolamento de falhas: simular erro em um perfil e confirmar que os demais perfis da fila continuam sendo processados.

## 13. Observabilidade e rollback

- Log por ciclo de cron: quantidade de perfis processados, sucesso/erro por perfil, tempo total do ciclo.
- Alerta quando um perfil acumula N falhas consecutivas (possível sessão expirada ou bloqueio).
- Rollback: desativar o cron (`ativo: false` nos perfis ou flag global) não afeta dados já persistidos; reprocessamento é idempotente graças ao upsert por `postId`.

## 14. Dúvidas em aberto

Nenhuma dúvida bloqueante — regras já definidas na epic (seções 5.4 e 5.5).

## 15. Aprovação

Status: implementado em 07/07/2026
