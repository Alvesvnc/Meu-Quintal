/**
 * Cria uma conta nova (um cliente do SaaS) com o dono e o primeiro quintal.
 *
 * É o comando de onboarding: quando alguém assina o QRO, é isto que
 * roda. Diferente de `db:seed`, que APAGA TUDO e existe só para desenvolvimento
 * — o seed nunca pode tocar em produção.
 *
 * Vai junto no bundle (dist/bootstrap.js), então roda na imagem de produção sem
 * precisar de tsx nem do código-fonte:
 *
 *   docker run --rm -e DATABASE_URL=... \
 *     -e CONTA_SLUG=quintal-ubatuba \
 *     -e CONTA_NOME="Quintal Ubatuba" \
 *     -e DONO_EMAIL=roberto@exemplo.com \
 *     -e ESPACO_SLUG=ubatuba-centro \
 *     -e ESPACO_NOME="Quintal Ubatuba · Centro" \
 *     -e PLANO=praca \
 *     ghcr.io/.../server node dist/bootstrap.js
 *
 * Opcionais: DONO_NOME, COMISSAO_PADRAO, DIA_FECHAMENTO, MESAS (quantas mesas
 * criar, padrão 0).
 *
 * ─── A SENHA NÃO É GERADA AQUI ──────────────────────────────────────────────
 * O dono recebe um LINK de uso único para criar a própria senha, e é ele quem
 * a escolhe. Antes disto o script gerava uma senha e a imprimia no terminal,
 * para o operador ditar por WhatsApp — a credencial que abre a conta inteira
 * passeando por canal nenhum e ficando no histórico da conversa para sempre.
 *
 * Com `RESEND_API_KEY` configurado o link vai por email; sem chave, ele é
 * impresso aqui para você mandar pela mão. O link é o mesmo.
 *
 * ─── O PLANO DECIDE O FORMATO ───────────────────────────────────────────────
 * PLANO é obrigatório, e é ele que diz o que a conta é:
 *
 *   PLANO=restaurante  uma cozinha, que é do próprio dono. Cria a cozinha
 *                      junto e liga o dono a ela, de forma que UM login toque
 *                      o negócio inteiro. Exige RESTAURANTE_NOME.
 *   PLANO=praca        várias cozinhas independentes, cada uma com login
 *                      próprio. As cozinhas entram depois, por convite.
 *
 * Não há `TIPO`: o tipo do espaço é consequência do plano, nunca uma escolha
 * separada — ver server/src/lib/planos.ts.
 *
 * No plano Restaurante a comissão e o aluguel nascem DESLIGADOS: cobrar
 * comissão de si mesmo não significa nada, e deixar ligado encheria o
 * financeiro de cobranças que o dono deve a ele próprio.
 */
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { categoriasPadrao } from './lib/categoriasPadrao.js';
import { enviar, emailAtivo, boasVindas } from './lib/email.js';
import { PLANOS } from './lib/planos.js';
import { fimDoTrial, trialLigado } from './lib/trial.js';
import { env } from './lib/env.js';

const prisma = new PrismaClient();

/* eslint-disable no-console */

function exigir(nome: string): string {
  const v = process.env[nome]?.trim();
  if (!v) {
    console.error(`\nFaltou a variavel ${nome}.\n`);
    process.exit(1);
  }
  return v;
}

function slugValido(s: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
}

/** Dias que o link de primeiro acesso vale. */
const LINK_VALIDO_DIAS = 7;

