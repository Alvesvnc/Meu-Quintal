import { useState } from 'react';
import { Divider, Button } from '@mq/design-system';
import { mensagemDeErro, type ItemCardapio } from '@mq/shared';
import { useCardapio, useEditarItem } from '../api/hooks';
import { Switch } from '../components/Switch';
import { FaixaFixa, ESPACO_DA_FAIXA } from '../components/FaixaFixa';
import { ScreenError } from '../components/ScreenError';
import { EditItemSheet } from './EditItemSheet';
import { CategoriasSheet } from './CategoriasSheet';
import { fmtBRL, urlDaFoto } from '../lib/formato';

/**
 * O cardápio, editável na própria lista.
 *
 * Três gestos, do mais rápido pro mais completo:
 *   switch  → esgotar/reativar, que é o que mais acontece no meio do serviço
 *   preço   → editar na hora, sem abrir nada
 *   nome    → abre o sheet com tudo
 *
 * Esgotar precisa ser o gesto mais barato: é o que a cozinha faz com a mão
 * ocupada quando acaba um ingrediente, e cada toque a mais é comida esfriando.
 *
 * As SEÇÕES vêm do servidor, escritas pela própria cozinha (desde 2026-08-27).
 * Aqui elas aparecem TODAS, inclusive as vazias — diferente do cardápio do
 * cliente, que pula seção sem item. Esta é a tela de montar: quem acabou de
 * criar "Do forno" precisa ver que ela existe e está esperando prato.
 */
