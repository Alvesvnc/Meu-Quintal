import { NavLink, useLocation } from 'react-router-dom';
import { useAbas } from './abas';

export const TABS_HEIGHT = 64;

/**
 * Barra de abas da cozinha — mesma anatomia da do cliente: régua de 2px,
 * células divididas por 1px, ativa em bloco vermelho sólido.
 *
 * Opaca, e não translúcida com blur: na bancada a tela costuma estar apoiada e
 * vista de cima, e o conteúdo aparecendo por baixo sujava justamente a região
 * onde o polegar procura a aba.
 */
export function BottomTabs() {
  const loc = useLocation();
  const tabs = useAbas();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-20 bg-bg pointer-events-none mouse:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/*
        Acompanha o container do app, com teto proprio: numa tela larga, tres
        botoes esticados por 1400px viram alvos absurdos e o olho perde a
        relacao entre eles. 720px mantem a barra legivel e confortavel pro
        polegar no tablet.
      */}
      <div className="mx-auto w-full max-w-[720px] bg-bg border-t-rule border-divider pointer-events-auto">
        <ul className="grid grid-cols-3">
          {tabs.map((t, i) => {
            const active = loc.pathname.startsWith(t.to);
            const Icone = t.icon;
            return (
              <li key={t.to} className={i > 0 ? 'border-l border-divider' : ''}>
                <NavLink
                  to={t.to}
                  className={[
                    'flex flex-col justify-center gap-1 px-4 py-3 cursor-pointer no-underline',
                    'transition-colors duration-base ease-out',
                    active ? 'bg-accent text-bg' : 'text-neutral-700 hover:text-ink',
                  ].join(' ')}
                  style={{ height: TABS_HEIGHT }}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="flex items-start gap-1.5">
                    <Icone size={22} strokeWidth={2} aria-hidden />
                    {t.badge && (
                      <span
                        className={[
                          'px-1.5 font-display text-label-sm font-bold tabular leading-[1.4]',
                          active ? 'bg-bg text-accent' : 'bg-accent text-bg',
                        ].join(' ')}
                      >
                        {t.badge}
                      </span>
                    )}
                  </span>
                  <span className="font-display text-label font-bold uppercase">{t.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
