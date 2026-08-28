import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Chip, Divider, ConfirmSheet } from '@mq/design-system';
import { mensagemDeErro, type AssinaturaStatus, type AssinaturaResponse } from '@mq/shared';
import { useAssinatura, useAssinar, useCancelarAssinatura } from '../api/hooks';

/**
 * A mensalidade que ESTE dono paga pro QRO.
 *
 * Nada a ver com a tela de Financeiro, que é o dono cobrando as cozinhas dele —
 * aquele dinheiro não passa pelo app. Aqui é a assinatura do software.
 *
 * O cartão é digitado na página do provedor, nunca aqui: o botão só leva pra
 * lá. Campo de cartão nesta tela colocaria dado de cartão dentro do nosso
 * domínio, e não há motivo pra isso existir.
 */
export function AssinaturaDaConta() {
  const q = useAssinatura();
  const assinar = useAssinar();
  const cancelar = useCancelarAssinatura();
  const [params, setParams] = useSearchParams();
  const [confirmando, setConfirmando] = useState(false);

  const voltouDoPagamento = params.get('assinatura');
  const dados = q.data;
  const { refetch } = q;

  /**
   * Quem volta do provedor chega ANTES do webhook.
   *
   * O redirecionamento é imediato; o evento que ativa a conta leva alguns
   * segundos. Sem esta espera, a pessoa pagaria e veria "não assinado" — e
   * pagaria de novo. Buscamos de novo por meio minuto e depois paramos, pra
   * não deixar a tela consultando pra sempre.
   */
  useEffect(() => {
    if (voltouDoPagamento !== 'sucesso') return;
    if (dados?.status === 'ativa') return;

    let tentativas = 0;
    const id = setInterval(() => {
      tentativas++;
      if (tentativas > 10) return clearInterval(id);
      void refetch();
    }, 3000);
    return () => clearInterval(id);
  }, [voltouDoPagamento, dados?.status, refetch]);

  if (q.isLoading || !dados) return null;

  const limparAviso = () => {
    params.delete('assinatura');
    setParams(params, { replace: true });
  };

  const erro =
    assinar.error || cancelar.error
      ? mensagemDeErro(assinar.error ?? cancelar.error, 'Não consegui falar com o pagamento.')
      : null;

  return (
    <section>
      <Divider label="Assinatura" />

      {voltouDoPagamento && (
        <AvisoDeRetorno
          resultado={voltouDoPagamento}
          liberado={dados.status === 'ativa'}
          aoFechar={limparAviso}
        />
      )}

      <div className="mt-4 flex items-baseline gap-3 flex-wrap">
        <p className="font-display text-display-md text-ink leading-tight">
          {dados.precoMensalCents !== null ? emReais(dados.precoMensalCents) : '—'}
          {dados.precoMensalCents !== null && (
            <span className="font-sans text-body text-inkMuted"> /mês</span>
          )}
        </p>
        <Chip tone={TOM[dados.status]} className="ml-auto">
          {ROTULO[dados.status]}
        </Chip>
      </div>

      <p className="mt-2 font-sans text-body text-inkMuted text-pretty">{explicar(dados)}</p>

      {dados.proximaCobrancaEm && dados.status === 'ativa' && (
        <p className="mt-2 font-mono text-mono-sm text-inkDim">
          Próxima cobrança em {new Date(dados.proximaCobrancaEm).toLocaleDateString('pt-BR')}
        </p>
      )}

      {erro && <p className="mt-3 font-mono text-mono-sm text-danger">{erro}</p>}

      {/* Sem chave do provedor não há botão: oferecer um que sempre falha é
          pior do que dizer que ainda não está ligado. */}
      {!dados.pagamentoAtivo ? (
        <p className="mt-4 font-sans text-body-sm text-inkDim text-pretty">
          O pagamento ainda não está ligado nesta instalação.
        </p>
      ) : (
        <div className="mt-5 flex gap-2 flex-wrap">
          {dados.podeAssinar && (
            <Button
              variant="primary"
              size="lg"
              disabled={assinar.isPending || dados.precoMensalCents === null}
              onClick={() => assinar.mutate()}
            >
              {assinar.isPending ? 'Abrindo…' : 'Assinar'}
            </Button>
          )}
          {dados.status === 'ativa' && (
            <Button variant="ghost" size="lg" onClick={() => setConfirmando(true)}>
              Cancelar assinatura
            </Button>
          )}
        </div>
      )}

      {dados.pagamentoAtivo && dados.podeAssinar && (
        <p className="mt-3 font-sans text-body-sm text-inkDim text-pretty">
          Pix ou cartão de crédito. Você paga na página do Asaas — os dados do cartão não passam por
          aqui.
        </p>
      )}

      <ConfirmSheet
        open={confirmando}
        title="Cancelar a assinatura?"
        body="Você continua entrando e vendo tudo, mas não consegue mais alterar nada até assinar de novo. Nada é apagado."
        confirmLabel="Cancelar assinatura"
        cancelLabel="Voltar"
        tone="danger"
        loading={cancelar.isPending}
        onConfirm={() => cancelar.mutate(undefined, { onSettled: () => setConfirmando(false) })}
        onClose={() => setConfirmando(false)}
      />
    </section>
  );
}

