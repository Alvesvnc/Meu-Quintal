import { useRef, useState } from 'react';
import { mensagemDeErro } from '@mq/shared';
import { useEnviarFotoDaCozinha, useExcluirFotoDaCozinha } from '../api/hooks';
import { urlDaFoto } from '../lib/formato';

/** Mesmo teto do servidor (`BYTES_MAXIMOS`, em server/src/lib/imagem.ts). */
const MAX_BYTES = 8 * 1024 * 1024;

interface Props {
  /** A foto que está valendo, já resolvida pelo servidor. */
  foto: string | null;
  /** Nome da cozinha — só pro texto alternativo. */
  nome: string;
  /** True quando o que aparece vem do campo antigo, não de um arquivo nosso. */
  ehLegado: boolean;
}

/**
 * A foto de capa da cozinha: a que aparece na lista do quintal e no topo do
 * cardápio.
 *
 * ENVIA ARQUIVO, não cola endereço. O caminho antigo — URL de imagem hospedada
 * em outro site — dependia de alguém ter onde publicar a foto antes, e sumia
 * no dia em que aquele site caísse. O campo continua existindo pra quem já
 * preencheu (ver PerfilScreen), mas não é mais o que se oferece.
 *
 * O arquivo vai como veio: quem reencoda pra webp, redimensiona e joga fora o
 * metadado — inclusive o GPS gravado pela câmera — é o servidor, em
 * lib/imagem.ts. Fazer aqui também seria duas implementações da mesma regra, e
 * a do navegador é a que não vale, porque quem envia controla o cliente.
 */
export function FotoDaCozinha({ foto, nome, ehLegado }: Props) {
  const enviar = useEnviarFotoDaCozinha();
  const excluir = useExcluirFotoDaCozinha();
  const inputRef = useRef<HTMLInputElement>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [quebrada, setQuebrada] = useState<string | null>(null);

  const ocupado = enviar.isPending || excluir.isPending;
  const erro =
    erroLocal ??
    (enviar.error || excluir.error
      ? mensagemDeErro(enviar.error ?? excluir.error, 'Nao consegui salvar a foto.')
      : null);

  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    // Zerar o input SEMPRE: sem isso, escolher a mesma foto de novo depois de
    // um erro não dispara `change` e a tela parece travada.
    e.target.value = '';
    if (!arquivo) return;

    setErroLocal(null);
    setQuebrada(null);
    // Barreira local só pra dar resposta imediata — o servidor valida de novo,
    // e é ele quem manda.
    if (arquivo.size > MAX_BYTES) {
      setErroLocal('Essa foto tem mais de 8 MB. Tente uma menor.');
      return;
    }
    enviar.mutate(arquivo);
  };

  const src = foto ? urlDaFoto(foto) : null;

  return (
    <div>
      <div className="overflow-hidden bg-surface aspect-[4/5] max-w-[280px]">
        {src && quebrada !== src ? (
          <img
            src={src}
            alt={`Foto da ${nome}`}
            onError={() => setQuebrada(src)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center px-4 text-center">
            <p className="font-sans text-body-sm text-inkDim">
              {src ? 'Não consegui carregar essa imagem.' : 'Sem foto.'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 max-w-[280px]">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => inputRef.current?.click()}
          className="px-4 py-2 border border-hairline bg-surface cursor-pointer
                     font-mono text-label uppercase tracking-wider text-ink
                     hover:border-primary hover:text-primary disabled:opacity-50
                     transition-colors duration-base ease-out"
        >
          {enviar.isPending ? 'Enviando…' : foto ? 'Trocar foto' : 'Escolher foto'}
        </button>

        {/* Só remove o que foi ENVIADO. A URL antiga tem campo próprio, e
            apagar as duas daqui mexeria no que ninguém pediu pra mexer. */}
        {foto && !ehLegado && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => excluir.mutate()}
            className="px-4 py-2 cursor-pointer
                       font-mono text-label uppercase tracking-wider text-inkDim
                       hover:text-danger disabled:opacity-50
                       transition-colors duration-base ease-out"
          >
            {excluir.isPending ? 'Removendo…' : 'Remover'}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        // `capture` de propósito ausente: quem cadastra pode estar no
        // computador com a foto pronta, ou no celular querendo tirar na hora.
        // Forçar a câmera tiraria a primeira opção.
        accept="image/*"
        onChange={escolher}
        className="hidden"
      />

      {erro && <p className="mt-3 font-mono text-mono-sm text-danger">{erro}</p>}
    </div>
  );
}
