import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DonoMeResponse } from '@mq/shared';

interface AuthState {
  me: DonoMeResponse | null;
  setMe: (me: DonoMeResponse | null) => void;

  /**
   * Quintal selecionado (slug). Uma conta pode ter mais de um espaço, e todas
   * as rotas aceitam `?espaco=`.
   */
  espaco: string | null;
  setEspaco: (slug: string | null) => void;
}

/**
 * Perfil do dono logado. O token vive em localStorage separado (api/client.ts);
 * aqui fica só o que a interface precisa desenhar, refrescado por
 * `/api/a/auth/me`.
 *
 * `me` é cache, nunca autoridade: quem decide o que este usuário pode fazer é o
 * servidor, que relê papel e vínculo do banco a cada request. Esconder um botão
 * porque `me.role` diz "staff" é conveniência de tela — a porta continua
 * trancada do outro lado.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      me: null,
      setMe: (me) => set({ me }),
      espaco: null,
      setEspaco: (espaco) => set({ espaco }),
    }),
    { name: 'mq:a:auth' },
  ),
);

/** O quintal em uso: o escolhido, ou o primeiro da conta. */
export function useEspacoAtual(): string | null {
  const escolhido = useAuth((s) => s.espaco);
  const primeiro = useAuth((s) => s.me?.spaces[0]?.slug ?? null);
  return escolhido ?? primeiro;
}

/** `true` quando a conta é de restaurante único — muda a linguagem das telas. */
export function useRestauranteUnico(): boolean {
  const espaco = useEspacoAtual();
  const spaces = useAuth((s) => s.me?.spaces);
  return spaces?.find((s) => s.slug === espaco)?.tipo === 'restaurante-unico';
}
