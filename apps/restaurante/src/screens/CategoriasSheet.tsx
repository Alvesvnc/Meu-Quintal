import { useState } from 'react';
import { Button, Sheet, SheetBody, SheetFooter, SheetHeader } from '@mq/design-system';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { mensagemDeErro, type CategoriaCardapio } from '@mq/shared';
import {
  useCriarCategoria,
  useExcluirCategoria,
  useOrdenarCategorias,
  useRenomearCategoria,
} from '../api/hooks';

interface Props {
  categorias: CategoriaCardapio[];
  onClose: () => void;
}

/** Mesmo teto do servidor (MAX_CATEGORIAS). Aqui só pra explicar antes de tentar. */
const MAX = 12;

/**
 * As seções do cardápio — os títulos que dividem a lista.
 *
 * Até 2026-08-27 eram quatro, iguais pra todo mundo: Entradas, Pratos,
 * Sobremesas, Bebidas. Uma padaria tinha que chamar pão de "Prato" e uma
 * drinkeria não tinha onde pôr os drinks. Agora quem escreve é a casa.
 *
 * Três gestos, na ordem do que mais acontece:
 *   nome   → renomear na hora, sem abrir nada (o item não muda de lugar:
 *            ele aponta pro id da seção, não pro texto)
 *   ↑ ↓    → reordenar, que é a ordem em que o cliente lê o cardápio
 *   tirar  → só depois de dizer pra onde vão os itens
 *
 * Tirar troca o CONTEÚDO deste sheet em vez de abrir outro por cima. Sheet
 * dentro de sheet quebra: o de fora usa `transform`, e um `fixed` lá dentro
 * passa a se posicionar por ele, não pela tela.
 */
