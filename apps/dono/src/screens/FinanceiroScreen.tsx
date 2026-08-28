import { useState } from 'react';
import { Button, Chip, Divider } from '@mq/design-system';
import { mensagemDeErro, type CobrancaLinha, type FinanceiroResponse } from '@mq/shared';
import { useFinanceiro, useFecharCiclo, useMarcarCobranca } from '../api/hooks';
import { useRestauranteUnico } from '../stores/auth';
import { Carregando, ErroDaTela, Vazio, AvisoParcial } from '../components/Estado';
import { fmtBRLPrecise, fmtRefMonth, refMonthAtual } from '../lib/formato';

/**
 * O que as cozinhas devem ao quintal.
 *
 * ─── ATENÇÃO AO SENTIDO DO DINHEIRO ─────────────────────────────────────────
 *
 * A versão mockada desta tela dizia "a transferir para 5 cozinhas": o dono
 * pagando a cozinha. É o **contrário**. O dinheiro nunca passa pelo app — cada
 * cozinha cobra direto do cliente no próprio caixa, e no fim do ciclo ela DEVE
 * comissão + aluguel ao dono.
 *
 *   "a transferir"  ->  "a receber"
 *   "repasse"       ->  "cobrança"
 *
 * Traduzir errado aqui gera cobrança invertida na frente do cliente.
 */
