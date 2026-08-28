import { Chip, Logo } from '@mq/design-system';

interface AppHeaderProps {
  mesaNumero: number;
}

/**
 * Cabeçalho de marca — telas que são "casa": cozinhas, carrinho, pedidos.
 *
 * Só marca e mesa. O carrinho saiu daqui: ele agora tem célula própria na
 * barra de baixo e faixa fixa no cardápio, e um terceiro lugar pra mesma
 * coisa só disputava atenção com o título da tela.
 *
 * As telas de dentro (cardápio, item, acompanhar) usam `TelaHeader`, que troca
 * a marca por voltar + contexto.
 */
export function AppHeader({ mesaNumero }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 h-14 bg-bg border-b-rule border-divider">
      <div className="h-full px-4 flex items-center justify-between gap-3">
        <Logo size={18} />
        <Chip tone="outline">Mesa {String(mesaNumero).padStart(2, '0')}</Chip>
      </div>
    </header>
  );
}
