import { Resend } from 'resend';
import { env, isDev } from './env.js';

/**
 * Envio de email, via Resend.
 *
 * **DESLIGADO POR PADRÃO.** Com `RESEND_API_KEY` vazio nada é enviado, nenhuma
 * requisição de rede sai e nada quebra — o convite continua devolvendo o link
 * na tela, que é como funcionava antes. Mesma escolha do Sentry: integração
 * pronta, custo zero até alguém colar a chave.
 *
 * ─── FALHAR AQUI NÃO PODE DERRUBAR A OPERAÇÃO ───────────────────────────────
 *
 * `enviar` nunca lança. Se o Resend estiver fora do ar, o convite JÁ FOI
 * CRIADO — a linha está no banco e o link está na resposta. Derrubar a
 * requisição faria o dono achar que precisa convidar de novo, e ele criaria um
 * segundo convite para a mesma pessoa. O que se faz é registrar no log e seguir.
 */

let cliente: Resend | null = null;

function obterCliente(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!cliente) cliente = new Resend(env.RESEND_API_KEY);
  return cliente;
}

/** `true` quando há chave configurada — a rota usa pra decidir o que dizer. */
export function emailAtivo(): boolean {
  return !!env.RESEND_API_KEY;
}

export interface Email {
  para: string;
  assunto: string;
  html: string;
  /** Versão em texto puro. Sem ela, filtro de spam pontua pior. */
  texto: string;
}

export interface ResultadoEnvio {
  enviado: boolean;
  /** Preenchido quando falhou — para o log, nunca para a resposta HTTP. */
  erro?: string;
}

export async function enviar(email: Email): Promise<ResultadoEnvio> {
  const r = obterCliente();
  if (!r) {
    /*
      SEM CHAVE, EM DESENVOLVIMENTO, O E-MAIL VAI PRO CONSOLE.

      Isto conserta um beco sem saída real. "Esqueci minha senha" responde
      `{ok:true}` mesmo quando nada foi enviado — e responde igual para e-mail
      que existe e que não existe, de propósito, para não contar a ninguém quem
      tem conta aqui. Junto com `RESEND_API_KEY` vazio, o resultado era que o
      link NÃO EXISTIA em lugar nenhum alcançável: nem na resposta, nem em
      e-mail, nem em log. E ler o banco não resolvia — `access_tokens` guarda o
      HASH do token, não o token.

      SÓ EM DESENVOLVIMENTO. Link de recuperação em log de produção é falha de
      segurança: quem lê o log passa a poder trocar a senha de qualquer pessoa.
      Em produção isto continua silencioso, como sempre foi.
    */
    if (isDev) {
      console.warn(
        `\n─── E-MAIL NAO ENVIADO (RESEND_API_KEY vazio) ───\n` +
          `para:    ${email.para}\n` +
          `assunto: ${email.assunto}\n\n` +
          `${email.texto.trim()}\n` +
          `─────────────────────────────────────────────────\n`,
      );
    }
    return { enviado: false, erro: 'RESEND_API_KEY vazio' };
  }

  try {
    const { error } = await r.emails.send({
      from: env.EMAIL_FROM,
      to: email.para,
      subject: email.assunto,
      html: email.html,
      text: email.texto,
    });
    if (error) return { enviado: false, erro: error.message };
    return { enviado: true };
  } catch (e) {
    return { enviado: false, erro: e instanceof Error ? e.message : 'falha desconhecida' };
  }
}

/**
 * Escapa texto que vai para dentro do HTML.
 *
 * O nome da cozinha e o do quintal são escritos por gente, e entram no corpo do
 * email. Sem escapar, um nome com `<` quebra o layout no melhor caso — e no
 * pior, num cliente de email que renderize demais, injeta marcação.
 */
function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ConviteDeCozinha {
  para: string;
  /** Nome combinado no convite — o responsável muda depois se quiser. */
  nomeDaCozinha: string;
  nomeDoQuintal: string;
  link: string;
  expiraEm: Date;
}

