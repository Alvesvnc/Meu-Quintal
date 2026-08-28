import { useState } from 'react';
import { Button, Sheet, SheetBody, SheetFooter, SheetHeader } from '@mq/design-system';
import { mensagemDeErro, type CategoriaCardapio, type ItemCardapio } from '@mq/shared';
import { useCriarItem, useEditarItem, useExcluirItem } from '../api/hooks';
import { Switch } from '../components/Switch';
import { FotosDoItem } from '../components/FotosDoItem';

interface Props {
  /** `null` = criando um item novo. */
  item: ItemCardapio | null;
  /** As seções da cozinha, na ordem dela. Escritas por ela — ver CategoriasSheet. */
  categorias: CategoriaCardapio[];
  onClose: () => void;
}

/**
 * Criar ou editar um item do cardápio.
 *
 * O `key` remonta o formulário a cada item: o estado inicial volta a ser lido
 * das props sozinho. Sincronizar campo a campo num useEffect abria o item novo
 * com o texto do anterior por um frame — e, num formulário de preço, mostrar o
 * valor errado mesmo que por um instante gera dúvida sobre o que foi salvo.
 */
export function EditItemSheet({ item, categorias, onClose }: Props) {
  return (
    <Formulario
      key={item?.id ?? 'novo'}
      item={item}
      categorias={categorias}
      onClose={onClose}
    />
  );
}

