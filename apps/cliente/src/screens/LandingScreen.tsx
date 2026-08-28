import { Navigate } from 'react-router-dom';
import { Button, Pulso } from '@mq/design-system';
import { useQuintal } from '../api/hooks';
import { KitchenRow } from '../components/KitchenRow';
import { KitchenCard } from '../components/KitchenCard';
import { ScreenError } from '../components/ScreenError';

/** Abaixo disto a grade de duas colunas desperdiça meia tela numa célula vazia. */
const MINIMO_PRA_GRADE = 3;

/**
 * Tela 01 — pós-QR · lista de cozinhas.
 *
 * O parágrafo com capitular saiu. Ele dizia em três linhas o que o cabeçalho
 * (mesa), o título (quantas cozinhas) e os cards (quais) já dizem — e era a
 * primeira coisa entre o QR e a comida.
 */
export function LandingScreen() {
  const { data, isLoading, error, refetch } = useQuintal();

  if (isLoading) {
    return (
      <main className="px-4 pt-8">
        <p className="font-display text-display-md text-neutral-600">Carregando o quintal…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <ScreenError
        title="Não rolou abrir o quintal."
        body="A mesa pode ter sido recriada pelo dono ou o quintal está temporariamente fora do ar."
        onRetry={() => refetch()}
      />
    );
  }

  const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const abertas = data.kitchens.length;

  // ─── Restaurante único: pula a lista ─────────────────────────────────────
  //
  // Uma lista com um item só não ajuda ninguém — é um toque a mais entre o QR
  // e a comida. `replace` para o botão "voltar" do navegador não trazer a
  // pessoa de volta a essa tela intermediária.
  //
  // Decide pelo TIPO do espaço, não por `kitchens.length === 1`: uma praça de
  // alimentação que hoje tem uma cozinha só continua sendo uma praça, e a
  // lista deve aparecer.
  if (data.space.tipo === 'restaurante-unico' && data.kitchens[0]) {
    return <Navigate to={`/k/${data.kitchens[0].slug}`} replace />;
  }

  const emGrade = abertas >= MINIMO_PRA_GRADE;

  return (
    <main className="pb-8">
      <section className="px-4 py-4 flex flex-col gap-2">
        <p className="flex items-center gap-2 font-display text-label font-bold uppercase text-neutral-600">
          <Pulso />
          Agora · <span className="tabular">{agora}</span>
        </p>
        <h1 className="font-display text-display-lg text-ink">
          {abertas === 0
            ? 'Nenhuma cozinha aberta.'
            : `${abertas} ${abertas === 1 ? 'cozinha aberta' : 'cozinhas abertas'}.`}
        </h1>
      </section>

      {abertas > 0 &&
        (emGrade ? (
          <section className="px-4 pb-6 grid grid-cols-2 gap-x-3 gap-y-6">
            {data.kitchens.map((k, i) => (
              <KitchenCard key={k.id} kitchen={k} index={i} />
            ))}
          </section>
        ) : (
          <section className="px-4 pb-6">
            {data.kitchens.map((k, i) => (
              <KitchenRow key={k.id} kitchen={k} index={i} />
            ))}
          </section>
        ))}

      {abertas === 0 && (
        <section className="px-4">
          <p className="text-body-sm text-neutral-700">
            As cozinhas do {data.space.name} estão fechadas agora.
          </p>
          <div className="mt-4">
            <Button variant="secondary" size="lg" fullWidth onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        </section>
      )}

      <footer className="mt-4 px-4 py-3 border-t border-divider">
        <p className="font-display text-label-sm font-bold uppercase text-neutral-600">
          {data.space.name}
        </p>
      </footer>
    </main>
  );
}