/**
 * O convite para operar uma cozinha.
 *
 * Escrito para alguém que talvez nunca tenha ouvido falar do QRO: diz
 * quem convidou, para quê, e o que acontece ao clicar. Um email que só diz
 * "clique aqui" com um link estranho vai para o lixo — ou pior, treina a pessoa
 * a clicar em link estranho.
 */
export function conviteDeCozinha(dados: ConviteDeCozinha): Email {
  const validade = dados.expiraEm.toLocaleDateString('pt-BR');
  const quintal = esc(dados.nomeDoQuintal);
  const cozinha = esc(dados.nomeDaCozinha);

  const texto = [
    `${dados.nomeDoQuintal} convidou você para operar a ${dados.nomeDaCozinha} no QRO.`,
    '',
    'O QRO e o sistema de pedidos do espaco: o cliente escaneia o QR da',
    'mesa, monta o pedido, e ele cai direto na sua fila.',
    '',
    'Para aceitar e criar sua senha:',
    dados.link,
    '',
    `O link vale ate ${validade} e serve uma vez so.`,
    '',
    'Se voce nao esperava este convite, ignore este email.',
  ].join('\n');

  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
  <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#777;margin:0 0 8px">
    QRO
  </p>
  <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px;font-weight:600">
    ${quintal} convidou você para operar a ${cozinha}.
  </h1>
  <p style="font-size:16px;line-height:1.55;color:#444;margin:0 0 16px">
    O QRO é o sistema de pedidos do espaço: o cliente escaneia o QR da mesa,
    monta o pedido, e ele cai direto na sua fila.
  </p>
  <p style="margin:24px 0">
    <a href="${esc(dados.link)}"
       style="display:inline-block;background:#c8501e;color:#fff;text-decoration:none;
              padding:14px 22px;border-radius:8px;font-size:16px;font-weight:500">
      Aceitar e criar minha senha
    </a>
  </p>
  <p style="font-size:14px;line-height:1.5;color:#777;margin:0 0 4px">
    O link vale até ${validade} e serve uma vez só.
  </p>
  <p style="font-size:14px;line-height:1.5;color:#777;margin:0">
    Se você não esperava este convite, ignore este email.
  </p>
</div>`.trim();

  return {
    para: dados.para,
    // Sem "!!!" nem "URGENTE": assunto que parece propaganda vai pro spam, e o
    // convite e a unica porta de entrada da cozinha no sistema.
    assunto: `${dados.nomeDoQuintal} convidou você para operar a ${dados.nomeDaCozinha}`,
    html,
    texto,
  };
}

export interface BoasVindas {
  para: string;
  nome: string | null;
  nomeDaConta: string;
  /** "Restaurante" ou "Praça de alimentação". */
  nomeDoPlano: string;
  link: string;
  expiraEm: Date;
}

/**
 * A conta está pronta — crie sua senha.
 *
 * É o primeiro contato do cliente com o produto depois de pagar, e a única
 * coisa que ele precisa fazer é clicar. Por isso o link é a única ação: sem
 * "conheça nossos recursos", sem link secundário competindo com ele.
 *
 * **Não vai senha aqui.** A senha nasce no navegador de quem vai usá-la. Email
 * fica em caixa de entrada para sempre, é sincronizado em três aparelhos e às
 * vezes é lido por um assistente — não é lugar para a credencial que abre o
 * financeiro inteiro.
 */
export function boasVindas(dados: BoasVindas): Email {
  const validade = dados.expiraEm.toLocaleDateString('pt-BR');
  const conta = esc(dados.nomeDaConta);
  const saudacao = dados.nome ? `Oi, ${esc(dados.nome)}.` : 'Sua conta está pronta.';

  const texto = [
    dados.nome ? `Oi, ${dados.nome}.` : 'Sua conta esta pronta.',
    '',
    `A conta ${dados.nomeDaConta} foi criada no plano ${dados.nomeDoPlano}.`,
    '',
    'Para criar sua senha e entrar:',
    dados.link,
    '',
    `O link vale ate ${validade} e serve uma vez so.`,
    '',
    'Nao enviamos senha por email — voce escolhe a sua no proprio link.',
  ].join('\n');

  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
  <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#777;margin:0 0 8px">
    QRO
  </p>
  <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px;font-weight:600">
    ${esc(saudacao)}
  </h1>
  <p style="font-size:16px;line-height:1.55;color:#444;margin:0 0 16px">
    A conta <strong>${conta}</strong> foi criada no plano ${esc(dados.nomeDoPlano)}.
    Falta só criar sua senha.
  </p>
  <p style="margin:24px 0">
    <a href="${esc(dados.link)}"
       style="display:inline-block;background:#c8501e;color:#fff;text-decoration:none;
              padding:14px 22px;border-radius:8px;font-size:16px;font-weight:500">
      Criar minha senha e entrar
    </a>
  </p>
  <p style="font-size:14px;line-height:1.5;color:#777;margin:0 0 4px">
    O link vale até ${validade} e serve uma vez só.
  </p>
  <p style="font-size:14px;line-height:1.5;color:#777;margin:0">
    Não enviamos senha por email — você escolhe a sua no próprio link.
  </p>
</div>`.trim();

  return {
    para: dados.para,
    assunto: `Sua conta no QRO está pronta`,
    html,
    texto,
  };
}

