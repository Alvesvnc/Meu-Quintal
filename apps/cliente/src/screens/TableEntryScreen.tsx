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
    <main className="px-5 py-12 text-center">
      <p className="font-display italic text-display-md text-inkMuted">Entrando…</p>
    </main>
  );
}
