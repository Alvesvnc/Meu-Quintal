import { useState } from 'react';
import { Divider, Button } from '@mq/design-system';
import { useQuintal } from '../api/hooks';
import { KitchenRow } from '../components/KitchenRow';
import { KitchenCard } from '../components/KitchenCard';
import { ScreenError } from '../components/ScreenError';

type Layout = 'lista' | 'grade';

/**
 * Tela 01 — pós-QR · lista de cozinhas.
 * Default: grade 2 cols (decidido em 2026-05-26 — ver pages/cliente.md).
 */
export function LandingScreen() {
  const [layout] = useState<Layout>('grade');
  const { data, isLoading, error, refetch } = useQuintal();

  if (isLoading) {
    return (
      <main className="px-5 pt-8 text-center">
        <p className="font-display italic text-display-md text-inkMuted">
          Carregando o quintal…
        </p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <ScreenError
        title="Não rolou abrir o quintal."
        body="A mesa pode ter sido recriada pelo dono ou o quintal está temporariamente fora do ar."
        onRetry={() => refetch()}
      />
    );
  }

  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const openCount = data.kitchens.length;
  const mesaNumero = data.table.numero;

  return (
    <main className="pb-10">
      <section className="px-5 pt-6 pb-2">
        <p className="font-sans text-body text-ink leading-relaxed text-pretty
                      first-letter:font-display first-letter:italic
                      first-letter:text-[56px] first-letter:leading-[0.85]
                      first-letter:float-left first-letter:mr-3 first-letter:mt-1
                      first-letter:text-primary">
          Você está na Mesa{' '}
          <span className="font-mono">{String(mesaNumero).padStart(2, '0')}</span>.
          O quintal hoje tem{' '}
          <em className="font-display italic">{openCount} cozinhas</em> abertas.
          Monte seu pedido com itens de quantas quiser.
        </p>
      </section>

      <div className="px-5 pt-5 pb-1">
        <Divider label={`Hoje · ${now}`} />
      </div>

      {layout === 'lista' ? (
        <section className="px-5">
          {data.kitchens.map((k, i) => (
            <KitchenRow key={k.id} kitchen={k} index={i} />
          ))}
        </section>
      ) : (
        <section className="px-5 pt-4 grid grid-cols-2 gap-x-3 gap-y-7">
          {data.kitchens.map((k, i) => (
            <KitchenCard key={k.id} kitchen={k} index={i} />
          ))}
        </section>
      )}

      {data.kitchens.length === 0 && (
        <section className="px-5 pt-10 text-center">
          <p className="font-display italic text-display-md text-inkMuted text-pretty">
            Nenhuma cozinha aberta agora.
          </p>
          <div className="mt-5">
            <Button variant="secondary" size="md" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        </section>
      )}

      <footer className="px-5 pt-8 pb-2">
        <Divider />
        <p className="mt-4 text-center font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          {data.space.name}
        </p>
      </footer>
    </main>
  );
}
