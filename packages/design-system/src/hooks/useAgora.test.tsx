import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAgora, useMinutosDesde } from './useAgora';

/**
 * O `useAgora` substituiu `Date.now()` no corpo do render em três telas
 * (OrderCard, TrackScreen, PedidosLiveScreen). O que ele promete e que estes
 * testes verificam:
 *
 *   1. o valor ANDA sozinho — era o bug: o cronometro ficava congelado
 *   2. ha UM timer para todos os assinantes, nao um por componente
 *   3. o timer morre quando o ultimo componente desmonta
 *   4. voltar pra aba ressincroniza na hora
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // OBRIGATORIO aqui: o hook guarda timer e assinantes em estado de MODULO.
  // Sem desmontar, um teste deixa o timer vivo e o proximo ve um estado que
  // nao criou — foi o que quebrou os testes de "um timer so" e de limpeza.
  // A limpeza automatica do Testing Library so acontece com `globals: true`.
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const INTERVALO = 20_000;

describe('useAgora', () => {
  it('anda sozinho, sem nada causar re-render', () => {
    const { result } = renderHook(() => useAgora());
    const inicial = result.current;

    act(() => {
      vi.advanceTimersByTime(INTERVALO);
    });

    // Era exatamente isto que faltava: sem o hook, o valor so mudava quando
    // outra coisa qualquer forcava um render.
    expect(result.current).toBeGreaterThan(inicial);
  });

  it('nao muda antes do intervalo', () => {
    const { result } = renderHook(() => useAgora());
    const inicial = result.current;

    act(() => {
      vi.advanceTimersByTime(INTERVALO - 1000);
    });

    expect(result.current).toBe(inicial);
  });

  it('UM timer para varios assinantes', () => {
    const criarIntervalo = vi.spyOn(globalThis, 'setInterval');

    const a = renderHook(() => useAgora());
    const b = renderHook(() => useAgora());
    const c = renderHook(() => useAgora());

    // A fila da cozinha mostra dezenas de cards ao mesmo tempo. Um timer por
    // card seriam dezenas de timers acordando o aparelho fora de sincronia.
    expect(criarIntervalo).toHaveBeenCalledTimes(1);

    a.unmount();
    b.unmount();
    c.unmount();
  });

  it('todos os assinantes recebem o mesmo valor', () => {
    const a = renderHook(() => useAgora());
    const b = renderHook(() => useAgora());

    act(() => {
      vi.advanceTimersByTime(INTERVALO);
    });

    expect(a.result.current).toBe(b.result.current);

    a.unmount();
    b.unmount();
  });

  it('o timer morre quando o ultimo desmonta', () => {
    const limparIntervalo = vi.spyOn(globalThis, 'clearInterval');

    const a = renderHook(() => useAgora());
    const b = renderHook(() => useAgora());

    a.unmount();
    // Ainda ha alguem ouvindo
    expect(limparIntervalo).not.toHaveBeenCalled();

    b.unmount();
    expect(limparIntervalo).toHaveBeenCalled();
  });

  it('remonta depois de todos saírem', () => {
    const a = renderHook(() => useAgora());
    a.unmount();

    const b = renderHook(() => useAgora());
    const inicial = b.result.current;

    act(() => {
      vi.advanceTimersByTime(INTERVALO);
    });

    expect(b.result.current).toBeGreaterThan(inicial);
    b.unmount();
  });

  it('voltar pra aba ressincroniza na hora', () => {
    const { result } = renderHook(() => useAgora());
    const inicial = result.current;

    // Navegador estrangula timer em aba oculta: ao voltar, o relogio estaria
    // atrasado sem este resync.
    act(() => {
      vi.advanceTimersByTime(5_000);
      vi.setSystemTime(new Date(Date.now() + 300_000));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current).toBeGreaterThan(inicial + 200_000);
  });
});

describe('useMinutosDesde', () => {
  it('calcula minutos inteiros', () => {
    const inicio = new Date('2026-08-24T12:00:00Z');
    vi.setSystemTime(new Date('2026-08-24T12:07:30Z'));

    const { result } = renderHook(() => useMinutosDesde(inicio.toISOString()));
    expect(result.current).toBe(7);
  });

  it('null quando nao ha inicio', () => {
    expect(renderHook(() => useMinutosDesde(null)).result.current).toBeNull();
    expect(renderHook(() => useMinutosDesde(undefined)).result.current).toBeNull();
  });

  it('null quando a data e invalida', () => {
    expect(renderHook(() => useMinutosDesde('nao e data')).result.current).toBeNull();
  });

  it('nunca devolve negativo', () => {
    // Relogio do cliente atrasado em relacao ao servidor: sem o clamp, a tela
    // mostraria "ha -2 min", que e pior do que mostrar zero.
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'));
    const futuro = new Date('2026-08-24T12:05:00Z').toISOString();

    expect(renderHook(() => useMinutosDesde(futuro)).result.current).toBe(0);
  });

  it('aceita Date, string ISO e timestamp', () => {
    vi.setSystemTime(new Date('2026-08-24T12:10:00Z'));
    const inicio = new Date('2026-08-24T12:00:00Z');

    expect(renderHook(() => useMinutosDesde(inicio)).result.current).toBe(10);
    expect(renderHook(() => useMinutosDesde(inicio.toISOString())).result.current).toBe(10);
    expect(renderHook(() => useMinutosDesde(inicio.getTime())).result.current).toBe(10);
  });

  it('o numero sobe sozinho com o passar do tempo', () => {
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'));
    const inicio = new Date('2026-08-24T12:00:00Z').toISOString();

    const { result } = renderHook(() => useMinutosDesde(inicio));
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(3 * 60_000);
    });

    expect(result.current).toBe(3);
  });
});
