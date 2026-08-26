import { describe, it, expect } from 'vitest';
import { parseEnv } from './envSchema.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@db:5432/meu_quintal',
  JWT_SECRET: 'a'.repeat(48),
  CORS_ORIGINS: 'https://app.meuquintal.com.br',
};

/** Erros achatados por campo, pra assertar sem depender da mensagem exata. */
const camposComErro = (r: ReturnType<typeof parseEnv>) =>
  r.success ? [] : Object.keys(r.error.flatten().fieldErrors);

describe('env — desenvolvimento', () => {
  it('aceita os defaults de dev', () => {
    const r = parseEnv({ ...base, NODE_ENV: 'development', JWT_SECRET: 'x'.repeat(16) });
    expect(r.success).toBe(true);
  });

  it('deixa CORS apontar pra localhost fora de producao', () => {
    const r = parseEnv({
      ...base,
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:5173,http://localhost:5174',
    });
    expect(r.success).toBe(true);
  });

  it('preenche os defaults documentados', () => {
    const r = parseEnv({ ...base, NODE_ENV: 'development' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.PORT).toBe(3001);
    expect(r.data.HOST).toBe('0.0.0.0');
    expect(r.data.RATE_LIMIT_MAX).toBe(300);
    expect(r.data.BODY_LIMIT).toBe(262144);
    expect(r.data.TRUST_PROXY).toBe(false);
  });

  it('TRUST_PROXY so liga com "true" ou "1"', () => {
    for (const [valor, esperado] of [
      ['true', true],
      ['1', true],
      ['false', false],
      ['sim', false],
      ['yes', false],
      ['', false],
    ] as const) {
      const r = parseEnv({ ...base, NODE_ENV: 'development', TRUST_PROXY: valor });
      expect(r.success && r.data.TRUST_PROXY, `TRUST_PROXY="${valor}"`).toBe(esperado);
    }
  });
});

describe('env — sempre obrigatorio', () => {
  it('recusa sem DATABASE_URL', () => {
    const { DATABASE_URL: _, ...semDb } = base;
    expect(camposComErro(parseEnv(semDb))).toContain('DATABASE_URL');
  });

  it('recusa DATABASE_URL que nao e url', () => {
    expect(camposComErro(parseEnv({ ...base, DATABASE_URL: 'nao-e-url' }))).toContain(
      'DATABASE_URL',
    );
  });

  it('recusa sem JWT_SECRET', () => {
    const { JWT_SECRET: _, ...semJwt } = base;
    expect(camposComErro(parseEnv(semJwt))).toContain('JWT_SECRET');
  });

  it('recusa PORT fora da faixa', () => {
    expect(camposComErro(parseEnv({ ...base, PORT: '70000' }))).toContain('PORT');
    expect(camposComErro(parseEnv({ ...base, PORT: '0' }))).toContain('PORT');
  });
});

// ── O ponto alto: estas travas existem pra impedir deploy inseguro ──────────
describe('env — travas de producao', () => {
  const prod = { ...base, NODE_ENV: 'production' };

  it('aceita configuracao de producao correta', () => {
    expect(parseEnv(prod).success).toBe(true);
  });

  it('recusa JWT_SECRET com valor de exemplo', () => {
    for (const fraco of ['trocar-em-producao', 'changeme', 'dev-secret', 'secret']) {
      const r = parseEnv({ ...prod, JWT_SECRET: fraco });
      expect(r.success, `deveria recusar "${fraco}"`).toBe(false);
      expect(camposComErro(r)).toContain('JWT_SECRET');
    }
  });

  it('recusa JWT_SECRET curto mesmo passando dos 16 chars do dev', () => {
    const r = parseEnv({ ...prod, JWT_SECRET: 'a'.repeat(20) });
    expect(r.success).toBe(false);
    expect(camposComErro(r)).toContain('JWT_SECRET');
  });

  it('recusa CORS com curinga — "*" com credentials e invalido e inseguro', () => {
    expect(camposComErro(parseEnv({ ...prod, CORS_ORIGINS: '*' }))).toContain('CORS_ORIGINS');
  });

  it('recusa CORS apontando pra localhost', () => {
    for (const origem of [
      'https://app.ok.com.br,http://localhost:5173',
      'https://127.0.0.1',
      'https://0.0.0.0:3000',
    ]) {
      const r = parseEnv({ ...prod, CORS_ORIGINS: origem });
      expect(r.success, `deveria recusar "${origem}"`).toBe(false);
    }
  });

  it('recusa CORS sem https', () => {
    const r = parseEnv({ ...prod, CORS_ORIGINS: 'http://app.meuquintal.com.br' });
    expect(r.success).toBe(false);
    expect(camposComErro(r)).toContain('CORS_ORIGINS');
  });

  it('acumula todos os problemas de uma vez, nao um por deploy', () => {
    const r = parseEnv({
      ...prod,
      JWT_SECRET: 'trocar-em-producao',
      CORS_ORIGINS: 'http://localhost:5173',
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const campos = r.error.flatten().fieldErrors;
    expect(campos.JWT_SECRET?.length).toBeGreaterThanOrEqual(2);
    expect(campos.CORS_ORIGINS?.length).toBeGreaterThanOrEqual(2);
  });
});
