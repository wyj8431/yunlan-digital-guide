import { createApp } from './app.js';
import { readEnv } from './config/env.js';

const env = readEnv();
const app = createApp();

app.listen(env.port, () => {
  console.log(`Yunlan guide API listening on http://localhost:${env.port}`);
});