export function FinanceiroScreen() {
  const [refMonth, setRefMonth] = useState(refMonthAtual());
  const q = useFinanceiro(refMonth);
  const unico = useRestauranteUnico();

  return (
    <>
      <header className="mb-6">
        <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">Financeiro</p>
        <h1 className="font-display text-display-xl text-ink leading-tight">
          {unico ? 'Seu faturamento.' : 'O que você tem a receber.'}
        </h1>
        <div className="mt-3">
          <label className="inline-flex items-center gap-2">
            <span className="font-mono text-label uppercase tracking-wider text-inkDim">Ciclo</span>
            <input
              type="month"
              value={refMonth}
              max={refMonthAtual()}
              onChange={(e) => e.target.value && setRefMonth(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-hairline
                         font-mono text-mono text-ink
                         focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash"
            />
          </label>
        </div>
      </header>

      {q.isLoading && <Carregando o="o financeiro" />}
      {q.isError && <ErroDaTela erro={q.error} aoTentar={() => q.refetch()} />}
      {q.data && <Ciclo dados={q.data} unico={unico} />}
    </>
  );
}

function Ciclo({ dados, unico }: { dados: FinanceiroResponse; unico: boolean }) {
  const fechar = useFecharCiclo();
  const erroFechar = fechar.error ? mensagemDeErro(fechar.error, 'Nao consegui fechar.') : null;

  const ehMesCorrente = dados.refMonth === refMonthAtual();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-2">
        <Stat
          rotulo={dados.totais.grossParcial ? 'Vendido (visível)' : 'Vendido no ciclo'}
          valor={fmtBRLPrecise(dados.totais.grossCents)}
          sub={fmtRefMonth(dados.refMonth)}
        />
        <Stat
          rotulo="Comissão"
          valor={fmtBRLPrecise(dados.totais.commissionCents)}
          sub={`+ ${fmtBRLPrecise(dados.totais.rentCents)} de aluguel`}
        />
        <Stat
          rotulo={unico ? 'Cobrança do ciclo' : 'A receber das cozinhas'}
          valor={fmtBRLPrecise(dados.totais.aReceberCents)}
          sub={dados.fechado ? 'ciclo fechado' : `fecha dia ${dados.closingDay}`}
          destaque
        />
      </div>
      <AvisoParcial cozinhasOcultas={dados.totais.cozinhasOcultas} />

      <div className="mt-8">
        <Divider
          label={
            dados.fechado
              ? `${dados.linhas.length} cozinha${dados.linhas.length === 1 ? '' : 's'} · valores congelados`
              : `${dados.linhas.length} cozinha${dados.linhas.length === 1 ? '' : 's'} · ainda subindo`
          }
        />
      </div>

      {!dados.fechado && (
        <p className="mt-3 font-sans text-body-sm text-inkMuted">
          Ciclo em andamento: os valores mudam a cada pedido. Só depois de fechar é que dá para
          marcar quem pagou.
        </p>
      )}

      {dados.linhas.length === 0 ? (
        <Vazio>Nenhuma cozinha neste ciclo.</Vazio>
      ) : (
        <Tabela linhas={dados.linhas} fechado={dados.fechado} />
      )}

      {!dados.fechado && !ehMesCorrente && (
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            variant="primary"
            size="sm"
            disabled={fechar.isPending}
            onClick={() => fechar.mutate(dados.refMonth)}
          >
            {fechar.isPending ? 'Fechando…' : `Fechar ${fmtRefMonth(dados.refMonth)}`}
          </Button>
        </div>
      )}
      {ehMesCorrente && !dados.fechado && (
        <p className="mt-6 text-right font-mono text-mono-sm text-inkDim">
          O mês corrente não fecha — ele ainda está acontecendo.
        </p>
      )}
      {erroFechar && (
        <p className="mt-3 text-right font-mono text-mono-sm text-danger">{erroFechar}</p>
      )}
    </>
  );
}

function Tabela({ linhas, fechado }: { linhas: CobrancaLinha[]; fechado: boolean }) {
  return (
    <div className="overflow-x-auto -mx-4 md:mx-0">
      <div className="min-w-[760px] md:min-w-0 px-4 md:px-0">
        <table className="w-full mt-2 text-left">
          <thead>
            <tr className="border-b border-hairline">
              <Th>Cozinha</Th>
              <Th className="text-right">Vendeu</Th>
              <Th className="text-right">Comissão</Th>
              <Th className="text-right">Aluguel</Th>
              <Th className="text-right">Deve</Th>
              <Th className="text-right">Status</Th>
              <Th className="text-right">Ação</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairlineSoft">
            {linhas.map((l) => (
              <Linha key={l.kitchenId} linha={l} fechado={fechado} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-hairline">
              <td className="py-3 pr-4 font-mono text-label uppercase tracking-wider text-inkDim">
                Total
              </td>
              <td className="py-3 pr-4 text-right font-mono text-body text-ink tabular-nums">
                {fmtBRLPrecise(linhas.reduce((a, l) => a + (l.grossCents ?? 0), 0))}
              </td>
              <td className="py-3 pr-4 text-right font-mono text-body text-inkMuted tabular-nums">
                {fmtBRLPrecise(linhas.reduce((a, l) => a + l.commissionCents, 0))}
              </td>
              <td className="py-3 pr-4 text-right font-mono text-body text-inkMuted tabular-nums">
                {fmtBRLPrecise(linhas.reduce((a, l) => a + l.rentCents, 0))}
              </td>
              <td className="py-3 pr-4 text-right font-mono text-mono-lg text-primary tabular-nums">
                {fmtBRLPrecise(linhas.reduce((a, l) => a + l.totalDueCents, 0))}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Linha({ linha, fechado }: { linha: CobrancaLinha; fechado: boolean }) {
  const marcar = useMarcarCobranca();

  return (
    <tr className="h-12 hover:bg-surface transition-colors duration-base ease-out">
      <td className="pr-4 font-display text-body-lg text-ink">{linha.kitchenName}</td>

      <td className="pr-4 text-right font-mono text-body text-ink tabular-nums">
        {/* `null` = paga só aluguel, o faturamento não é do dono. Um traço,
            nunca R$ 0,00 — zero diria que ela não vendeu nada. */}
        {linha.grossCents === null ? (
          <span className="text-inkDim" title="Paga só aluguel — o faturamento não aparece">
            —
          </span>
        ) : (
          fmtBRLPrecise(linha.grossCents)
        )}
      </td>

      <td className="pr-4 text-right font-mono text-body text-inkMuted tabular-nums">
        {linha.commissionCents > 0 ? (
          <>
            {fmtBRLPrecise(linha.commissionCents)}
            <span className="text-inkDim"> · {linha.commissionPct}%</span>
          </>
        ) : (
          <span className="text-inkDim">—</span>
        )}
      </td>

      <td className="pr-4 text-right font-mono text-body text-inkMuted tabular-nums">
        {linha.rentCents > 0 ? (
          fmtBRLPrecise(linha.rentCents)
        ) : (
          <span className="text-inkDim">—</span>
        )}
      </td>

      <td className="pr-4 text-right font-mono text-body-lg text-primary tabular-nums">
        {fmtBRLPrecise(linha.totalDueCents)}
      </td>

      <td className="pr-4 text-right">
        <StatusChip status={linha.status} />
      </td>

      <td className="text-right">
        {fechado && linha.chargeId && linha.status !== 'paga' ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={marcar.isPending}
            onClick={() => marcar.mutate({ id: linha.chargeId!, status: 'paga' })}
          >
            {marcar.isPending ? '…' : 'Marcar paga'}
          </Button>
        ) : (
          <span className="font-mono text-mono-sm text-inkDim">—</span>
        )}
      </td>
    </tr>
  );
}

function Stat({
  rotulo,
  valor,
  sub,
  destaque,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">{rotulo}</p>
      <p
        className={[
          'font-display text-[32px] leading-none tabular-nums',
          destaque ? 'text-primary' : 'text-ink',
        ].join(' ')}
      >
        {valor}
      </p>
      {sub && <p className="mt-1 font-mono text-mono-sm text-inkDim">{sub}</p>}
    </div>
  );
}

function StatusChip({ status }: { status: CobrancaLinha['status'] }) {
  const map = {
    aberta: { tone: 'warn' as const, rotulo: 'aberta' },
    fechada: { tone: 'primary' as const, rotulo: 'a cobrar' },
    paga: { tone: 'accent' as const, rotulo: 'paga' },
    atrasada: { tone: 'danger' as const, rotulo: 'atrasada' },
  }[status];
  return <Chip tone={map.tone}>{map.rotulo}</Chip>;
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`py-2 pr-4 font-mono text-label uppercase tracking-wider text-inkDim font-medium ${className}`}
    >
      {children}
    </th>
  );
}
