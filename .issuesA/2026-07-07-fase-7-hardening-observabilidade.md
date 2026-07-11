# Fase 7 — Hardening e observabilidade

## 1. Resumo executivo

Fechar o ciclo v1 da epic com tratamento robusto de erros, alertas claros para os cenários de falha mais críticos (expiração de sessão, mudança de layout, CAPTCHA), documentação completa (`README.md`) e revisão geral dos critérios de aceite da epic antes de considerá-la concluída.

## 2. Contexto e referências

- Epic de origem: [`.issues/epic.md`](./epic.md) — seção 9 (Critérios de aceite da epic completa) e seção 10 (Riscos e mitigações)
- Depende de todas as fases anteriores (1 a 6) estarem implementadas
- Roadmap: seção 8 do epic, Fase 7 (estimativa: 1 dia) — última fase do v1

## 3. Regras de negócio

- Todo cenário de falha crítico listado na seção 10 da epic (sessão expirada, mudança de layout, CAPTCHA, uso indevido da API) deve ter um log/alerta associado, não apenas uma falha silenciosa.
- A documentação (`README.md`) deve permitir que qualquer pessoa (inclusive o próprio Rafael, meses depois) configure o serviço do zero: login, variáveis de ambiente, cadastro de perfil, consumo da API.
- Nenhuma fase é considerada "epic completa" sem revisão explícita dos critérios de aceite da seção 9 do epic.

## 4. Critérios de aceitação

- [x] Todos os cenários de erro relevantes (sessão expirada, 0 posts extraídos, CAPTCHA, erro de conexão com MongoDB) geram log de nível apropriado (`warn`/`error`)
- [x] `README.md` documenta: pré-requisitos, `.env.example`, fluxo de login manual, cadastro de perfil, exemplos de request/response da API, deploy recomendado
- [x] Todos os itens da seção 9 do epic (`.issues/epic.md`) são revisados e marcados como atendidos ou reclassificados como evolução futura (validações ao vivo dependentes de conta real ficam registradas como pendências)
- [x] Nenhum segredo (API key, sessão do LinkedIn) é commitado no repositório — checklist de `.gitignore` revisado

## 5. Análise do código existente

Esta fase não introduz novos módulos funcionais — revisa e reforça o que foi implementado nas Fases 1 a 6 (`scraper/`, `scheduler/`, `db/`, `api/`, `shared/`).

## 6. Arquitetura proposta

Não se aplica mudança estrutural de arquitetura — o foco é observabilidade transversal (logs/alertas já usando `src/shared/logger.ts`, criado na Fase 3) e documentação. Nenhum novo diretório é criado.

## 7. Mudanças por arquivo

| Arquivo | Tipo | Descrição da mudança |
|---|---|---|
| `src/shared/logger.ts` | alterar | revisar níveis de log e formatação para cobrir todos os cenários de erro mapeados |
| `src/scraper/session.ts` | alterar | garantir alerta explícito e acionável em expiração/CAPTCHA (reforço da Fase 2) |
| `src/scraper/profileScraper.ts` | alterar | garantir alerta quando extração retorna 0 posts (reforço da Fase 3) |
| `src/scheduler/cronJobs.ts` | alterar | garantir alerta após N falhas consecutivas de um perfil (reforço da Fase 4) |
| `README.md` | alterar | documentação final completa (setup, login, cadastro de perfil, API, deploy) |
| `.gitignore` | revisar | confirmar que `storage/`, `.env` e afins estão corretamente ignorados |

## 8. Contratos e tipos

Não se aplica — esta fase não introduz novos contratos de dados, apenas reforça o uso consistente dos tipos e logger já definidos nas fases anteriores.

## 9. Impactos colaterais e dependências

- Impacta indiretamente todas as fases anteriores (revisão/reforço), mas não altera contratos externos (API) nem comportamento funcional esperado.
- Marca o encerramento do escopo v1 da epic — itens não resolvidos aqui devem migrar explicitamente para a seção 11 (Evolução futura) do epic.

## 10. Plano de execução em etapas

1. Revisar todos os pontos de falha mapeados na seção 10 do epic e confirmar que cada um gera log/alerta.
2. Escrever/atualizar o `README.md` com o fluxo completo de setup e uso.
3. Revisar `.gitignore` e configuração de segredos (`.env`, `storage/session.json`).
4. Percorrer a lista de critérios de aceite da seção 9 do epic e marcar cada item como atendido, pendente ou movido para evolução futura.

## 11. Riscos, trade-offs e alternativas consideradas

- Risco de subestimar esta fase por parecer "só documentação" — mitigado por tratá-la como gate formal de encerramento do v1, com checklist explícito (seção 9 do epic) revisado item a item.

## 12. Plano de testes

- Revisão manual: seguir o próprio `README.md` do zero (ambiente limpo) e confirmar que o setup funciona como documentado.
- Checklist final: percorrer a seção 9 do epic (`.issues/epic.md`) marcando cada critério.

## 13. Observabilidade e rollback

- Esta fase é, por definição, sobre observabilidade — entregável principal é justamente a cobertura de logs/alertas descrita acima.
- Rollback: não se aplica (fase de reforço/documentação, sem mudança de comportamento funcional).

## 14. Dúvidas em aberto

Nenhuma dúvida bloqueante nesta fase. Referenciar, se ainda não resolvida até este ponto, a **Decisão pendente #1** do epic (repositório definitivo e provedor de hospedagem), que deve constar no `README.md` final.

## 15. Aprovação

Status: implementado em 07/07/2026
