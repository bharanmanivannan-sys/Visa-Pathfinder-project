import app from "./app";
import { logger } from "./lib/logger";
import { ensureGuidanceCatalog } from "./lib/guidance-catalog";
import { ensureVisaResourceCatalog } from "./lib/visa-resource-catalog";
import { startVisaResourceMonitor } from "./lib/visa-source-monitor";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  await ensureGuidanceCatalog();
  await ensureVisaResourceCatalog();
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startVisaResourceMonitor();
  });
}

start().catch((err: unknown) => {
  logger.error({ err }, "Unable to initialize guidance catalog");
  process.exit(1);
});