export function MenuEditScreen() {
  const q = useCardapio();
  const editar = useEditarItem();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [editandoSecoes, setEditandoSecoes] = useState(false);

  if (q.isLoading) {
    return (
      <main className="w-full max-w-[720px] mx-auto px-5 sm:px-6 py-12 font-sans text-body text-inkDim">
        Carregando cardápio…
      </main>
    );
  }
  if (q.isError || !q.data) {
    return (
      <ScreenError
        title="Nao consegui carregar o cardapio."
        body={mensagemDeErro(q.error, 'O servidor nao respondeu.')}
        onRetry={() => q.refetch()}
      />
    );
  }

  const { items, categorias } = q.data;
  const disponiveis = items.filter((i) => i.available).length;
  const emEdicao = criando ? null : (items.find((i) => i.id === editandoId) ?? null);
  const sheetAberto = criando || emEdicao !== null;

  return (
    // O `pb` sai do componente da faixa, e nao de uma classe fixa: sao duas
    // barras empilhadas embaixo (abas + faixa), e o `pb-28` das outras telas
    // conta so com as abas — o ultimo item da lista ficava metade escondido.
    <main
      className="w-full max-w-[720px] mx-auto px-5 sm:px-6"
      style={{ paddingBottom: ESPACO_DA_FAIXA }}
    >
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Cardápio · {disponiveis}/{items.length} disponíveis
        </p>
        <h1 className="mt-1 font-display text-display-lg text-ink leading-tight">
          Editar cardápio.
        </h1>
        <p className="mt-2 font-sans text-body text-inkMuted">
          Toque no <b>switch</b> pra esgotar. No <b>preço</b> pra atualizar rápido. No <b>nome</b>{' '}
          pra editar tudo.
        </p>

        {/* As seções ficam AQUI, e não na faixa de baixo junto do "+ Item":
            renomear e reordenar é coisa de montar o cardápio, feita uma vez;
            acrescentar item acontece toda semana. Dar o mesmo peso aos dois
            gastaria a faixa fixa com o que quase nunca se usa. */}
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={() => setEditandoSecoes(true)}>
            Seções · {categorias.length}
          </Button>
        </div>
      </section>

      {editar.isError && (
        <p className="mt-4 font-mono text-mono-sm text-danger">
          {mensagemDeErro(editar.error, 'Nao consegui salvar.')}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-10 text-center font-display text-display-md text-inkMuted">
          Cardápio vazio. Comece pelo primeiro item.
        </p>
      ) : (
        <div className="mt-7 space-y-7">
          {categorias.map((c) => {
            const daCategoria = items.filter((i) => i.categoriaId === c.id);
            return (
              <section key={c.id}>
                <Divider label={c.name} />
                {daCategoria.length === 0 ? (
                  <p className="mt-3 font-sans text-body-sm text-inkMuted">
                    Nenhum item nesta seção ainda.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-hairlineSoft">
                    {daCategoria.map((item) => (
                      <li key={item.id}>
                        <Linha
                          item={item}
                          salvando={editar.isPending}
                          onEsgotar={() =>
                            editar.mutate({ id: item.id, available: !item.available })
                          }
                          onPreco={(priceCents) => editar.mutate({ id: item.id, priceCents })}
                          onAbrir={() => {
                            setCriando(false);
                            setEditandoId(item.id);
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <FaixaFixa>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          // Sem seção não há onde pôr o item, e o formulário abriria num beco.
          disabled={categorias.length === 0}
          onClick={() => {
            setEditandoId(null);
            setCriando(true);
          }}
        >
          + Item
        </Button>
      </FaixaFixa>

      {editandoSecoes && (
        <CategoriasSheet categorias={categorias} onClose={() => setEditandoSecoes(false)} />
      )}

      {sheetAberto && (
        <EditItemSheet
          item={emEdicao}
          categorias={categorias}
          onClose={() => {
            setCriando(false);
            setEditandoId(null);
          }}
        />
      )}
    </main>
  );
}

interface LinhaProps {
  item: ItemCardapio;
  salvando: boolean;
  onEsgotar: () => void;
  onPreco: (cents: number) => void;
  onAbrir: () => void;
}

function Linha({ item, salvando, onEsgotar, onPreco, onAbrir }: LinhaProps) {
  const [editandoPreco, setEditandoPreco] = useState(false);
  const [rascunho, setRascunho] = useState('');

  // Foto enviada tem precedencia sobre o endereco colado a mao (legado).
  const capa = item.fotos[0] ? urlDaFoto(item.fotos[0].url) : item.photoUrl;

  const confirmar = () => {
    const num = parseFloat(rascunho.replace(',', '.'));
    // Preço inválido não vira zero: o campo simplesmente volta ao que era. Um
    // item a R$ 0,00 por erro de digitação sai de graça pro cliente.
    if (!isNaN(num) && num > 0) {
      const cents = Math.round(num * 100);
      if (cents !== item.priceCents) onPreco(cents);
    }
    setEditandoPreco(false);
  };

  return (
    <div className={`flex items-center gap-4 py-4 ${item.available ? '' : 'opacity-55'}`}>
      <Switch
        checked={item.available}
        onChange={onEsgotar}
        ariaLabel={`Disponível: ${item.name}`}
      />

      <button
        type="button"
        onClick={onAbrir}
        aria-label={`Editar ${item.name}`}
        className="flex-1 min-w-0 text-left cursor-pointer flex items-center gap-3
                   transition-colors duration-base ease-out hover:text-primary"
      >
        {/* A capa aqui e o retorno visual de que a foto entrou: sem isso, so
            reabrindo o item pra saber. */}
        {capa && (
          <img
            src={capa}
            alt=""
            loading="lazy"
            className="w-11 h-11 shrink-0 object-cover bg-surface"
          />
        )}
        <span className="min-w-0">
          <p className="font-sans text-body-lg text-ink leading-tight">{item.name}</p>
          {!item.available && (
            <p className="mt-0.5 font-mono text-mono-sm uppercase tracking-wider text-danger">
              esgotado
            </p>
          )}
        </span>
      </button>

      <div className="shrink-0">
        {editandoPreco ? (
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmar();
              if (e.key === 'Escape') setEditandoPreco(false);
            }}
            className="w-24 h-11 px-2 text-right bg-bg border border-primary
                       font-mono text-body text-ink
                       focus:outline-none focus:ring-[3px] focus:ring-primaryWash"
          />
        ) : (
          <button
            type="button"
            disabled={salvando}
            onClick={() => {
              setRascunho((item.priceCents / 100).toFixed(2).replace('.', ','));
              setEditandoPreco(true);
            }}
            className="h-11 px-3 border border-hairline bg-surface
                       font-mono text-body text-ink cursor-pointer tabular-nums
                       hover:border-primary hover:text-primary
                       disabled:opacity-50 transition-colors duration-base ease-out"
          >
            {fmtBRL(item.priceCents)}
          </button>
        )}
      </div>
    </div>
  );
}
