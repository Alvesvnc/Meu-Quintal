import { useEffect, useMemo, useState } from 'react';

/**
 * Observa quais seções estão no viewport e devolve o id da primeira visível —
 * é o que sincroniza a TabBar do cardápio com a rolagem.
 *
 * Mora em arquivo próprio, e não junto do TabBar, porque o Fast Refresh do Vite
 * só preserva estado quando o módulo exporta apenas componentes. Com um hook no
 * meio, cada salvamento remontava a tela inteira e a rolagem voltava ao topo —
 * exatamente o que mais atrapalha ao ajustar esta tela.
 */
export function useActiveSection(ids: string[], topOffset = 120): string {
  const [active, setActive] = useState<string>(ids[0] ?? '');

  /**
   * O array `ids` chega novo a cada render (vem de um `.map()` no chamador),
   * então não serve como dependência: o efeito rodaria a cada render,
   * recriando o observer. A chave de texto é estável enquanto os ids forem os
   * mesmos.
   *
   * Precisa ser uma variável, não `ids.join(',')` escrito dentro do array de
   * dependências: o lint não consegue conferir expressão composta ali.
   */
  const chaveDosIds = useMemo(() => ids.join(','), [ids]);

  useEffect(() => {
    const lista = chaveDosIds ? chaveDosIds.split(',') : [];
    if (lista.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: `-${topOffset}px 0px -50% 0px`, threshold: 0 },
    );

    for (const id of lista) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }

    return () => obs.disconnect();
  }, [chaveDosIds, topOffset]);

  return active;
}
