# Contribuindo

Obrigado pelo interesse em contribuir com **linkedin-posts**.

## Antes de começar

1. Leia o [README](README.md) e o aviso sobre os Termos de Uso do LinkedIn.
2. Rode o setup local ([docs/setup-supabase.md](docs/setup-supabase.md)) e confirme `yarn build` / `yarn test`.
3. Abra uma **issue** descrevendo o problema ou a melhoria (evita PR sem alinhamento).

## Fluxo

1. Fork do repositório e branch descritiva:
   ```bash
   git checkout -b feat/sua-feature
   ```
2. Implemente seguindo os padrões do código existente (`src/cli`, `src/scraper`, `src/db`).
3. Garanta:
   ```bash
   yarn typecheck
   yarn test
   yarn build
   ```
4. Abra um Pull Request com: problema, solução e como testar.
5. Não inclua `.env`, `storage/session.json`, tokens nem dados reais de sessão.

## Padrões

- Mensagens de commit objetivas (português ou inglês).
- Documentação e textos de produto em **pt-BR com acentos**.
- Preferir legibilidade a “astúcia”; reutilizar collector/parser existentes.
- PRs pequenos quando possível.
- Mudanças que aumentem agressividade do scrape (concorrência alta, intervalos curtos) precisam de justificativa explícita — o projeto prioriza reduzir risco de bloqueio.

## Escopo

Contribuições bem-vindas: parser, docs, scripts multiplataforma (macOS/Linux), testes, DX do CLI.  
Fora do foco: contornar CAPTCHA/anti-bot, login automático com senha, scraping em massa.

## Código de conduta

Veja [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Trate todos com respeito.
