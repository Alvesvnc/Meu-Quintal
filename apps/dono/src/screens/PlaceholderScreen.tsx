import { Divider } from '@mq/design-system';

interface PlaceholderScreenProps {
  title: string;
  note?: string;
}

export function PlaceholderScreen({ title, note }: PlaceholderScreenProps) {
  return (
    <>
      <Divider label="Em construção" />
      <h1 className="mt-6 font-display italic text-display-xl text-ink leading-tight">
        {title}
      </h1>
      {note && (
        <p className="mt-3 font-sans text-body-lg text-inkMuted">
          {note}
        </p>
      )}
    </>
  );
}