/** Aviso de quem acabou de voltar da página do provedor. */
function AvisoDeRetorno({
  resultado,
  liberado,
  aoFechar,
}: {
  resultado: string;
  liberado: boolean;
  aoFechar: () => void;
}) {
  const texto =
    resultado === 'sucesso'
      ? liberado
        ? 'Pagamento confirmado. Sua conta está liberada.'
        : 'Recebemos seu pagamento. A liberação chega em alguns segundos — pode deixar esta tela aberta.'
      : resultado === 'expirado'
        ? 'O link de pagamento expirou. É só começar de novo.'
        : 'Pagamento cancelado. Nada foi cobrado.';

  const tom = resultado === 'sucesso' ? 'border-l-accent' : 'border-l-hairline';

  return (
    <div className={`mt-4 border-l-2 ${tom} pl-4 flex items-start gap-4`}>
      <p className="font-sans text-body text-ink text-pretty flex-1">{texto}</p>
      <button
        type="button"
        onClick={aoFechar}
        className="font-mono text-mono-sm uppercase tracking-wider text-inkDim
                   hover:text-primary cursor-pointer transition-colors duration-base ease-out"
      >
        ok
      </button>
    </div>
  );
}

/** Centavos pra "R$ 199,00". */
function emReais(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const ROTULO: Record<AssinaturaStatus, string> = {
  nenhuma: 'sem assinatura',
  aguardando: 'aguardando pagamento',
  ativa: 'em dia',
  atrasada: 'em atraso',
  encerrada: 'encerrada',
};

const TOM: Record<AssinaturaStatus, 'primary' | 'warn' | 'danger' | 'neutral'> = {
  nenhuma: 'neutral',
  aguardando: 'warn',
  ativa: 'primary',
  atrasada: 'danger',
  encerrada: 'neutral',
};

/**
 * O texto que explica o estado atual.
 *
 * `nenhuma` é o único que depende de mais contexto, e a diferença é grande:
 * "sem assinatura" com o teste correndo e "sem assinatura" com o teste vencido
 * são situações opostas — numa não há nada a fazer, na outra a conta acabou de
 * ser suspensa por uma varredura automática.
 *
 * Mostrar só "esta conta não tem assinatura" pra quem foi suspenso hoje de
 * manhã é o tipo de tela que vira chamado: a pessoa vê que não consegue mexer
 * em nada e não faz ideia do porquê.
 */
function explicar(dados: AssinaturaResponse): string {
  if (dados.status !== 'nenhuma') return EXPLICACAO[dados.status];
  if (dados.trialEndsAt === null) return EXPLICACAO.nenhuma;

  const fim = new Date(dados.trialEndsAt);
  const dia = fim.toLocaleDateString('pt-BR');

  return fim > new Date()
    ? `Seu teste grátis vai até ${dia}. Depois disso é preciso assinar para continuar alterando.`
    : `Seu teste grátis terminou em ${dia}. Você continua vendo tudo; assine para voltar a alterar.`;
}

const EXPLICACAO: Record<AssinaturaStatus, string> = {
  nenhuma: 'Esta conta ainda não tem assinatura.',
  aguardando: 'Já abrimos o pagamento e estamos esperando a confirmação.',
  ativa: 'Tudo certo. A cobrança se repete sozinha todo mês.',
  // O texto diz a SAÍDA, não só o problema: quem lê isto está tentando
  // resolver, e "conta suspensa" sem instrução gera chamado.
  atrasada:
    'A última cobrança não foi paga. Enquanto isso você vê tudo, mas não consegue alterar nada — assine de novo para liberar.',
  encerrada:
    'A assinatura foi encerrada. Você continua vendo tudo; para voltar a alterar, é só assinar de novo.',
};
