import type { ReactNode } from 'react';
import { mensagemDeErro } from '@mq/shared';

/**
 * Os três estados que toda tela ligada na API tem.
 *
 * Existem como componente porque a alternativa é cada tela inventar o seu, e
 * "carregando" escrito de seis jeitos diferentes faz o app parecer remendado.
 */

export function Carregando({ o = 'os dados' }: { o?: string }) {
  return (
    <div className="py-16 text-center">
      <p className="font-display italic text-display-md text-inkMuted">Carregando {o}…</p>
    </div>
  );
}

export function ErroDaTela({ erro, aoTentar }: { erro: unknown; aoTentar?: () => void }) {
  return (
    <div className="py-12 border-l-2 border-l-danger pl-4">
      <p className="font-sans text-body-lg text-ink">Não consegui carregar.</p>
      <p className="mt-1 font-sans text-body text-inkMuted">
        {mensagemDeErro(erro, 'O servidor não respondeu.')}
      </p>
      {aoTentar && (
        <button
          type="button"
          onClick={aoTentar}
          className="mt-3 font-mono text-mono-sm uppercase tracking-wider text-primary
                     hover:text-ink cursor-pointer transition-colors duration-base ease-out"
        >
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="py-12 text-center">
      <p className="font-display italic text-display-md text-inkMuted text-pretty">{children}</p>
    </div>
  );
}

/**
 * Aviso de que os números não incluem todas as cozinhas.
 *
 * Aparece quando alguma cozinha paga só aluguel: o faturamento dela não é do
 * dono, então não entra em soma nenhuma. Sem este aviso, um total parcial se lê
 * como o total do quintal — e uma mesa boa pode parecer fraca só porque quem
 * vende nela é uma cozinha oculta.
 */
export function AvisoParcial({ cozinhasOcultas }: { cozinhasOcultas: number }) {
  if (cozinhasOcultas <= 0) return null;
  const plural = cozinhasOcultas > 1;
  return (
    <p className="mt-3 font-sans text-body-sm text-inkMuted border-l-2 border-l-hairline pl-3">
      Não inclui {cozinhasOcultas} cozinha{plural ? 's' : ''} que paga
      {plural ? 'm' : ''} só aluguel — o faturamento del{plural ? 'as' : 'a'} não aparece aqui.
    </p>
  );
}
