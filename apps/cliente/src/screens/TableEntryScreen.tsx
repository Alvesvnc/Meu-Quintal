import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setTableToken } from '../api/client';
import { disconnectSocket } from '../api/socket';

/**
 * Tela acessada via QR — `/m/:tableToken`.
 * Salva o token em localStorage e redireciona pra home (lista de cozinhas).
 */
export function TableEntryScreen() {
  const { tableToken = '' } = useParams<{ tableToken: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (tableToken) {
      setTableToken(tableToken);
      // Trocar de mesa troca a credencial: o socket aberto carrega o qrToken
      // anterior no handshake e continuaria autorizado como a mesa antiga.
      disconnectSocket();
    }
    navigate('/', { replace: true });
  }, [tableToken, navigate]);

  return (
    <main className="px-4 py-10">
      <p className="font-display text-display-md text-neutral-600">Entrando…</p>
    </main>
  );
}
