import { Divider } from '@mq/design-system';
import type { AccountPlan, TipoDeEspaco } from '@mq/shared';

interface Props {
  plano: AccountPlan;
  tipo: TipoDeEspaco;
  /** `null` quando a conta não está mais em teste. */
  testeAte: string | null;
}

/**
 * O plano, e o que ele permite.
 *
 * **Somente leitura, de propósito.** Existiu por algumas horas em 2026-08-25 um
 * botão aqui que convertia praça <-> restaurante único de graça — foi retirado
 * quando ficou decidido que o plano é o que diferencia os dois formatos.
 * Converter é mudar de plano, e mudar de plano é decisão comercial; não é um
 * interruptor em "configurações". Com o botão, qualquer assinante do plano mais
 * barato viraria praça sozinho e sairia convidando cozinhas.
 *
 * A cobrança da assinatura fica logo abaixo, em `AssinaturaDaConta` — aqui é o
 * que o plano PERMITE, lá é o que ele CUSTA. Trocar de plano continua sendo
 * conversa, não botão, pelo motivo acima.
 */
export function PlanoDaConta({ plano, tipo, testeAte }: Props) {
  const restaurante = plano === 'restaurante';
  const emTeste = testeAte !== null && new Date(testeAte) > new Date();

  return (
    <section>
      <Divider label="Seu plano" />

      <div className="mt-4">
        <p className="font-display text-display-md text-ink leading-tight">
          {restaurante ? 'Restaurante' : 'Praça de alimentação'}
        </p>
        <p className="mt-2 font-sans text-body text-inkMuted text-pretty">
          {restaurante
            ? 'Uma cozinha, que é sua. O cliente entra direto no cardápio, e este login também abre o app do restaurante.'
            : 'Várias cozinhas independentes. Cada uma tem o próprio login, o próprio cardápio e o próprio caixa; você cobra comissão e aluguel.'}
        </p>

        {emTeste && (
          <p className="mt-2 font-mono text-mono-sm text-inkDim">
            Em teste até {new Date(testeAte).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>

      <dl className="mt-5 divide-y divide-hairlineSoft">
        <Linha rotulo="Cozinhas" valor={restaurante ? '1' : 'sem limite'} />
        <Linha
          rotulo="Formato"
          valor={tipo === 'restaurante-unico' ? 'restaurante único' : 'praça de alimentação'}
        />
        <Linha
          rotulo="Cobrança entre cozinha e você"
          valor={restaurante ? 'não se aplica' : 'comissão e/ou aluguel'}
        />
      </dl>

      <p className="mt-4 font-sans text-body-sm text-inkDim text-pretty">
        {restaurante
          ? 'Para ter mais de uma cozinha no mesmo espaço, é o plano Praça de alimentação. Fale com a gente pra trocar.'
          : 'Para mudar de plano, fale com a gente.'}
      </p>
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="py-3 flex items-baseline justify-between gap-4">
      <dt className="font-mono text-label uppercase tracking-wider text-inkDim">{rotulo}</dt>
      <dd className="font-sans text-body text-ink">{valor}</dd>
    </div>
  );
}
