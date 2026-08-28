import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Divider } from '@mq/design-system';
import { playOrderNewSound, buzzShort } from '../lib/sound';
import { mensagemDeErro } from '@mq/shared';
import { usePush, useLigarPush, useDesligarPush } from '../api/hooks';
import { inscricaoAtual, permissaoAtual, pushSuportado, PushRecusado } from '../lib/push';

/**
 * Como a cozinha fica sabendo que entrou pedido.
 *
 * Esta tela era uma maquete de notificação de tela bloqueada, montada em cima
 * de pedidos falsos. O problema não era o mock: é que a notificação de tela
 * bloqueada **não existia** no produto, e a tela prometia que sim.
 *
 * Agora existe, e a tela ligou de verdade. São duas camadas, e a distinção
 * entre elas é o que a pessoa precisa entender aqui:
 *
 *   dentro do app — som e vibração, sem permissão nenhuma, sempre ligado;
 *   fora do app   — notificação do sistema, por aparelho, precisa autorizar.
 *
 * Testar o som continua tendo uso real: cozinha é barulhenta, e quem monta a
 * operação precisa saber se dá pra ouvir antes do primeiro pedido de verdade.
 */
export function PushScreen() {
  const navigate = useNavigate();
  const { data: push, isLoading } = usePush();
  const ligar = useLigarPush();
  const desligar = useDesligarPush();

  // A inscrição mora no navegador, não na nossa API: só o próprio aparelho sabe
  // se ELE está inscrito. `null` enquanto não perguntamos.
  const [inscritoAqui, setInscritoAqui] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    void inscricaoAtual().then((i) => {
      if (vivo) setInscritoAqui(i !== null);
    });
    return () => {
      vivo = false;
    };
  }, [ligar.isSuccess, desligar.isSuccess]);

  const suportado = pushSuportado();
  const bloqueado = permissaoAtual() === 'denied';
  const servidorTemChave = Boolean(push?.chavePublica);
  const outrosAparelhos = Math.max(0, (push?.aparelhos ?? 0) - (inscritoAqui ? 1 : 0));

  const erro = ligar.error ?? desligar.error;
  const avisoDeErro =
    erro instanceof PushRecusado
      ? erro.message
      : erro
        ? mensagemDeErro(erro, 'Não deu pra mudar o aviso agora. Tente de novo.')
        : null;

  return (
    <main className="px-5 pb-28">
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">Avisos</p>
        <h1 className="mt-1 font-display text-display-lg text-ink leading-tight text-pretty">
          Como você fica sabendo.
        </h1>
        <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
          Com o app aberto, todo pedido novo toca um sino e vibra o aparelho. Não precisa dar
          permissão pra nada e funciona em qualquer celular ou tablet.
        </p>
        <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
          Enquanto a fila estiver aberta, o app também segura a tela acesa sozinho — não precisa
          mexer em ajuste nenhum nem desligar o bloqueio do aparelho.
        </p>
      </section>

      <section className="mt-8">
        <Divider label="Testar agora" />
        <p className="mt-3 font-sans text-body-sm text-inkMuted">
          Cozinha é barulhenta. Confira se dá pra ouvir daqui do fogão, com o volume que você
          costuma deixar.
        </p>
        <div className="mt-4 space-y-2">
          <Button variant="primary" size="lg" fullWidth onClick={() => playOrderNewSound()}>
            Tocar o som de pedido novo
          </Button>
          <Button variant="secondary" size="lg" fullWidth onClick={() => buzzShort()}>
            Vibrar
          </Button>
        </div>
        <p className="mt-3 font-sans text-body-sm text-inkDim">
          A vibração não funciona no iPhone — o navegador da Apple não deixa o site vibrar o
          aparelho. No Android funciona.
        </p>
      </section>

      <section className="mt-8">
        <Divider label="Com o app fechado" />

        {isLoading ? (
          <p className="mt-3 font-sans text-body text-inkDim">Carregando…</p>
        ) : !servidorTemChave ? (
          /*
            Sem chave VAPID no servidor não adianta oferecer o botão: a pessoa
            autorizaria a notificação e nada chegaria. Vale dizer o que falta,
            porque quem lê isto costuma ser quem instala o sistema.
          */
          <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
            Ainda não está ligado neste servidor. Quem cuida da instalação precisa configurar as
            chaves de push — até lá, vale o aviso de dentro do app, acima.
          </p>
        ) : !suportado ? (
          <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
            Este aparelho não aceita aviso com o app fechado. No iPhone, isso só funciona depois de
            instalar o app na tela de início — pelo botão de compartilhar do Safari,{' '}
            <span className="text-ink">Adicionar à Tela de Início</span>.
          </p>
        ) : bloqueado ? (
          <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
            As notificações deste site estão bloqueadas no aparelho. O navegador não pergunta de
            novo depois de negado: é preciso liberar nos ajustes do site e voltar aqui.
          </p>
        ) : (
          <>
            <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
              {inscritoAqui
                ? 'Este aparelho avisa mesmo com a tela apagada e o app fechado.'
                : 'Ligue pra receber pedido novo e pedido de conta com a tela apagada. Vale só neste aparelho — cada tablet ou celular autoriza o seu.'}
            </p>

            <div className="mt-4">
              {inscritoAqui ? (
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  loading={desligar.isPending}
                  onClick={() => desligar.mutate()}
                >
                  Desligar neste aparelho
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={ligar.isPending}
                  onClick={() => ligar.mutate(push!.chavePublica!)}
                >
                  Ligar o aviso neste aparelho
                </Button>
              )}
            </div>

            {avisoDeErro && (
              <p className="mt-3 font-sans text-body-sm text-danger text-pretty">{avisoDeErro}</p>
            )}

            {/*
              Contar os OUTROS aparelhos, não o total. Quem abriu no próprio
              celular e vê "1 aparelho" não sabe se é o dele ou o do balcão —
              e a pergunta que essa pessoa tem é se a cozinha está coberta
              quando ela não está por perto.
            */}
            {outrosAparelhos > 0 && (
              <p className="mt-3 font-sans text-body-sm text-inkDim">
                {outrosAparelhos === 1
                  ? 'Mais um aparelho desta cozinha também avisa.'
                  : `Mais ${outrosAparelhos} aparelhos desta cozinha também avisam.`}
              </p>
            )}

            <p className="mt-3 font-sans text-body-sm text-inkDim">
              O aviso não aparece quando o app já está na sua frente — ali o sino toca e a fila
              atualiza sozinha.
            </p>
          </>
        )}
      </section>

      <section className="mt-10">
        <Button variant="ghost" size="lg" fullWidth onClick={() => navigate('/fila')}>
          Voltar pra fila
        </Button>
      </section>
    </main>
  );
}
