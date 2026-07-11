# Política de segurança

## Como reportar uma vulnerabilidade

Se você encontrou uma vulnerabilidade em **linkedin-posts**:

- **Não** abra uma issue pública.
- Entre em contato direto com o mantenedor (e-mail ou DM privada no GitHub/LinkedIn do autor do repositório).
- Inclua passos para reproduzir, impacto estimado e, se possível, uma sugestão de correção.

A resposta inicial ocorre em até 7 dias úteis. Após a correção, você pode ser creditado se desejar.

## Versões suportadas

Apenas a versão mais recente da branch principal recebe correções de segurança.

## Boas práticas ao usar o projeto

- Nunca commite secrets (`.env`, tokens, `storage/session.json`, chaves privadas).
- Não exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Use conta LinkedIn **secundária** para o scrape.
- Mantenha dependências atualizadas (`yarn outdated` / PRs de Dependabot, se habilitado).
- Trate este software como ferramenta pessoal/avançada: scraping pode violar os Termos do LinkedIn.
