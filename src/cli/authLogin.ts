import { loginInterativo } from "../scraper/session.js";
import { logger } from "../shared/logger.js";

loginInterativo()
  .then(() => {
    logger.info("Login concluido. Sessao pronta para as coletas.");
    process.exit(0);
  })
  .catch((erro) => {
    logger.error({ erro }, "Falha no login interativo");
    process.exit(1);
  });
