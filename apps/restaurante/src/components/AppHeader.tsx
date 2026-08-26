import { useEffect, useState } from 'react';
import { useAuth } from '../stores/auth';
import { useFila } from '../api/hooks';

/**
 * Cabeçalho da cozinha: nome, quantos pedidos estão em aberto, relógio.
 *
 * O contador vem da MESMA query que a fila desenha (`useFila`), e não de um
 * store paralelo. Havia um `stores/queue.ts` alimentado por mock aqui: o badge
 * mostrava um número e a fila logo abaixo mostrava outro, na mesma tela. Se um
 * dia o contador precisar de outra fonte, a pergunta certa é por que ele
 * discorda do que está na tela.
 */
export function AppHeader() {
  const nome = useAuth((s) => s.me?.kitchen.name);
  const { data } = useFila();
  const [agora, setAgora] = useState(() => new Date());

  const ativos =
    data?.orders.filter((o) => o.status === 'novo' || o.status === 'preparando').length ?? 0;

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-20 h-16 bg-bg border-b border-hairlineSoft">
      <div className="h-full px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-accent"
            aria-hidden
          />
          <div className="min-w-0">
            <h1 className="font-display text-display-md text-ink leading-tight truncate">
              {nome ?? 'Minha cozinha'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="font-mono text-mono-sm uppercase tracking-wider text-inkDim"
            aria-label={`${ativos} pedidos ativos`}
          >
            {ativos} ativos
          </span>
          <span className="font-mono text-mono text-ink tabular-nums" aria-label="Hora atual">
            {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </header>
  );
}
