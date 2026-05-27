import { useEffect, useState } from 'react';
import { MINHA_COZINHA } from '../mocks/kitchen';
import { useQueue, selectActiveCount } from '../stores/queue';

/**
 * Header dark do restaurante. 64px (mais alto que cliente).
 * Mostra: nome cozinha + status online (chip mono) + relógio mono.
 * Online é mock - vira indicador de conexão WS real no MVP.
 */
export function AppHeader() {
  const activeCount = useQueue(selectActiveCount);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-20 h-16 bg-bg border-b border-hairlineSoft">
      <div className="h-full px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-accent" aria-hidden />
          <div className="min-w-0">
            <h1 className="font-display text-display-md text-ink leading-tight truncate">
              {MINHA_COZINHA.name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="font-mono text-mono-sm uppercase tracking-wider text-inkDim"
            aria-label={`${activeCount} pedidos ativos`}
          >
            {activeCount} ativos
          </span>
          <span
            className="font-mono text-mono text-ink tabular-nums"
            aria-label="Hora atual"
          >
            {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </header>
  );
}
