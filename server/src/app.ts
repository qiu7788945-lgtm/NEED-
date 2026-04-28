import 'dotenv/config';
import express from 'express';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { apiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';

const app = express();

app.use(express.json());
app.use(apiRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

app.listen(env.port, () => {
  logger.info(`need-api listening on http://localhost:${env.port}`);
});

export { app };
