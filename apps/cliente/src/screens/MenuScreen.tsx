import { useMemo } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { Button, Divider } from '@mq/design-system';
import type { MenuCategory } from '@mq/shared';
import { useKitchenMenu } from '../api/hooks';
import { useRestauranteUnico } from '../lib/useTipoDeEspaco';
import { TabBar } from '../components/TabBar';
import { useActiveSection } from '../lib/useActiveSection';
import { MenuItemRow } from '../components/MenuItemRow';
import { ScreenError } from '../components/ScreenError';
import { useCart, selectItemCount, selectTotalCents } from '../stores/cart';
import { fmtBRL } from '../lib/format';

const CATEGORY_LABEL: Record<MenuCategory, string> = {
  entradas:   'Entradas',
  pratos:     'Pratos',
  sobremesas: 'Sobremesas',
  bebidas:    'Bebidas',
};
const ORDER: MenuCategory[] = ['entradas', 'pratos', 'sobremesas', 'bebidas'];

/** Tela 02 — Cardápio de uma cozinha. */
export function MenuScreen() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const restauranteUnico = useRestauranteUnico();
  const { data, isLoading, error, refetch } = useKitchenMenu(slug);
  const cartCount = useCart(selectItemCount);
  const cartTotal = useCart(selectTotalCents);

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<MenuCategory, typeof data.items>();
    for (const c of ORDER) map.set(c, []);
    for (const item of data.items) map.get(item.category)?.push(item);
    return ORDER
      .filter((c) => (map.get(c)?.length ?? 0) > 0)
      .map((c) => ({ id: c, label: CATEGORY_LABEL[c], items: map.get(c)! }));
  }, [data]);

  const activeId = useActiveSection(grouped.map((g) => g.id));

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <main className="px-5 pt-8 text-center">
        <p className="font-display italic text-display-md text-inkMuted">Carregando cardápio…</p>
      </main>
    );
  }

  if (error) {
    return (
      <ScreenError
        title="Não rolou abrir esse cardápio."
        body="Pode ser que a cozinha esteja fechando o turno."
        onRetry={() => refetch()}
      />
    );
  }

  if (!data) {
    return (
      <main className="px-5 py-10">
        <p className="font-display italic text-display-md text-ink">Essa cozinha saiu do quintal.</p>
      </main>
    );
  }

  if (data.items.length === 0) {
    return (
      <main className="px-5 py-10">
        <p className="font-display italic text-display-md text-ink mb-5 text-pretty">
          O {data.kitchen.name} ainda está montando o cardápio aqui.
        </p>
        {/*
          Num restaurante unico nao ha pra onde voltar: `/` redireciona pra
          esta mesma tela. Botao que nao faz nada e pior que botao nenhum.
        */}
        {!restauranteUnico && (
          <Button variant="secondary" size="lg" fullWidth onClick={() => navigate('/')}>
            Voltar pro quintal
          </Button>
        )}
      </main>
    );
  }

  return (
    <>
      <section className="px-5 pt-5">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Cozinha · ~{data.kitchen.slaMinutes} min
        </p>
        <h1 className="font-display text-display-lg italic text-ink mt-1 leading-tight">
          {data.kitchen.name}
        </h1>
        {data.kitchen.tagline && (
          <p className="mt-2 font-sans text-body text-inkMuted">{data.kitchen.tagline}</p>
        )}
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
                <MenuItemRow
                  key={item.id}
                  item={item}
                  kitchen={{ slug: data.kitchen.slug, name: data.kitchen.name }}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 pointer-events-none">
          <div className="mx-auto max-w-[480px] px-5 py-3 bg-bg/95 backdrop-blur-[2px] border-t border-hairlineSoft pointer-events-auto">
            <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/carrinho')}>
              <span className="flex-1 text-left">
                Ver carrinho · {cartCount} {cartCount === 1 ? 'item' : 'itens'}
              </span>
              <span className="font-mono">{fmtBRL(cartTotal)}</span>
            </Button>
          </div>
        </div>
      )}

      <Outlet />
    </>
  );
}
