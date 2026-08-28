import { NavLink } from 'react-router-dom';

interface SidebarProps {
  /**
   * Chamado quando o usuario clica num link. O AppShell usa pra fechar o
   * drawer no mobile — fechar aqui, no evento, e mais direto do que reagir
   * depois a mudanca de rota.
   */
  onNavegar?: () => void;
}

interface NavItem {
  to: string;
  label: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * "Cobrancas", nunca "repasses": o dinheiro nao passa pelo app. Cada cozinha
 * cobra o cliente no proprio caixa e DEVE comissao + aluguel ao quintal no fim
 * do ciclo. O rotulo antigo dizia o contrario.
 */
const SECTIONS: NavSection[] = [
  {
    label: 'Diário',
    items: [
      { to: '/',       label: 'Visão geral' },
      { to: '/mesas',  label: 'Mesas' },
    ],
  },
  {
    label: 'Configurar',
    items: [
      { to: '/restaurantes',       label: 'Restaurantes' },
      { to: '/restaurantes/novo',  label: 'Adicionar cozinha' },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { to: '/financeiro',  label: 'Cobranças & receita' },
    ],
  },
  {
    label: 'Eu',
    items: [
      { to: '/conta',       label: 'Conta' },
    ],
  },
];

export function Sidebar({ onNavegar }: SidebarProps = {}) {
  return (
    <aside className="w-60 h-full md:min-h-[calc(100dvh-56px)] bg-bg border-r border-hairline overflow-y-auto">
      <nav aria-label="Navegação principal" className="p-4">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mt-5 first:mt-0">
            <p className="px-3 mb-2 font-mono text-label uppercase tracking-wider text-inkDim">
              {section.label}
            </p>
            <ul>
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavegar}
                    className={({ isActive }) => [
                      'block px-3 py-2 font-sans text-body cursor-pointer',
                      'transition-colors duration-base ease-out',
                      'border-l-2',
                      isActive
                        ? 'border-l-primary bg-primaryWash text-primary font-medium'
                        : 'border-l-transparent text-inkMuted hover:bg-surface hover:text-ink',
                    ].join(' ')}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
