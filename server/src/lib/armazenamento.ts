import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from './env.js';

/**
 * Onde os arquivos enviados ficam.
 *
 * HOJE É DISCO LOCAL, num volume. É o que funciona sem nenhuma conta em
 * provedor nenhum — e provedor de banco ainda nem foi escolhido (ver
 * `pendencias.txt`). As três funções abaixo são toda a superfície: trocar por
 * S3/R2 é reescrever este arquivo, não caçar `fs` espalhado pelo servidor.
 *
 * ─── O LIMITE, PRA NINGUÉM DESCOBRIR EM PRODUÇÃO ────────────────────────────
 *
 * Disco local NÃO sobrevive a mais de uma réplica do servidor: a foto enviada
 * na réplica A não existe na B, e o cardápio fica com buraco em metade dos
 * acessos. Enquanto for um container só, funciona. Antes de escalar
 * horizontalmente, isto vira objeto (S3/R2) — está anotado.
 *
 * Também não sobrevive a container efêmero sem volume: subir sem montar o
 * `UPLOADS_DIR` apaga o cardápio inteiro no primeiro deploy.
 */

/** Só hex e um ponto. É o que impede `../../etc/passwd` chegar no `join`. */
const CHAVE_VALIDA = /^[a-f0-9]{32}\.[a-z0-9]{2,5}$/;

function raiz(): string {
  return path.resolve(env.UPLOADS_DIR);
}

/**
 * Nome de arquivo aleatório, nunca o que veio no upload.
 *
 * O nome enviado é texto controlado por quem envia: `../`, nome de arquivo já
 * existente, caractere que o sistema de arquivos interpreta. Nada disso precisa
 * ser tratado se ele simplesmente não for usado.
 */
function novaChave(extensao: string): string {
  return `${crypto.randomBytes(16).toString('hex')}.${extensao}`;
}

/** Cria a pasta uma vez, no boot. Falhar aqui é melhor que no primeiro upload. */
export async function prepararArmazenamento(): Promise<void> {
  await fs.mkdir(raiz(), { recursive: true });
}

export async function guardar(data: Buffer, extensao: string): Promise<string> {
  const chave = novaChave(extensao);
  await fs.mkdir(raiz(), { recursive: true });
  await fs.writeFile(path.join(raiz(), chave), data);
  return chave;
}

/** `null` quando não existe — inclusive pra chave malformada. */
export async function ler(chave: string): Promise<Buffer | null> {
  if (!CHAVE_VALIDA.test(chave)) return null;
  try {
    return await fs.readFile(path.join(raiz(), chave));
  } catch {
    return null;
  }
}

/**
 * Apagar não pode derrubar a operação.
 *
 * Se o arquivo já sumiu, o objetivo está cumprido. E a linha do banco é a
 * verdade: um arquivo órfão no disco é lixo, uma linha apontando pra arquivo
 * inexistente é buraco no cardápio.
 */
export async function apagar(chave: string): Promise<void> {
  if (!CHAVE_VALIDA.test(chave)) return;
  await fs.rm(path.join(raiz(), chave), { force: true });
}
