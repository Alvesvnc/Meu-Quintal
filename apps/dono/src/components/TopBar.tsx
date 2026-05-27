import { QUINTAL_INFO } from '../mocks/quintal';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
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
                       rounded-md hover:bg-surface transition-colors duration-base ease-out"
          >
            <span aria-hidden className="block w-5 h-[2px] bg-ink rounded-full" />
            <span aria-hidden className="block w-5 h-[2px] bg-ink rounded-full" />
            <span aria-hidden className="block w-5 h-[2px] bg-ink rounded-full" />
          </button>

          <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-primary text-white font-mono text-mono-sm" aria-hidden>
            Q
          </span>
          <span className="font-display italic text-body-lg text-ink truncate">
            Meu Quintal
          </span>
          <span className="font-mono text-mono-sm text-inkDim hidden sm:inline">
            admin
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="font-sans text-body text-inkMuted hidden sm:inline">
            {QUINTAL_INFO.ownerName}
          </span>
          <button
            type="button"
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
