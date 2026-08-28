import { useParams, Link } from 'react-router-dom';
import { Button } from '@mq/design-system';

/** Stub para telas ainda não implementadas (cardapio, carrinho, etc). */
export function PlaceholderScreen({ title }: { title: string }) {
  const params = useParams();
  return (
    <main className="px-4 py-8">
      <p className="font-display text-label font-bold uppercase text-neutral-600 mb-2">
        Tela em construção
      </p>
      <h1 className="font-display text-display-lg text-ink text-pretty">{title}</h1>

      {Object.keys(params).length > 0 && (
        <pre className="mt-5 p-3 bg-surface border border-divider text-body-sm text-neutral-700 overflow-auto">
          {JSON.stringify(params, null, 2)}
        </pre>
      )}

      <div className="mt-6">
        <Link to="/" className="no-underline">
          <Button variant="secondary" size="lg" fullWidth>
            Voltar pro quintal
          </Button>
        </Link>
      </div>
    </main>
  );
}
