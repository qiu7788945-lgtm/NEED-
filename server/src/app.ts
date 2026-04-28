import 'dotenv/config';
import express from 'express';
import { healthRouter } from './routes/health.routes.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());
app.use('/api/health', healthRouter);

app.listen(port, () => {
  console.log(`need-api listening on http://localhost:${port}`);
});

export { app };
