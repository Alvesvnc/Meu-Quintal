import { useRef, useState } from 'react';
import { mensagemDeErro, type FotoDoItem } from '@mq/shared';
import { useEnviarFoto, useExcluirFoto, useDefinirCapa } from '../api/hooks';
import { urlDaFoto } from '../lib/formato';

const MAX_FOTOS = 6;

interface Props {
  itemId: string;
  fotos: FotoDoItem[];
}

/**
 * As fotos do prato.
 *
 * A PRIMEIRA É A CAPA e está marcada como tal, porque é a única que o cliente
 * vê na lista do cardápio — as outras só aparecem quando ele abre o item. Sem
 * essa marca, quem envia quatro fotos não tem como saber qual está vendendo.
 *
 * Só existe depois que o item foi criado: a foto precisa de um item a que se
 * ligar, e criar um rascunho no servidor pra segurar upload deixaria item
 * fantasma no banco toda vez que alguém desistisse no meio.
 */
export function FotosDoItem({ itemId, fotos }: Props) {
  const enviar = useEnviarFoto();
  const excluir = useExcluirFoto();
  const capa = useDefinirCapa();
  const inputRef = useRef<HTMLInputElement>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const cheio = fotos.length >= MAX_FOTOS;
  const ocupado = enviar.isPending || excluir.isPending || capa.isPending;

  const erro =
    erroLocal ??
    (enviar.error || excluir.error || capa.error
      ? mensagemDeErro(enviar.error ?? excluir.error ?? capa.error, 'Nao consegui salvar a foto.')
      : null);

  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    // Zerar o input SEMPRE: sem isso, escolher a mesma foto de novo depois de
    // um erro não dispara `change` e a tela parece travada.
    e.target.value = '';
    if (!arquivo) return;

    setErroLocal(null);
    // Barreira local só pra dar resposta imediata — o servidor valida de novo,
    // e é ele quem manda.
    if (arquivo.size > 8 * 1024 * 1024) {
      setErroLocal('Essa foto tem mais de 8 MB. Tente uma menor.');
      return;
    }
    enviar.mutate({ itemId, arquivo });
  };

  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <label className="font-mono text-label uppercase tracking-wider text-inkInverseDim">
          Fotos
        </label>
        <span className="font-mono text-mono-sm text-inkInverseDim">
          {fotos.length}/{MAX_FOTOS}
        </span>
      </div>

      <p className="mb-3 font-sans text-body-sm text-inkInverseDim">
        A primeira é a que aparece no cardápio. As outras o cliente vê ao abrir o prato.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {fotos.map((f, i) => (
          <figure key={f.id} className="relative aspect-square rounded-md overflow-hidden bg-surfaceDeep">
            <img
              src={urlDaFoto(f.url)}
              alt=""
              width={f.width}
              height={f.height}
              loading="lazy"
              className="w-full h-full object-cover"
            />

            {i === 0 && (
              <figcaption
                className="absolute top-1 left-1 px-1.5 py-0.5 rounded-sm bg-primary
                           font-mono text-mono-sm uppercase tracking-wider text-inkInverse"
              >
                capa
              </figcaption>
            )}

            <div className="absolute inset-x-0 bottom-0 flex">
              {i !== 0 && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => capa.mutate({ itemId, fotoId: f.id })}
                  className="flex-1 h-9 bg-ink/70 font-mono text-mono-sm uppercase tracking-wider
                             text-white cursor-pointer hover:bg-primary
                             disabled:opacity-50 transition-colors duration-base ease-out"
                >
                  capa
                </button>
              )}
              <button
                type="button"
                disabled={ocupado}
                aria-label="Remover foto"
                onClick={() => excluir.mutate({ itemId, fotoId: f.id })}
                className="w-9 h-9 bg-ink/70 font-mono text-mono text-white cursor-pointer
                           hover:bg-danger disabled:opacity-50
                           transition-colors duration-base ease-out"
              >
                ×
              </button>
            </div>
          </figure>
        ))}

        {!cheio && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-md border border-dashed border-hairlineDark
                       flex flex-col items-center justify-center gap-1 cursor-pointer
                       text-inkInverseDim hover:border-primary hover:text-primary
                       disabled:opacity-50 transition-colors duration-base ease-out"
          >
            <span className="font-display italic text-display-md">
              {enviar.isPending ? '…' : '+'}
            </span>
            <span className="font-mono text-mono-sm uppercase tracking-wider">
              {enviar.isPending ? 'enviando' : 'foto'}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        // `capture` de propósito ausente: o operador pode querer tanto a câmera
        // quanto uma foto que já tirou. Forçar a câmera obrigaria a refotografar
        // um prato que já saiu.
        accept="image/*"
        onChange={escolher}
        className="hidden"
      />

      {erro && <p className="mt-3 font-mono text-mono-sm text-danger">{erro}</p>}

      {cheio && (
        <p className="mt-3 font-sans text-body-sm text-inkInverseDim">
          Chegou no limite. Remova uma pra colocar outra.
        </p>
      )}
    </div>
  );
}
