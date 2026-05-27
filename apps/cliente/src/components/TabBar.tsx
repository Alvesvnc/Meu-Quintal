import { useEffect, useRef, useState } from 'react';

interface Tab {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  /** id da seção atualmente visível na tela (controlado externamente via IntersectionObserver). */
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Tabs sticky horizontais. Mantém o ativo visível via scrollIntoView.
 * Estilo editorial: hairline-bottom, item ativo com border-bottom primary 2px.
 */
export function TabBar({ tabs, activeId, onSelect }: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const el = refs.current[activeId];
    if (el && containerRef.current) {
      el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }, [activeId]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className="sticky top-14 z-10 bg-bg border-b border-hairlineSoft overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="flex gap-1 px-3 min-w-max">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[t.id] = el; }}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(t.id)}
              className={[
                'relative h-12 px-3 font-sans text-body cursor-pointer whitespace-nowrap',
                'transition-colors duration-base ease-out',
                active ? 'text-ink' : 'text-inkDim hover:text-ink',
              ].join(' ')}
            >
              {t.label}
              <span
                aria-hidden
                className={[
                  'absolute left-3 right-3 bottom-0 h-[2px] rounded-t-sm',
                  'transition-colors duration-base ease-out',
                  active ? 'bg-primary' : 'bg-transparent',
                ].join(' ')}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hook que observa quais sections estão no viewport e devolve o id da
 * primeira visível — pra sincronizar com a TabBar.
 */
export function useActiveSection(ids: string[], topOffset = 120): string {
  const [active, setActive] = useState<string>(ids[0] ?? '');

  useEffect(() => {
    if (ids.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: `-${topOffset}px 0px -50% 0px`, threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids.join(','), topOffset]);

  return active;
}
