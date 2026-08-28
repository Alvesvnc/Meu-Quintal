import { Button } from '@mq/design-system';

interface ScreenErrorProps {
  title: string;
  body?: string;
  onRetry?: () => void;
}

export function ScreenError({ title, body, onRetry }: ScreenErrorProps) {
  return (
    <main className="px-4 py-10">
      <h1 className="font-display text-display-lg text-ink text-pretty">{title}</h1>
      {body && <p className="mt-3 text-body-sm text-neutral-700 text-pretty">{body}</p>}
      {onRetry && (
        <div className="mt-6">
          <Button variant="secondary" size="lg" fullWidth onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      )}
    </main>
  );
}