export interface RecuperarSenha {
  para: string;
  nome: string | null;
  /** Nome da conta ou da cozinha — pra pessoa reconhecer de onde é o pedido. */
  ondeEntra: string;
  link: string;
  expiraEm: Date;
}

/**
 * Esqueci minha senha.
 *
 * Dois cuidados que parecem detalhe:
 *
 * **Diz de onde é.** "Alguém pediu para trocar a senha" sem dizer de qual
 * sistema é indistinguível de phishing — e treina a pessoa a clicar assim.
 *
 * **Diz o que fazer se não foi ela.** Um e-mail de recuperação que a pessoa não
 * pediu é o primeiro sinal de que alguém está tentando entrar. Ignorar é a ação
 * certa (sem clicar, nada acontece), mas isso precisa estar escrito.
 */
export function recuperarSenha(dados: RecuperarSenha): Email {
  const validade = dados.expiraEm.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const onde = esc(dados.ondeEntra);
  const saudacao = dados.nome ? `Oi, ${esc(dados.nome)}.` : 'Pedido de nova senha.';

  const texto = [
    dados.nome ? `Oi, ${dados.nome}.` : 'Pedido de nova senha.',
    '',
    `Alguem pediu pra trocar a senha de acesso a ${dados.ondeEntra}, no QRO.`,
    '',
    'Para criar uma senha nova:',
    dados.link,
    '',
    `O link vale ate as ${validade} de hoje e serve uma vez so.`,
    '',
    'Se nao foi voce, ignore este email — sua senha continua a mesma.',
  ].join('\n');

  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
  <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#777;margin:0 0 8px">
    QRO
  </p>
  <h1 style="font-size:24px;line-height:1.25;margin:0 0 16px;font-weight:600">
    ${esc(saudacao)}
  </h1>
  <p style="font-size:16px;line-height:1.55;color:#444;margin:0 0 16px">
    Alguém pediu pra trocar a senha de acesso a <strong>${onde}</strong>.
  </p>
  <p style="margin:24px 0">
    <a href="${esc(dados.link)}"
       style="display:inline-block;background:#c8501e;color:#fff;text-decoration:none;
              padding:14px 22px;border-radius:8px;font-size:16px;font-weight:500">
      Criar uma senha nova
    </a>
  </p>
  <p style="font-size:14px;line-height:1.5;color:#777;margin:0 0 4px">
    O link vale até as ${validade} de hoje e serve uma vez só.
  </p>
  <p style="font-size:14px;line-height:1.5;color:#777;margin:0">
    Se não foi você, ignore este email — sua senha continua a mesma.
  </p>
</div>`.trim();

  return {
    para: dados.para,
    assunto: `Nova senha para ${dados.ondeEntra}`,
    html,
    texto,
  };
}