export function CategoriasSheet({ categorias, onClose }: Props) {
  const criar = useCriarCategoria();
  const renomear = useRenomearCategoria();
  const ordenar = useOrdenarCategorias();
  const excluir = useExcluirCategoria();

  const [nova, setNova] = useState('');
  const [tirandoId, setTirandoId] = useState<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);

  const salvando =
    criar.isPending || renomear.isPending || ordenar.isPending || excluir.isPending;

  const erro =
    criar.error || renomear.error || ordenar.error || excluir.error
      ? mensagemDeErro(
          criar.error ?? renomear.error ?? ordenar.error ?? excluir.error,
          'Nao consegui salvar.',
        )
      : null;

  // Lido da lista viva, e não guardado no estado: renomear ou mover enquanto a
  // pergunta está aberta mostraria o nome velho de uma seção que já mudou.
  const tirando = categorias.find((c) => c.id === tirandoId) ?? null;
  const outras = categorias.filter((c) => c.id !== tirandoId);

  const podeCriar = nova.trim().length >= 2 && categorias.length < MAX && !salvando;

  const adicionar = () => {
    if (!podeCriar) return;
    criar.mutate(nova.trim(), { onSuccess: () => setNova('') });
  };

  /** Troca a seção de lugar com a vizinha e manda a lista inteira na nova ordem. */
  const mover = (i: number, direcao: -1 | 1) => {
    const alvo = i + direcao;
    if (alvo < 0 || alvo >= categorias.length) return;
    const ids = categorias.map((c) => c.id);
    [ids[i], ids[alvo]] = [ids[alvo], ids[i]];
    ordenar.mutate(ids);
  };

  const perguntarTirar = (c: CategoriaCardapio) => {
    setTirandoId(c.id);
    setDestino(categorias.find((outra) => outra.id !== c.id)?.id ?? null);
  };

  const voltarDaPergunta = () => {
    setTirandoId(null);
    setDestino(null);
  };

  if (tirando) {
    const temItens = tirando.itemCount > 0;
    return (
      <Sheet open onClose={voltarDaPergunta} ariaLabel={`Tirar ${tirando.name}`}>
        <SheetBody>
          <h2 className="font-display text-display-md text-ink leading-tight text-pretty">
            Tirar “{tirando.name}” do cardápio?
          </h2>

          {temItens ? (
            <>
              <p className="mt-3 font-sans text-body text-inkMuted">
                {tirando.itemCount === 1
                  ? 'O item que está nela precisa ir pra outra seção.'
                  : `Os ${tirando.itemCount} itens que estão nela precisam ir pra outra seção.`}{' '}
                Eles continuam no cardápio, com o mesmo preço.
              </p>

              <div className="mt-5">
                <p className="font-mono text-label uppercase tracking-wider text-inkDim">
                  Mandar os itens pra
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {outras.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDestino(c.id)}
                      className={[
                        'min-h-11 px-3 py-2 text-left truncate',
                        'font-sans text-body-sm border transition-colors duration-base ease-out',
                        destino === c.id
                          ? 'border-primary bg-primary text-bg'
                          : 'border-hairline text-inkDim',
                      ].join(' ')}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-3 font-sans text-body text-inkMuted">
              Ela está vazia — nenhum prato sai do cardápio.
            </p>
          )}

          {erro && <p className="mt-4 font-mono text-mono-sm text-danger">{erro}</p>}
        </SheetBody>

        <SheetFooter>
          <Button
            variant="danger"
            size="lg"
            fullWidth
            disabled={salvando || (temItens && !destino)}
            onClick={() =>
              excluir.mutate(
                { id: tirando.id, destino: temItens ? (destino ?? undefined) : undefined },
                { onSuccess: voltarDaPergunta },
              )
            }
          >
            {excluir.isPending ? 'Tirando…' : temItens ? 'Mover e tirar' : 'Sim, tirar'}
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={voltarDaPergunta}>
            Cancelar
          </Button>
        </SheetFooter>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} ariaLabel="Seções do cardápio">
      <SheetHeader>
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Cardápio · seções
        </p>
        <h2 className="mt-1 font-display text-display-md text-ink leading-tight">
          Os títulos do seu cardápio.
        </h2>
      </SheetHeader>

      <SheetBody>
        <p className="font-sans text-body text-inkMuted">
          São os nomes que dividem o cardápio pro cliente. Toque no <b>nome</b> pra
          renomear — os pratos continuam onde estão.
        </p>

        <ul className="mt-5 divide-y divide-hairlineSoft border-y border-hairline">
          {categorias.map((c, i) => (
            <li key={c.id}>
              <Linha
                categoria={c}
                primeira={i === 0}
                ultima={i === categorias.length - 1}
                salvando={salvando}
                onRenomear={(name) => renomear.mutate({ id: c.id, name })}
                onSubir={() => mover(i, -1)}
                onDescer={() => mover(i, 1)}
                onTirar={() => perguntarTirar(c)}
                // A última não sai: sem nenhuma seção o cardápio não teria onde
                // pôr o próximo item, e isso apareceria só na hora de cadastrar.
                podeTirar={categorias.length > 1}
              />
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <label
            htmlFor="nova-secao"
            className="font-mono text-label uppercase tracking-wider text-inkDim"
          >
            Nova seção
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="nova-secao"
              type="text"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') adicionar();
              }}
              maxLength={24}
              placeholder="ex: Do forno"
              className="flex-1 min-w-0 bg-surface px-4 py-3 border border-hairline
                         font-sans text-body text-ink placeholder:text-inkDim
                         focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash"
            />
            <Button variant="secondary" size="lg" disabled={!podeCriar} onClick={adicionar}>
              {criar.isPending ? 'Criando…' : 'Criar'}
            </Button>
          </div>
          <p className="mt-2 font-sans text-body-sm text-inkMuted">
            {categorias.length >= MAX
              ? `Você chegou ao limite de ${MAX} seções. Junte duas antes de criar outra.`
              : `Até 24 letras — cabe na linha de seções do cliente. ${categorias.length}/${MAX}.`}
          </p>
        </div>

        {erro && <p className="mt-4 font-mono text-mono-sm text-danger">{erro}</p>}
      </SheetBody>

      <SheetFooter>
        <Button variant="primary" size="lg" fullWidth onClick={onClose}>
          Pronto
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

interface LinhaProps {
  categoria: CategoriaCardapio;
  primeira: boolean;
  ultima: boolean;
  salvando: boolean;
  podeTirar: boolean;
  onRenomear: (name: string) => void;
  onSubir: () => void;
  onDescer: () => void;
  onTirar: () => void;
}

function Linha({
  categoria,
  primeira,
  ultima,
  salvando,
  podeTirar,
  onRenomear,
  onSubir,
  onDescer,
  onTirar,
}: LinhaProps) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(categoria.name);

  const confirmar = () => {
    const nome = rascunho.trim();
    // Nome vazio não vira seção sem título: o campo simplesmente volta ao que
    // era. Uma seção sem nome no cardápio do cliente é um buraco na lista.
    if (nome.length >= 2 && nome !== categoria.name) onRenomear(nome);
    setEditando(false);
  };

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        {editando ? (
          <input
            type="text"
            autoFocus
            value={rascunho}
            maxLength={24}
            aria-label={`Nome da seção ${categoria.name}`}
            onChange={(e) => setRascunho(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmar();
              if (e.key === 'Escape') {
                setRascunho(categoria.name);
                setEditando(false);
              }
            }}
            className="w-full h-11 px-2 bg-bg border border-primary
                       font-sans text-body-lg text-ink
                       focus:outline-none focus:ring-[3px] focus:ring-primaryWash"
          />
        ) : (
          <button
            type="button"
            disabled={salvando}
            onClick={() => {
              setRascunho(categoria.name);
              setEditando(true);
            }}
            aria-label={`Renomear ${categoria.name}`}
            className="w-full text-left cursor-pointer disabled:opacity-50
                       transition-colors duration-base ease-out hover:text-primary"
          >
            <p className="font-sans text-body-lg text-ink leading-tight truncate">
              {categoria.name}
            </p>
            <p className="mt-0.5 font-mono text-mono-sm uppercase tracking-wider text-inkDim">
              {categoria.itemCount === 0
                ? 'vazia'
                : `${categoria.itemCount} ${categoria.itemCount === 1 ? 'item' : 'itens'}`}
            </p>
          </button>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-1">
        <Seta rotulo={`Subir ${categoria.name}`} disabled={primeira || salvando} onClick={onSubir}>
          <ArrowUp size={16} strokeWidth={2} aria-hidden />
        </Seta>
        <Seta rotulo={`Descer ${categoria.name}`} disabled={ultima || salvando} onClick={onDescer}>
          <ArrowDown size={16} strokeWidth={2} aria-hidden />
        </Seta>
        {podeTirar && (
          <button
            type="button"
            disabled={salvando}
            onClick={onTirar}
            className="h-11 px-2 font-mono text-mono-sm uppercase tracking-wider text-inkDim
                       cursor-pointer hover:text-danger disabled:opacity-50
                       transition-colors duration-base ease-out"
          >
            tirar
          </button>
        )}
      </div>
    </div>
  );
}

function Seta({
  rotulo,
  disabled,
  onClick,
  children,
}: {
  rotulo: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={disabled}
      onClick={onClick}
      className="w-11 h-11 flex items-center justify-center border border-hairline
                 text-ink cursor-pointer hover:border-primary hover:text-primary
                 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-hairline
                 disabled:hover:text-ink transition-colors duration-base ease-out"
    >
      {children}
    </button>
  );
}
