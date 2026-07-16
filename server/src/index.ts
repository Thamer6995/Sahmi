import { initFirebaseAdmin } from './config/firebaseAdmin';
import { createApp } from './app';
import { PORT } from './config/env';
import { logger } from './utils/logger';

initFirebaseAdmin();

const app = createApp();

app.listen(PORT, () => {
  logger.info('server_started', { port: PORT });
});
