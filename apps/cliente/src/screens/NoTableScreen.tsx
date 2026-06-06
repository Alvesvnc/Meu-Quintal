/**
 * Mostrada quando alguém abre o app sem ter passado pelo QR de uma mesa.
 * Em produção, é a única tela acessível sem token.
 */
export function NoTableScreen() {
  return (
    <main className="min-h-[100dvh] flex flex-col justify-center px-7 text-center">
      <h1 className="font-display italic text-display-xl text-ink leading-tight text-pretty">
        Escaneia o QR<br />
        <span className="text-primary">da sua mesa.</span>
      </h1>
      <p className="mt-5 font-sans text-body-lg text-inkMuted text-pretty">
        Pra montar seu pedido, abre a câmera no QR code que está na mesa do quintal.
      </p>
      <p className="mt-10 font-mono text-mono-sm uppercase tracking-wider text-inkDim">
        Meu Quintal
      </p>

      {/* Dev: atalhos pra entrar em mesas mockadas */}
      {import.meta.env.DEV && (
        <div className="mt-12 pt-6 border-t border-hairlineSoft">
          <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-3">
            Dev · entrar como mesa
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[1, 4, 7, 12, 16].map((n) => (
              <a
                key={n}
                href={`/m/mesa-${n}-dev`}
                className="inline-block h-10 px-4 rounded-md bg-surface border border-hairline
                           font-mono text-mono text-ink leading-[2.5rem] no-underline
                           hover:border-primary hover:text-primary
                           transition-colors duration-base ease-out"
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
