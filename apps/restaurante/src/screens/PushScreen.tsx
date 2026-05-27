import { useNavigate } from 'react-router-dom';
import { Button } from '@mq/design-system';
import { fmtTime, minutesSince } from '../mocks/orders';
import { MINHA_COZINHA } from '../mocks/kitchen';
import { useOrdersByStatus } from '../stores/queue';

/**
 * Tela 02 — Mock visual da notificacao push (lockscreen).
 * Não é uma tela de uso real — é referência de design pra a notificação rica
 * que o app dispara quando chega pedido novo. Acessível em /push pra preview.
 */
export function PushScreen() {
  const navigate = useNavigate();
  const novos = useOrdersByStatus('novo');
  const order = novos[0]; // mostra o mais recente

  if (!order) {
    return (
      <main className="px-5 py-20 text-center">
        <p className="font-display italic text-display-lg text-ink text-pretty">
          Sem pedido novo pra simular push.
        </p>
        <p className="mt-3 font-sans text-body text-inkDim">
          Volta pra <b>Fila</b> e usa "receber pedido fake" pra gerar um.
        </p>
      </main>
    );
  }

  const time = fmtTime(order.createdAt);
  const ago = minutesSince(order.createdAt);

  return (
    <main className="min-h-[calc(100dvh-128px)] flex flex-col items-center justify-center px-5 py-10 bg-black">
      {/* Lockscreen mock */}
      <div className="w-full max-w-[360px]">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-white/60 text-center mb-3">
          Pré-visualização da notificação
        </p>

        <div className="relative">
          {/* Hora do sistema (lockscreen) */}
          <div className="text-center mb-8 text-white">
            <p className="font-display text-[64px] leading-none tabular-nums">{time}</p>
            <p className="mt-2 font-sans text-body uppercase tracking-wider opacity-70">
              {new Date(order.createdAt).toLocaleDateString('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </p>
          </div>

          {/* Notification "card" */}
          <div className="rounded-2xl bg-white/95 backdrop-blur p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-sm bg-primary text-white font-mono text-mono-sm" aria-hidden>
                Q
              </span>
              <span className="font-sans text-body-sm font-medium text-ink uppercase tracking-wider">
                Meu Quintal
              </span>
              <span className="ml-auto font-mono text-mono-sm text-inkDim">
                agora · {ago}m
              </span>
            </div>
            <p className="font-sans text-body-lg font-medium text-ink leading-snug">
              Pedido #{order.id} · Mesa {String(order.mesaNumero).padStart(2, '0')}
            </p>
            <ul className="mt-1 font-sans text-body text-inkMuted">
              {order.lines.slice(0, 2).map((l, i) => (
                <li key={i}>{l.qty}× {l.name}</li>
              ))}
              {order.lines.length > 2 && (
                <li className="text-inkDim">+ {order.lines.length - 2} item(s)</li>
              )}
            </ul>
            <div className="mt-3 flex gap-2 border-t border-hairlineSoft pt-3">
              <button className="flex-1 py-2 font-sans text-body font-medium text-primary cursor-pointer">
                Aceitar
              </button>
              <span className="w-px bg-hairlineSoft" aria-hidden />
              <button className="flex-1 py-2 font-sans text-body text-inkMuted cursor-pointer">
                Não consigo
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-white/40 font-mono text-mono-sm">
            ↑ Tela bloqueada do celular do(a) cozinheiro(a)
          </p>
        </div>
      </div>

      <div className="mt-10 w-full max-w-[360px]">
        <Button variant="secondary" size="lg" fullWidth onClick={() => navigate('/fila')}>
          Voltar pra fila
        </Button>
        <p className="mt-3 text-center font-mono text-mono-sm text-white/40">
          {MINHA_COZINHA.name}
        </p>
      </div>
    </main>
  );
}
