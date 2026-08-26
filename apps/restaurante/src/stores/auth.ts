import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KitchenMeResponse } from '@mq/shared';

interface AuthState {
  me: KitchenMeResponse | null;
  setMe: (me: KitchenMeResponse | null) => void;
}

/**
 * Cache local do perfil da cozinha logada. O token vive em localStorage
 * separado (api/client.ts), e `me` aqui e refrescado via /api/r/auth/me.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      me: null,
      setMe: (me) => set({ me }),
    }),
    { name: 'mq:r:auth' },
  ),
);
