import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Pulso } from '@mq/design-system';
import { useAuth } from '../stores/auth';
import { useAbas } from './abas';

/**
 * Cabeçalho da cozinha: nome e se está aberta, com o relógio da parede.
 *
 * O contador de pedidos ativos saiu daqui. Ele repetia, em cinza e menor, o
 * que o placar logo abaixo já diz em 26px — e nas telas sem placar (cardápio,
 * conta) era um número sobre pedidos que a tela não estava mostrando.
 */
export function AppHeader() {
  const cozinha = useAuth((s) => s.me?.kitchen);
  const abas = useAbas();
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const aberta = cozinha?.status === 'ativa';

  return (
    <header className="sticky top-0 z-20 h-14 bg-bg border-b-rule border-divider">
      <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        <h1 className="font-display text-body-lg font-bold uppercase text-ink min-w-0 truncate">
          {cozinha?.name ?? 'Minha cozinha'}
        </h1>

        {/*
          NAVEGACAO DE MOUSE. `hidden mouse:flex` — so aparece pra quem aponta
          com mouse ou trackpad; no dedo a barra de baixo continua sendo a
          navegacao, com alvos grandes. Ver a variante `mouse:` no preset.

          Como `hidden` e `display: none`, a que estiver escondida sai tambem da
          arvore de acessibilidade: nunca ha duas navegacoes anunciadas ao mesmo
          tempo, mesmo com as duas no HTML.
        */}
        <nav aria-label="Seções" className="hidden mouse:flex items-center gap-1 mx-auto">
          {abas.map((a) => (
            <NavLink
              key={a.to}
              to={a.to}
              className={({ isActive }) =>
                [
                  'px-4 py-1.5 inline-flex items-center gap-2 cursor-pointer',
                  'font-display text-label font-bold uppercase',
                  'transition-colors duration-base ease-out',
                  isActive ? 'bg-accent text-bg' : 'text-neutral-700 hover:text-ink',
                ].join(' ')
              }
            >
              <a.icon size={16} strokeWidth={2} aria-hidden />
              {a.label}
              {a.badge && <span className="tabular">{a.badge}</span>}
            </NavLink>
          ))}
        </nav>

        <span className="shrink-0 inline-flex items-center gap-1.5 font-display text-label font-bold uppercase text-ink">
          {aberta && <Pulso />}
          <span className={aberta ? '' : 'text-neutral-600'}>{aberta ? 'Aberta' : 'Pausada'}</span>
          <span className="text-neutral-600">·</span>
          <span className="tabular" aria-label="Hora atual">
            {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
      </div>
    </header>
  );
}
