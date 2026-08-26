import { useNavigate } from 'react-router-dom';
import { Button, Divider } from '@mq/design-system';
import { playOrderNewSound, buzzShort } from '../lib/sound';

/**
 * Como a cozinha fica sabendo que entrou pedido.
 *
 * Esta tela era uma maquete de notificação de tela bloqueada, montada em cima
 * de pedidos falsos. O problema não era o mock: é que a notificação de tela
 * bloqueada **não existe** no produto, e a tela prometia que sim.
 *
 * O que existe hoje é aviso dentro do app: som e vibração enquanto a aba está
 * aberta. Funciona em qualquer aparelho e não pede permissão nenhuma — mas
 * depende do tablet estar ligado com o app na frente, que é como uma cozinha
 * trabalha de qualquer jeito.
 *
 * Testar o som aqui tem uso real: cozinha é barulhenta, e quem monta a
 * operação precisa saber se dá pra ouvir antes do primeiro pedido de verdade.
 */
export function PushScreen() {
  const navigate = useNavigate();

  return (
    <main className="px-5 pb-28">
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Avisos
        </p>
        <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight text-pretty">
          Como você fica sabendo.
        </h1>
        <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
          Com o app aberto, todo pedido novo toca um sino e vibra o aparelho. Não precisa dar
          permissão pra nada e funciona em qualquer celular ou tablet.
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
        <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
          Ainda não avisa. Notificação de tela bloqueada é um trabalho separado, e no iPhone ela só
          existe se a pessoa adicionar o site à tela de início — no meio de uma refeição, ninguém
          faz isso.
        </p>
        <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
          Enquanto isso: deixe o aparelho ligado na fila, com a tela acesa.
        </p>
      </section>

      <section className="mt-10">
        <Button variant="ghost" size="lg" fullWidth onClick={() => navigate('/fila')}>
          Voltar pra fila
        </Button>
      </section>
    </main>
  );
}
