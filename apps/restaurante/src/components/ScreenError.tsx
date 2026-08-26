import { Button } from '@mq/design-system';

interface ScreenErrorProps {
  title: string;
  body?: string;
  onRetry?: () => void;
}

export function ScreenError({ title, body, onRetry }: ScreenErrorProps) {
  return (
    <main className="px-5 py-12">
      <h1 className="font-display italic text-display-lg text-ink leading-tight text-pretty">
        {title}
      </h1>
      {body && (
        <p className="mt-3 font-sans text-body text-inkMuted text-pretty">
          {body}
        </p>
      )}
      {onRetry && (
        <div className="mt-6">
          <Button variant="primary" size="lg" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      )}
    </main>
  );
}
