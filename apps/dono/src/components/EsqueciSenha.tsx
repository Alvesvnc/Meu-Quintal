import { useState } from 'react';
import { Button } from '@mq/design-system';
import { usePedirRecuperacao } from '../api/hooks';

/**
 * "Esqueci minha senha", embutido na tela de login.
 *
 * A CONFIRMAÇÃO É SEMPRE A MESMA, exista o e-mail ou não — é assim que o
 * servidor responde, de propósito, e a tela não pode contradizer isso. Dizer
 * "não encontramos esse e-mail" transformaria o formulário num verificador de
 * quais endereços têm conta aqui.
 *
 * Por isso o texto de sucesso fala em condicional: "se houver uma conta com
 * esse e-mail". É honesto e não entrega nada.
 */
export function EsqueciSenha({ emailInicial }: { emailInicial: string }) {
  const pedir = usePedirRecuperacao();
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState(emailInicial);

  if (pedir.isSuccess) {
    return (
      <div className="mt-6 border-l-2 border-l-accent pl-4">
        <p className="font-sans text-body text-ink">Se houver uma conta com esse e-mail, o link já está a caminho.</p>
        <p className="mt-1 font-sans text-body-sm text-inkMuted">
          Ele vale por uma hora. Confira a caixa de spam.
        </p>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setEmail(emailInicial);
          setAberto(true);
        }}
        className="mt-6 font-mono text-mono-sm uppercase tracking-wider text-inkDim
                   hover:text-primary cursor-pointer transition-colors duration-base ease-out"
      >
        Esqueci minha senha
      </button>
    );
  }

  return (
    <div className="mt-6 pt-5 border-t border-hairlineSoft">
      <label htmlFor="email-recuperar" className="block font-mono text-label uppercase tracking-wider text-inkDim mb-2">
        Seu e-mail
      </label>
      <input
        id="email-recuperar"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@seuquintal.com"
        className="w-full px-4 py-3 bg-surface border border-hairline
                   font-sans text-body text-ink placeholder:text-inkDim
                   focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash"
      />
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          size="md"
          disabled={pedir.isPending || email.trim() === ''}
          onClick={() => pedir.mutate(email.trim())}
        >
          {pedir.isPending ? 'Enviando…' : 'Mandar link'}
        </Button>
        <Button variant="ghost" size="md" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
