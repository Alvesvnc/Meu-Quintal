import 'dotenv/config';
import { parseEnv } from './envSchema.js';

export { parseEnv } from './envSchema.js';
export type { Env } from './envSchema.js';

const parsed = parseEnv(process.env);
if (!parsed.success) {
  // Sem logger ainda — o server nem subiu. console.error e o canal certo aqui.
  console.error('');
  console.error('Configuracao invalida. O server nao vai subir:');
  console.error('');
  for (const [campo, erros] of Object.entries(parsed.error.flatten().fieldErrors)) {
    for (const erro of erros ?? []) {
      console.error(`  ${campo}: ${erro}`);
    }
  }
  console.error('');
  console.error('Veja server/.env.example para a lista completa.');
  console.error('');
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