async function main() {
  const contaSlug = exigir('CONTA_SLUG');
  const contaNome = exigir('CONTA_NOME');
  const donoEmail = exigir('DONO_EMAIL').toLowerCase();
  const espacoSlug = exigir('ESPACO_SLUG');
  const espacoNome = exigir('ESPACO_NOME');

  const donoNome = process.env.DONO_NOME?.trim() || null;
  const comissao = Number(process.env.COMISSAO_PADRAO ?? 15);
  const diaFechamento = Number(process.env.DIA_FECHAMENTO ?? 5);
  const mesas = Number(process.env.MESAS ?? 0);

  const plano = exigir('PLANO').trim();
  const restauranteUnico = plano === 'restaurante';
  const restauranteNome = process.env.RESTAURANTE_NOME?.trim() || contaNome;

  // ─── Validação antes de escrever ──────────────────────────────────────────
  // Barrar aqui é barato; descobrir depois que a conta nasceu com slug inválido
  // custa uma migração de dados.
  const erros: string[] = [];
  if (!slugValido(contaSlug)) erros.push('CONTA_SLUG deve ser minusculo-com-hifens');
  if (!slugValido(espacoSlug)) erros.push('ESPACO_SLUG deve ser minusculo-com-hifens');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(donoEmail)) erros.push('DONO_EMAIL invalido');
  if (!Number.isFinite(comissao) || comissao < 0 || comissao > 100) {
    erros.push('COMISSAO_PADRAO fora de 0..100');
  }
  if (!Number.isInteger(diaFechamento) || diaFechamento < 1 || diaFechamento > 28) {
    // 28 e nao 31: dia 30 nao existe em fevereiro, e um ciclo que nunca fecha
    // e pior do que um que fecha cedo.
    erros.push('DIA_FECHAMENTO deve estar entre 1 e 28');
  }
  if (!Number.isInteger(mesas) || mesas < 0 || mesas > 500) erros.push('MESAS fora de 0..500');
  if (plano !== 'restaurante' && plano !== 'praca') {
    erros.push('PLANO deve ser "restaurante" ou "praca"');
  }

  if (erros.length > 0) {
    console.error('\nEntrada invalida:\n');
    for (const e of erros) console.error(`  - ${e}`);
    console.error('');
    process.exit(1);
  }

  // ─── Colisões ─────────────────────────────────────────────────────────────
  const [contaExiste, espacoExiste, emailExiste] = await Promise.all([
    prisma.account.findUnique({ where: { slug: contaSlug }, select: { id: true } }),
    prisma.space.findUnique({ where: { slug: espacoSlug }, select: { id: true } }),
    prisma.accountUser.findUnique({ where: { email: donoEmail }, select: { id: true } }),
  ]);

  if (contaExiste) {
    console.error(`\nJa existe conta com slug "${contaSlug}".\n`);
    process.exit(1);
  }
  if (espacoExiste) {
    console.error(`\nJa existe espaco com slug "${espacoSlug}".\n`);
    process.exit(1);
  }
  if (emailExiste) {
    // O email e unico no sistema inteiro: e assim que o login descobre a qual
    // conta o usuario pertence, sem pedir o quintal no formulario.
    console.error(`\nO email "${donoEmail}" ja pertence a outra conta.\n`);
    process.exit(1);
  }

  // Hash impossível de casar com qualquer senha: a conta nasce SEM senha
  // utilizável, e a única entrada é o link de primeiro acesso. Deixar um hash
  // de senha conhecida aqui seria uma porta aberta até alguém trocá-la.
  const passwordHash = 'sem-senha:' + crypto.randomBytes(24).toString('base64url');

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const linkExpiraEm = new Date(Date.now() + LINK_VALIDO_DIAS * 24 * 60 * 60 * 1000);

  // Transação: conta sem dono é conta em que ninguém consegue entrar, e não há
  // rota para consertar isso depois.
  const resultado = await prisma.$transaction(async (tx) => {
    const conta = await tx.account.create({
      data: {
        slug: contaSlug,
        name: contaNome,
        // O plano decide o formato do espaco e o teto de cozinhas.
        plan: restauranteUnico ? 'restaurante' : 'praca',
        status: 'ativa',
        // Quanto tempo, e SE ha teste, sai de lib/trial.ts — nao daqui.
        trialEndsAt: fimDoTrial(),
        users: {
          create: { email: donoEmail, passwordHash, name: donoNome, role: 'owner' },
        },
      },
      include: { users: true },
    });

    const espaco = await tx.space.create({
      data: {
        accountId: conta.id,
        slug: espacoSlug,
        name: espacoNome,
        tipo: restauranteUnico ? 'restaurante_unico' : 'food_court',
        defaultCommissionPct: comissao,
        closingDay: diaFechamento,
      },
    });

    // ─── Restaurante único: a cozinha nasce junto e o dono opera ela ────────
    let cozinha = null;
    if (restauranteUnico) {
      cozinha = await tx.kitchen.create({
        data: {
          spaceId: espaco.id,
          slug: espacoSlug,
          name: restauranteNome,
          status: 'ativa',
          // Cobrar comissão de si mesmo não significa nada, e deixar ligado
          // encheria o financeiro de dívidas do dono com ele próprio.
          chargeCommission: false,
          chargeRent: false,
          // As secoes com que o cardapio comeca. Ver lib/categoriasPadrao.ts:
          // sao ponto de partida editavel, nao regra do sistema.
          menuCategorias: { create: categoriasPadrao() },
        },
      });

      // O VÍNCULO: com ele, o token de dono também abre /api/r/*. Um login
      // para tocar o negócio inteiro, em vez de duas contas e dois apps.
      await tx.accountUser.update({
        where: { id: conta.users[0].id },
        data: { kitchenId: cozinha.id },
      });
    }

    if (mesas > 0) {
      await tx.table.createMany({
        data: Array.from({ length: mesas }, (_, i) => ({
          spaceId: espaco.id,
          numero: i + 1,
          // O qrToken E a credencial da mesa: aleatorio, nunca sequencial.
          // Token previsivel deixaria qualquer um abrir qualquer mesa.
          qrToken: crypto.randomBytes(24).toString('base64url'),
        })),
      });
    }

    // O link nasce DENTRO da transação: conta criada sem link seria conta em
    // que ninguém consegue entrar, e não há rota para consertar isso depois.
    await tx.accessToken.create({
      data: {
        tokenHash,
        kind: 'primeiro_acesso',
        userId: conta.users[0].id,
        expiresAt: linkExpiraEm,
      },
    });

    return { conta, espaco, cozinha };
  });

  const link = `${env.APP_DONO_URL}/senha/${token}`;

  const envio = await enviar(
    boasVindas({
      para: donoEmail,
      nome: donoNome,
      nomeDaConta: contaNome,
      nomeDoPlano: PLANOS[restauranteUnico ? 'restaurante' : 'praca'].nome,
      link,
      expiraEm: linkExpiraEm,
    }),
  );

  console.log('');
  console.log('Conta criada.');
  console.log('');
  console.log(`  conta   : ${resultado.conta.name} (${resultado.conta.slug})`);
  console.log(
    `  plano   : ${resultado.conta.plan} (${
      trialLigado()
        ? `teste ate ${resultado.conta.trialEndsAt?.toISOString().slice(0, 10)}`
        : 'SEM teste: precisa assinar pra alterar qualquer coisa'
    })`,
  );
  console.log(`  espaco  : ${resultado.espaco.name} (${resultado.espaco.slug})`);
  if (resultado.cozinha) {
    console.log(`  cozinha : ${resultado.cozinha.name} — o dono opera ela direto`);
    console.log(`  cobranca: desligada (nao faz sentido cobrar de si mesmo)`);
  } else {
    console.log(`  comissao: ${comissao}%  |  ciclo fecha dia ${diaFechamento}`);
  }
  if (mesas > 0) console.log(`  mesas   : ${mesas} criadas com qrToken aleatorio`);
  console.log('');
  console.log(`  login   : ${donoEmail}`);
  console.log('');

  if (envio.enviado) {
    console.log(`  Email de boas-vindas enviado pra ${donoEmail}.`);
    console.log('  Ele cria a propria senha pelo link e ja entra.');
  } else {
    if (emailAtivo()) {
      console.log(`  ATENCAO: o email NAO saiu (${envio.erro}).`);
    } else {
      console.log('  Email desligado (RESEND_API_KEY vazio).');
    }
    console.log('  Mande este link pro dono — ele cria a propria senha e ja entra:');
    console.log('');
    console.log(`    ${link}`);
  }
  console.log('');
  console.log(`  O link vale ate ${linkExpiraEm.toISOString().slice(0, 10)} e serve uma vez so.`);
  console.log('  NAO existe senha pra ditar: a conta nasce sem senha utilizavel.');
  console.log('');
}

main()
  .catch((err) => {
    console.error('\nFalhou:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
