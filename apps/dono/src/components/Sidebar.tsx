import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: 'Diário',
    items: [
      { to: '/',          label: 'Visão geral' },
      { to: '/pedidos',   label: 'Pedidos ao vivo' },
      { to: '/mesas',     label: 'Mesas' },
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
      { to: '/financeiro',  label: 'Repasses & receita' },
    ],
  },
  {
    label: 'Eu',
    items: [
      { to: '/conta',       label: 'Conta & equipe' },
    ],
  },
];

export function Sidebar() {
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
                    className={({ isActive }) => [
                      'block px-3 py-2 rounded-md font-sans text-body cursor-pointer',
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
