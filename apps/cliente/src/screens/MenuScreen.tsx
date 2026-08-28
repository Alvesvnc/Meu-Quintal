import { useMemo, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { Button, Chip } from '@mq/design-system';
import { Clock, Flame, ShoppingBasket } from 'lucide-react';
import { useKitchenMenu, useQuintal } from '../api/hooks';
import { useRestauranteUnico } from '../lib/useTipoDeEspaco';
import { TelaHeader } from '../components/TelaHeader';
import { TabBar } from '../components/TabBar';
import { FaixaFixa } from '../components/FaixaFixa';
import { Foto } from '../components/Foto';
import { useActiveSection } from '../lib/useActiveSection';
import { alturaDasSecoes } from '../lib/gradeDeSecoes';
import { MenuItemCard } from '../components/MenuItemCard';
import { MenuItemRow } from '../components/MenuItemRow';
import { ScreenError } from '../components/ScreenError';
import { useCart, selectItemCount, selectTotalCents } from '../stores/cart';
import { fmtBRL, fmtBRLShort } from '../lib/format';
import { fotosDoItem } from '../lib/fotos';

/** Altura do cabeçalho grudado no topo. A linha de seções vem somada a ela. */
const ALTURA_DO_CABECALHO = 56;

const CHAVE_DO_LAYOUT = 'mq:cardapio-layout';

type Layout = 'grade' | 'lista';

/** Preferência de quem usa. Grade é o padrão; a lista é escolha explícita. */
function layoutSalvo(): Layout | null {
  try {
    const v = localStorage.getItem(CHAVE_DO_LAYOUT);
    return v === 'grade' || v === 'lista' ? v : null;
  } catch {
    // Modo privado do Safari lança ao ler `localStorage`. Sem preferência
    // salva o cardápio continua abrindo — só não lembra da escolha.
    return null;
  }
}

/** Tela 02 — Cardápio de uma cozinha. */
export function MenuScreen() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const restauranteUnico = useRestauranteUnico();
  const { data, isLoading, error, refetch } = useKitchenMenu(slug);
  const { data: quintal } = useQuintal();
  const cartCount = useCart(selectItemCount);
  const cartTotal = useCart(selectTotalCents);
  const [layoutEscolhido, setLayoutEscolhido] = useState<Layout | null>(layoutSalvo);

  /**
   * As seções vêm do servidor, na ordem que a própria cozinha escolheu — não
   * de uma lista fixa daqui. Até 2026-08-27 eram quatro nomes cravados no app,
   * e uma padaria tinha que chamar pão de "Pratos".
   *
   * Seção vazia não vira aba: a cozinha pode ter criado "Especiais de sábado"
   * e ainda não ter posto nada lá — uma aba que rola pra lugar nenhum é pior
   * que a ausência dela.
   */
  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, typeof data.items>();
    for (const c of data.categorias) map.set(c.id, []);
    for (const item of data.items) map.get(item.categoriaId)?.push(item);
    return data.categorias
      .filter((c) => (map.get(c.id)?.length ?? 0) > 0)
      .map((c) => ({ id: c.id, label: c.name, items: map.get(c.id)! }));
  }, [data]);

  /**
   * Cardápio sem foto nenhuma vira uma parede de blocos cinzas iguais na
   * grade — a lista compacta lê melhor. A escolha explícita de quem usa ganha
   * dessa heurística; ela só decide quando ninguém decidiu.
   */
  const temFoto = useMemo(() => (data?.items ?? []).some((i) => fotosDoItem(i).length > 0), [data]);
  const layout: Layout = layoutEscolhido ?? (temFoto ? 'grade' : 'lista');

  const trocarLayout = () => {
    const proximo: Layout = layout === 'grade' ? 'lista' : 'grade';
    setLayoutEscolhido(proximo);
    try {
      localStorage.setItem(CHAVE_DO_LAYOUT, proximo);
    } catch {
      // Ver `layoutSalvo`: não poder guardar não impede de trocar agora.
    }
  };

  const cozinha = quintal?.kitchens.find((k) => k.slug === slug);
  const mesaNumero = quintal?.table.numero;

  const faixaDePreco = useMemo(() => {
    const precos = (data?.items ?? []).map((i) => i.priceCents);
    if (precos.length === 0) return null;
    const min = Math.min(...precos);
    const max = Math.max(...precos);
    if (min === max) return fmtBRLShort(min);
    return `${fmtBRLShort(min)}–${fmtBRLShort(max).replace('R$', '').trim()}`;
  }, [data]);

  /**
   * O topo grudado cresce com o número de seções: a linha de seções quebra em
   * várias quando a cozinha cria muitas. Fixar em 100 (o valor de quando eram
   * quatro, sempre numa linha) faria a rolagem parar com o título da seção
   * escondido atrás dela.
   */
  const topoGrudado = ALTURA_DO_CABECALHO + alturaDasSecoes(grouped.length);

  const activeId = useActiveSection(
    grouped.map((g) => g.id),
    topoGrudado + 8,
  );

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - topoGrudado - 8;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <main className="px-4 pt-8">
        <p className="font-display text-display-md text-neutral-600">Carregando cardápio…</p>
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
      <main className="px-4 py-10">
        <h1 className="font-display text-display-md text-ink">Essa cozinha saiu do quintal.</h1>
      </main>
    );
  }

  const voltar = restauranteUnico ? undefined : '/';

  if (data.items.length === 0) {
    return (
      <>
        <TelaHeader voltarPara={voltar} titulo={data.kitchen.name.toUpperCase()} />
        <main className="px-4 py-10">
          <h1 className="font-display text-display-md text-ink text-pretty">
            O {data.kitchen.name} ainda está montando o cardápio aqui.
          </h1>
          {/*
            Num restaurante unico nao ha pra onde voltar: `/` redireciona pra
            esta mesma tela. Botao que nao faz nada e pior que botao nenhum.
          */}
          {!restauranteUnico && (
            <div className="mt-6">
              <Button variant="secondary" size="lg" fullWidth onClick={() => navigate('/')}>
                Voltar pro quintal
              </Button>
            </div>
          )}
        </main>
      </>
    );
  }

  return (
    <>
      <TelaHeader
        voltarPara={voltar}
        titulo={data.kitchen.name.toUpperCase()}
        direita={
          mesaNumero ? <Chip tone="outline">Mesa {String(mesaNumero).padStart(2, '0')}</Chip> : null
        }
      />

      <Foto
        src={data.kitchen.photoUrl}
        alt={`Foto da cozinha ${data.kitchen.name}`}
        eager
        className="h-[170px] w-full border-b-rule border-divider"
      />

      <div
        className="flex items-center gap-4 px-4 py-3 border-b border-divider
                   font-display text-label font-bold uppercase"
      >
        {cozinha?.category && (
          <span className="flex items-center gap-1.5 text-accent-700">
            <Flame size={14} strokeWidth={2} aria-hidden />
            {cozinha.category}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-ink tabular">
          <Clock size={14} strokeWidth={2} aria-hidden />~{data.kitchen.slaMinutes} min
        </span>
        {faixaDePreco && <span className="ml-auto text-neutral-600 tabular">{faixaDePreco}</span>}
      </div>

      <TabBar
        tabs={grouped.map((g) => ({ id: g.id, label: g.label }))}
        activeId={activeId}
        onSelect={scrollToSection}
      />

      <main className={cartCount > 0 ? 'pb-24' : 'pb-8'}>
        {grouped.map((g, gi) => (
          <section
            key={g.id}
            id={g.id}
            className="px-4 pt-5"
            style={{ scrollMarginTop: topoGrudado + 8 }}
          >
            <p className="font-display text-label font-bold uppercase text-accent-700 mb-3">
              {g.label} · <span className="tabular">{g.items.length}</span>
            </p>

            {layout === 'grade' ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-6">
                {g.items.map((item, i) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    kitchen={{ slug: data.kitchen.slug, name: data.kitchen.name }}
                    eager={gi === 0 && i < 2}
                  />
                ))}
              </div>
            ) : (
              <div>
                {g.items.map((item) => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    kitchen={{ slug: data.kitchen.slug, name: data.kitchen.name }}
                  />
                ))}
              </div>
            )}
          </section>
        ))}

        <div className="px-4 pt-8">
          <button
            type="button"
            onClick={trocarLayout}
            className="font-display text-label font-bold uppercase text-neutral-600
                       cursor-pointer hover:text-accent transition-colors duration-base ease-out"
          >
            {layout === 'grade' ? 'Ver como lista' : 'Ver como grade'}
          </button>
        </div>
      </main>

      {cartCount > 0 && (
        <FaixaFixa>
          <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/carrinho')}>
            <ShoppingBasket size={18} strokeWidth={2} aria-hidden className="shrink-0" />
            <span>
              Ver carrinho · <span className="tabular">{cartCount}</span>
            </span>
            <span className="ml-auto tabular">{fmtBRL(cartTotal)}</span>
          </Button>
        </FaixaFixa>
      )}

      <Outlet />
    </>
  );
}
