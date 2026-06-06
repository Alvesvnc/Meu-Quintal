import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setTableToken } from '../api/client';

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
    }
    navigate('/', { replace: true });
  }, [tableToken, navigate]);

  return (
    <main className="px-5 py-12 text-center">
      <p className="font-display italic text-display-md text-inkMuted">Entrando…</p>
    </main>
  );
}
