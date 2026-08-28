import { Routes, Route, useLocation } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { BottomTabs, TABS_HEIGHT } from './components/BottomTabs';
import { LandingScreen } from './screens/LandingScreen';
import { MenuScreen } from './screens/MenuScreen';
import { ItemDetailSheet } from './screens/ItemDetailSheet';
import { CartScreen } from './screens/CartScreen';
import { TrackScreen } from './screens/TrackScreen';
import { OrdersListScreen } from './screens/OrdersListScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { TableEntryScreen } from './screens/TableEntryScreen';
import { NoTableScreen } from './screens/NoTableScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { useQuintal, useAssinaturaDosPedidos } from './api/hooks';
import { getTableToken } from './api/client';

export function App() {
  const loc = useLocation();
  const isEntry = loc.pathname.startsWith('/m/');

  // Mesa vem da API (não mais do mock). Antes do primeiro fetch usa fallback.
  const { data: quintal } = useQuintal();
  const mesaNumero = quintal?.table.numero ?? 0;
  const hasToken = !!getTableToken();

  /**
   * Cardápio, item e acompanhar desenham o PRÓPRIO cabeçalho (`TelaHeader`):
   * ali o topo não é a marca, é voltar + contexto — o nome da cozinha, o
   * `#A2F4 · MESA 07`. Esse contexto mora na tela, não aqui, e passá-lo por
   * props obrigaria o App a buscar cozinha e pedido só pra escrever um título.
   */
  const headerProprio =
    loc.pathname.startsWith('/k/') || loc.pathname.startsWith('/pedido/');

  // Tempo real dos pedidos ativos mora aqui, e nao na tela de detalhe: o App e
  // o unico ponto que continua montado em qualquer rota, entao o cancelamento
  // de um item chega mesmo com o cliente parado no cardapio.
  useAssinaturaDosPedidos();

  // Tela de entrada (/m/:token) e quando não tem token: layout sem header/tabs
  if (isEntry || (!hasToken && !isEntry)) {
    return (
      <div className="min-h-screen mx-auto max-w-[480px] bg-bg">
        <Routes>
          <Route path="/m/:tableToken" element={<TableEntryScreen />} />
          <Route path="*" element={<NoTableScreen />} />
        </Routes>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen mx-auto max-w-[480px] bg-bg"
      // A barra e `fixed`: sem reservar a altura dela aqui, o fim de toda
      // pagina fica escondido atras da barra. Some a faixa de gestos do iPhone
      // porque o <nav> tambem a soma no proprio padding.
      style={{ paddingBottom: `calc(${TABS_HEIGHT}px + env(safe-area-inset-bottom))` }}
    >
      {!headerProprio && <AppHeader mesaNumero={mesaNumero} />}
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/k/:slug" element={<MenuScreen />}>
          <Route path="i/:itemId" element={<ItemDetailSheet />} />
        </Route>
        <Route path="/carrinho" element={<CartScreen />} />
        <Route path="/pedidos" element={<OrdersListScreen />} />
        <Route path="/pedido/:orderId" element={<TrackScreen />} />
        <Route path="/pedido/:orderId/avaliar" element={<ReviewScreen />} />
        <Route path="*" element={<PlaceholderScreen title="Página não encontrada" />} />
      </Routes>
      <BottomTabs />
    </div>
  );
}