function Formulario({ item, categorias, onClose }: Props) {
  const criar = useCriarItem();
  const editar = useEditarItem();
  const excluir = useExcluirItem();

  const novo = item === null;

  const [name, setName] = useState(item?.name ?? '');
  // Item novo cai na PRIMEIRA seção — a que a cozinha pôs em cima é a que ela
  // usa mais. Adivinhar por nome ("parece bebida") erraria em silêncio.
  const [categoriaId, setCategoriaId] = useState(item?.categoriaId ?? categorias[0]?.id ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [photoUrl, setPhotoUrl] = useState(item?.photoUrl ?? '');
  const [precoStr, setPrecoStr] = useState(
    item ? (item.priceCents / 100).toFixed(2).replace('.', ',') : '',
  );
  const [available, setAvailable] = useState(item?.available ?? true);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const preco = parseFloat(precoStr.replace(',', '.'));
  const precoValido = !isNaN(preco) && preco > 0;
  const nomeValido = name.trim().length >= 2;

  const salvando = criar.isPending || editar.isPending || excluir.isPending;
  // Sem seção escolhida não há onde o item aparecer no cardápio.
  const podeSalvar = nomeValido && precoValido && categoriaId !== '' && !salvando;

  const erro =
    criar.error || editar.error || excluir.error
      ? mensagemDeErro(criar.error ?? editar.error ?? excluir.error, 'Nao consegui salvar.')
      : null;

  const salvar = () => {
    if (!podeSalvar) return;
    const dados = {
      categoriaId,
      name: name.trim(),
      description: description.trim() || null,
      photoUrl: photoUrl.trim() || null,
      priceCents: Math.round(preco * 100),
      available,
    };
    if (novo) criar.mutate({ ...dados, badge: null, sortOrder: 0 }, { onSuccess: onClose });
    else editar.mutate({ id: item.id, ...dados }, { onSuccess: onClose });
  };

  return (
    <Sheet open onClose={onClose} ariaLabel={novo ? 'Novo item' : `Editar ${item.name}`}>
      <SheetHeader>
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          {novo ? 'Cardápio · novo item' : 'Cardápio · editar'}
        </p>
        <h2 className="mt-1 font-display text-display-md text-ink leading-tight">
          {name.trim() || (novo ? 'Item novo' : item.name)}
        </h2>
      </SheetHeader>

      <SheetBody>
        <Campo rotulo="Nome" dica={`${name.length}/80`}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoFocus={novo}
            placeholder="ex: Smash Lou"
            className={inputCls}
          />
        </Campo>

        <Campo rotulo="Seção" dica="a sua, não a nossa">
          {categorias.length === 0 ? (
            <p className="font-sans text-body-sm text-inkMuted">
              Crie uma seção antes — é ela que dá o título embaixo do qual este item
              aparece pro cliente.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoriaId(c.id)}
                  className={[
                    'min-h-11 px-3 py-2 text-left truncate',
                    'font-sans text-body-sm border transition-colors duration-base ease-out',
                    categoriaId === c.id
                      ? 'border-primary bg-primary text-bg'
                      : 'border-hairline text-inkDim',
                  ].join(' ')}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </Campo>

        <Campo rotulo="Preço">
          <div className="flex items-center gap-2">
            <span className="font-mono text-body-lg text-inkDim">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={precoStr}
              onChange={(e) => setPrecoStr(e.target.value.replace(/[^\d,.]/g, ''))}
              placeholder="32,00"
              className={`${inputCls} w-32 font-mono`}
            />
          </div>
          {precoStr !== '' && !precoValido && (
            <p className="mt-2 font-mono text-mono-sm text-danger">
              Preço precisa ser maior que zero.
            </p>
          )}
        </Campo>

        <Campo rotulo="Descrição" dica={`${description.length}/280 · opcional`}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="Blend 180g, queijo, picles da casa…"
            className={`${inputCls} resize-none`}
          />
        </Campo>

        {/* Foto so depois de o item existir: ela precisa de um item a que se
            ligar. Criar rascunho no servidor pra segurar upload deixaria item
            fantasma toda vez que alguem desistisse no meio. */}
        {novo ? (
          <p className="mt-5 font-sans text-body-sm text-inkMuted">
            Salve o item primeiro. Depois você adiciona as fotos.
          </p>
        ) : (
          <FotosDoItem itemId={item.id} fotos={item.fotos} />
        )}

        {/* Legado: item cadastrado antes de existir upload. So aparece se ja
            tiver valor — nao ha por que oferecer o caminho velho pra quem esta
            comecando agora. */}
        {photoUrl.trim() !== '' && (
          <Campo rotulo="Foto por endereço" dica="campo antigo">
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
            <p className="mt-2 font-sans text-body-sm text-inkMuted">
              Apague este endereço e envie a foto acima — assim ela fica guardada aqui e não
              depende de outro site continuar no ar.
            </p>
          </Campo>
        )}

        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-sans text-body-lg text-ink">
              {available ? 'Disponível' : 'Esgotado'}
            </p>
            <p className="mt-0.5 font-sans text-body-sm text-inkMuted">
              Esgotado continua no cardápio, marcado e sem poder ser pedido.
            </p>
          </div>
          <Switch
            checked={available}
            onChange={() => setAvailable(!available)}
            ariaLabel="Disponível"
          />
        </div>

        {erro && <p className="mt-4 font-mono text-mono-sm text-danger">{erro}</p>}

        {!novo && (
          <div className="mt-8 pt-5 border-t border-hairline">
            {confirmandoExclusao ? (
              <>
                <p className="font-sans text-body text-inkMuted">
                  Tirar <span className="text-ink">{item.name}</span> do cardápio? Ele some
                  pro cliente. Os pedidos antigos continuam como estão.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="danger"
                    size="md"
                    disabled={salvando}
                    onClick={() => excluir.mutate(item.id, { onSuccess: onClose })}
                  >
                    {excluir.isPending ? 'Tirando…' : 'Sim, tirar'}
                  </Button>
                  <Button variant="ghost" size="md" onClick={() => setConfirmandoExclusao(false)}>
                    Não
                  </Button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(true)}
                className="font-mono text-mono-sm uppercase tracking-wider text-inkDim
                           hover:text-danger cursor-pointer transition-colors duration-base ease-out"
              >
                Tirar do cardápio
              </button>
            )}
          </div>
        )}
      </SheetBody>

      <SheetFooter>
        <Button variant="primary" size="lg" fullWidth disabled={!podeSalvar} onClick={salvar}>
          {salvando ? 'Salvando…' : novo ? 'Adicionar ao cardápio' : 'Salvar'}
        </Button>
        <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
          Cancelar
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 first:mt-0">
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <label className="font-mono text-label uppercase tracking-wider text-inkDim">
          {rotulo}
        </label>
        {dica && (
          <span className="font-mono text-mono-sm text-inkDim normal-case tracking-normal">
            {dica}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  'w-full bg-surface px-4 py-3 border border-hairline ' +
  'font-sans text-body text-ink placeholder:text-inkDim ' +
  'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash';
