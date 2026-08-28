import { Logo } from '@mq/design-system';

/**
 * Mostrada quando alguém abre o app sem ter passado pelo QR de uma mesa.
 * Em produção, é a única tela acessível sem token.
 */
export function NoTableScreen() {
  return (
    <main className="min-h-[100dvh] flex flex-col justify-center px-4">
      <Logo size={20} className="mb-3" />
      <h1 className="font-display text-display-lg text-ink text-pretty">
        Escaneia o QR
        <br />
        <span className="text-accent">da sua mesa.</span>
      </h1>
      <p className="mt-4 text-body-sm text-neutral-700 text-pretty">
        Pra montar seu pedido, abre a câmera no QR code que está na mesa do quintal.
      </p>

      {/* Dev: atalhos pra entrar em mesas mockadas */}
      {import.meta.env.DEV && (
        <div className="mt-10 pt-5 border-t-rule border-divider">
          <p className="font-display text-label font-bold uppercase text-neutral-600 mb-3">
            Dev · entrar como mesa
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 4, 7, 12, 16].map((n) => (
              <a
                key={n}
                href={`/m/mesa-${n}-dev`}
                className="inline-flex items-center h-10 px-4 border border-divider no-underline
                           font-display text-label font-bold uppercase text-ink tabular
                           hover:bg-ink/[0.07] transition-colors duration-base ease-out"
              >
                mesa {String(n).padStart(2, '0')}
              </a>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
