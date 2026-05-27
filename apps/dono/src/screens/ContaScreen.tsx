import { Button, Chip, Divider } from '@mq/design-system';
import { QUINTAL_INFO } from '../mocks/quintal';

/**
 * Tela 07 — Conta & equipe.
 */
export function ContaScreen() {
  return (
    <>
      <header className="mb-8">
        <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">
          Eu
        </p>
        <h1 className="font-display italic text-display-xl text-ink leading-tight">
          {QUINTAL_INFO.name}
        </h1>
      </header>

      <div className="max-w-2xl space-y-10">
        <section>
          <Divider label="Quintal" />
          <dl className="mt-4 divide-y divide-hairlineSoft">
            <Row label="Nome" value={QUINTAL_INFO.name} />
            <Row label="Mesas" value={`${QUINTAL_INFO.tablesTotal}`} />
            <Row label="Comissão padrão" value={`${QUINTAL_INFO.commissionPct}%`} />
            <Row label="Dia do repasse" value={`dia ${QUINTAL_INFO.payoutDay} do mês`} />
          </dl>
        </section>

        <section>
          <Divider label="Equipe" />
          <ul className="mt-4 divide-y divide-hairlineSoft">
            <li className="py-3 flex items-center gap-4">
              <span className="font-display text-body-lg text-ink">{QUINTAL_INFO.ownerName}</span>
              <span className="font-sans text-body-sm text-inkMuted">marina@meuquintal.app</span>
              <Chip tone="primary" className="ml-auto">dono</Chip>
            </li>
          </ul>
          <Button variant="secondary" size="md" className="mt-4">
            + Convidar pessoa
          </Button>
        </section>

        <section>
          <Divider label="Atalhos de teclado" />
          <dl className="mt-4 divide-y divide-hairlineSoft text-body">
            <Shortcut keys="/" desc="Busca rápida" />
            <Shortcut keys="g  o" desc="Ir pra Visão geral" />
            <Shortcut keys="g  r" desc="Ir pra Restaurantes" />
            <Shortcut keys="g  f" desc="Ir pra Financeiro" />
            <Shortcut keys="?"   desc="Ver todos os atalhos" />
          </dl>
        </section>

        <section className="pt-4">
          <Button variant="ghost" size="lg">
            Sair da conta
          </Button>
        </section>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3 flex items-baseline justify-between gap-4">
      <dt className="font-mono text-label uppercase tracking-wider text-inkDim">{label}</dt>
      <dd className="font-sans text-body text-ink">{value}</dd>
    </div>
  );
}

function Shortcut({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="py-2.5 flex items-center justify-between gap-4">
      <span className="font-sans text-body text-ink">{desc}</span>
      <kbd className="font-mono text-mono px-2 py-1 rounded-sm bg-surface border border-hairline text-inkMuted">
        {keys}
      </kbd>
    </div>
  );
}
