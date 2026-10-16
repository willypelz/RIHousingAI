import dotenv from 'dotenv';
dotenv.config();
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';

const port = Number(process.env.PORT || 4000);

migrate().then(() => {
  createApp().listen(port, () => console.log(`RIHousingAI API listening on http://localhost:${port}`));
}).catch(e => { console.error('Startup failed:', e); process.exit(1); });
