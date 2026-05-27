import { Divider } from '@mq/design-system';
import { KITCHENS, MESA_ATUAL } from '../mocks/quintal';
import { KitchenCard } from '../components/KitchenCard';

export function LandingScreen() {
  const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const openCount = KITCHENS.filter((k) => k.isOpen).length;

  return (
    <main className="pb-24">
      <section className="px-5 pt-6 pb-2">
        <p className="font-sans text-body text-ink leading-relaxed text-pretty
                      first-letter:font-display first-letter:italic
                      first-letter:text-[56px] first-letter:leading-[0.85]
                      first-letter:float-left first-letter:mr-3 first-letter:mt-1
                      first-letter:text-primary">
          Você está na Mesa{' '}
          <span className="font-mono">{String(MESA_ATUAL.numero).padStart(2, '0')}</span>.
          O quintal hoje tem{' '}
          <em className="font-display italic">{openCount} cozinhas</em> abertas.
          Monte seu pedido com itens de quantas quiser.
        </p>
      </section>

      <div className="px-5 pt-5 pb-1">
        <Divider label={`Hoje · ${now}`} />
      </div>

      <section className="px-5 pt-4 grid grid-cols-2 gap-x-3 gap-y-7">
        {KITCHENS.map((k, i) => (
          <KitchenCard key={k.id} kitchen={k} index={i} />
        ))}
      </section>

      <footer className="px-5 pt-8 pb-2">
        <Divider />
        <p className="mt-4 text-center font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Meu Quintal · {MESA_ATUAL.token}
        </p>
      </footer>
    </main>
  );
}
