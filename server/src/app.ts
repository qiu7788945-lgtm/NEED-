import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { apiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';

const app = express();
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(serverRoot, '..');

app.use(cors());
app.use(express.json());
app.use('/uploads/images', express.static(path.join(serverRoot, 'uploads', 'images')));
app.use('/uploads/videos', express.static(path.join(serverRoot, 'uploads', 'videos')));
app.use(express.static(path.join(projectRoot, 'public')));
app.use(apiRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

app.listen(env.port, () => {
  logger.info(`need-api listening on http://localhost:${env.port}`);
});

export { app };
