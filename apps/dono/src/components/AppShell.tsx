import { useState, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const loc = useLocation();

  // Fecha drawer ao navegar
  useEffect(() => {
    setDrawerOpen(false);
  }, [loc.pathname]);

  // Trava scroll do body quando drawer aberto (mobile)
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <TopBar onMenuClick={() => setDrawerOpen(true)} />

      <div className="md:flex">
        {/* Backdrop mobile */}
        {drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 top-14 z-20 bg-ink/40 md:hidden"
            aria-hidden
          />
        )}

        {/* Sidebar: drawer no mobile, fixa no md+ */}
        <div
          className={[
            'fixed inset-y-0 left-0 top-14 z-30 w-60 transform transition-transform duration-base ease-out',
            'md:static md:translate-x-0 md:top-0 md:transition-none md:shrink-0',
            drawerOpen ? 'translate-x-0 shadow-sheet md:shadow-none' : '-translate-x-full md:translate-x-0',
          ].join(' ')}
        >
          <Sidebar />
        </div>

        <main className="flex-1 min-w-0">
          <div className="max-w-[1200px] mx-auto px-4 py-6 md:px-8 md:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
