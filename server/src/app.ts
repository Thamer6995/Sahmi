import express, { Express } from 'express';
import cors from 'cors';
import { FRONTEND_ORIGIN } from './config/env';
import { apiRouter } from './routes/api';
import { internalRouter } from './routes/internal';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: FRONTEND_ORIGIN() }));
  app.use(express.json());

  app.get('/', (_req, res) => res.json({ ok: true, service: 'sahmi-server' }));

  app.use('/api', apiRouter);
  app.use('/internal', internalRouter);

  app.use(errorHandler);

  return app;
}
