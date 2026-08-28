import { useNavigate } from 'react-router-dom';
import { LogoIcone } from '@mq/design-system';
import { clearToken } from '../api/client';
import { useAuth, useEspacoAtual } from '../stores/auth';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const navigate = useNavigate();
  const setMe = useAuth((s) => s.setMe);
  const setEspaco = useAuth((s) => s.setEspaco);
  const nome = useAuth((s) => s.me?.name ?? s.me?.email ?? null);
  const espacoAtual = useEspacoAtual();
  const espaco = useAuth((s) => s.me?.spaces.find((e) => e.slug === espacoAtual));

  const sair = () => {
    clearToken();
    setMe(null);
    // O quintal escolhido pertence a conta que esta saindo: deixar pendurado
    // faria o proximo login abrir no espaco de outra pessoa.
    setEspaco(null);
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-14 border-b border-hairline bg-bg sticky top-0 z-40">
      <div className="h-full px-4 md:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger só em mobile */}
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Abrir menu"
            className="md:hidden -ml-1 w-10 h-10 flex flex-col items-center justify-center gap-[3px] cursor-pointer
                       hover:bg-surface transition-colors duration-base ease-out"
          >
            <span aria-hidden className="block w-5 h-[2px] bg-ink" />
            <span aria-hidden className="block w-5 h-[2px] bg-ink" />
            <span aria-hidden className="block w-5 h-[2px] bg-ink" />
          </button>

          <LogoIcone size={22} />
          <span className="font-display text-body-lg text-ink truncate">
            {espaco?.name ?? 'QRO'}
          </span>
          <span className="font-mono text-mono-sm text-inkDim hidden sm:inline">admin</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="font-sans text-body text-inkMuted hidden sm:inline">{nome}</span>
          <button
            type="button"
            onClick={sair}
            className="font-mono text-mono-sm uppercase tracking-wider text-inkDim cursor-pointer
                       hover:text-danger transition-colors duration-base ease-out"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
