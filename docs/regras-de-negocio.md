# Regras de negócio

> **Para que serve:** algoritmos e regras do domínio que a IA não deve reinventar
> **Fonte da verdade:** módulos de domínio no código
> **Relacionados:** [especificacao](especificacao.md) · [api](api.md) · [banco-de-dados](banco-de-dados.md)

## Regras

1. Login LinkedIn **manual** (sem relogin automático para 2FA/CAPTCHA).
2. **Sem deploy** deste repo no caminho feliz.
3. Um perfil por automação de logon (`SCRAPE_USERNAME`).
4. Service role **nunca** no browser.
5. Conta LinkedIn secundária; scraping viola ToS — risco assumido pelo usuário.
6. **Frescor da coleta:** após o upsert, se `max(publicado_em)` do lote for mais antigo que **agora − N dias** (`SCRAPE_STALE_AFTER_DAYS`, default **8**), a coleta é **erro** (`cache_stale`): log ALERTA, `registrarColetaFalha`, sem `registrarColetaSucesso`. Lote vazio ou sem datas válidas também conta como stale. Posts sem URL utilizável (`feed/update` ou `lnkd.in`) são descartados antes do upsert.
