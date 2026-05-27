import { useMemo } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { Button, Divider } from '@mq/design-system';
import { KITCHENS } from '../mocks/quintal';
import { getMenuBySlug, CATEGORY_LABEL, fmtBRL, type Category } from '../mocks/menu';
import { TabBar, useActiveSection } from '../components/TabBar';
import { MenuItemRow } from '../components/MenuItemRow';
import { useCart, selectItemCount, selectTotalCents } from '../stores/cart';

const ORDER: Category[] = ['entradas', 'pratos', 'sobremesas', 'bebidas'];

/**
 * Tela 02 — Cardápio de uma cozinha.
 * pages/cliente.md § "Cardápio de uma cozinha".
 */
export function MenuScreen() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const kitchen = KITCHENS.find((k) => k.slug === slug);
  const menu = getMenuBySlug(slug);
  const cartCount = useCart(selectItemCount);
  const cartTotal = useCart(selectTotalCents);

  const grouped = useMemo(() => {
    const map = new Map<Category, typeof menu>();
    for (const c of ORDER) map.set(c, []);
    for (const item of menu) map.get(item.category)?.push(item);
    return ORDER.filter((c) => (map.get(c)?.length ?? 0) > 0).map((c) => ({
      id: c,
      label: CATEGORY_LABEL[c],
      items: map.get(c)!,
    }));
  }, [menu]);

  const activeId = useActiveSection(grouped.map((g) => g.id));

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 110; // header 56 + tabs 48 + folga
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  if (!kitchen) {
    return (
      <main className="px-5 py-10">
        <p className="font-display italic text-display-md text-ink">
          Essa cozinha saiu do quintal.
        </p>
      </main>
    );
  }

  if (menu.length === 0) {
    return (
      <main className="px-5 py-10">
        <p className="font-display italic text-display-md text-ink mb-5 text-pretty">
          O {kitchen.name} ainda está montando o cardápio aqui.
        </p>
        <Button variant="secondary" size="lg" fullWidth onClick={() => navigate('/')}>
          Voltar pro quintal
        </Button>
      </main>
    );
  }

  return (
    <>
      {/* Hero curta da cozinha */}
      <section className="px-5 pt-5">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Cozinha · ~{kitchen.etaMinutes} min
        </p>
        <h1 className="font-display text-display-lg italic text-ink mt-1 leading-tight">
          {kitchen.name}
        </h1>
        <p className="mt-2 font-sans text-body text-inkMuted">
          {kitchen.tagline}
        </p>
      </section>

      <div className="px-5 pt-5">
        <Divider />
      </div>

      <TabBar
        tabs={grouped.map((g) => ({ id: g.id, label: g.label }))}
        activeId={activeId}
        onSelect={scrollToSection}
      />

      <main className={cartCount > 0 ? 'pb-44' : 'pb-24'}>
        {grouped.map((g) => (
          <section key={g.id} id={g.id} className="px-5 pt-6 scroll-mt-28">
            <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-2">
              {g.label}
            </p>
            <div className="divide-y divide-hairlineSoft">
              {g.items.map((item) => (
                <MenuItemRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Sumário sticky bottom — só aparece se carrinho > 0; fica acima das tabs (bottom-16) */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 pointer-events-none">
          <div className="mx-auto max-w-[480px] px-5 py-3 bg-bg/95 backdrop-blur-[2px] border-t border-hairlineSoft pointer-events-auto">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate('/carrinho')}
            >
              <span className="flex-1 text-left">
                Ver carrinho · {cartCount} {cartCount === 1 ? 'item' : 'itens'}
              </span>
              <span className="font-mono">{fmtBRL(cartTotal)}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Item detail sheet (route aninhada /k/:slug/i/:itemId) */}
      <Outlet />
    </>
  );
}
