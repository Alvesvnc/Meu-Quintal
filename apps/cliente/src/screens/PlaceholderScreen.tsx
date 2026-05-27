import { useParams, Link } from 'react-router-dom';
import { Button } from '@mq/design-system';

/** Stub para telas ainda não implementadas (cardapio, carrinho, etc). */
export function PlaceholderScreen({ title }: { title: string }) {
  const params = useParams();
  return (
    <main className="px-5 py-10 max-w-md mx-auto">
      <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim mb-3">
        Tela em construção
      </p>
      <h1 className="font-display italic text-display-lg leading-tight text-pretty">
        {title}
      </h1>
      {Object.keys(params).length > 0 && (
        <pre className="mt-5 font-mono text-mono-sm text-inkDim p-3 bg-surface rounded-md border border-hairline overflow-auto">
{JSON.stringify(params, null, 2)}
        </pre>
      )}
      <div className="mt-7">
        <Link to="/">
          <Button variant="secondary" size="lg" fullWidth>
            Voltar pro quintal
          </Button>
        </Link>
      </div>
    </main>
  );
}
