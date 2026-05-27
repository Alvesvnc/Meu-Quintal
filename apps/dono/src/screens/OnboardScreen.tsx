import { useState } from 'react';
import { Button, Divider } from '@mq/design-system';

/**
 * Tela 03 — Convidar nova cozinha.
 *
 * O dono do quintal só define o que é DECISÃO DELE:
 *  - quem é o responsável (email pra convite)
 *  - acordo financeiro (comissão e/ou aluguel)
 *
 * Tudo que é IDENTIDADE da cozinha (nome final, foto, cardápio, tagline,
 * categoria, SLA) fica pro responsável preencher depois de aceitar o convite.
 *
 * Decidido em 2026-05-26: enxugar essa tela. O dono não escolhe a foto da
 * cozinha de outra pessoa.
 */
export function OnboardScreen() {
  const [internalName, setInternalName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  // Acordo financeiro — ambos opcionais, mas pelo menos um deve estar ativo
  const [chargeCommission, setChargeCommission] = useState(true);
  const [commissionPct, setCommissionPct] = useState(15);

  const [chargeRent, setChargeRent] = useState(false);
  const [rentReais, setRentReais] = useState('800');

  const noAgreement = !chargeCommission && !chargeRent;
  const canSend = internalName.trim() && ownerEmail.trim() && !noAgreement;

  return (
    <>
      <header className="mb-8">
        <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">
          Configurar · novo restaurante
        </p>
        <h1 className="font-display italic text-display-xl text-ink leading-tight text-pretty">
          {internalName.trim() || 'Convidar uma cozinha pro quintal.'}
        </h1>
        <p className="mt-3 font-sans text-body-lg text-inkMuted max-w-xl">
          Você só define quem vai operar e como vai ser o acordo financeiro.
          O responsável preenche nome final, foto, cardápio e o resto quando aceita o convite.
        </p>
      </header>

      <div className="space-y-10 max-w-2xl">
        <Section label="Convite">
          <Field label="Nome interno da cozinha" hint="só pra você identificar — o responsável pode mudar depois">
            <input
              type="text"
              value={internalName}
              onChange={(e) => setInternalName(e.target.value)}
              maxLength={40}
              placeholder="ex: Cozinha da esquina, Pizzaria do Tio Léo…"
              className={inputCls}
            />
          </Field>

          <Field label="Email do responsável" hint="vai receber o convite com link de cadastro">
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="responsavel@cozinha.com"
              className={inputCls}
            />
          </Field>
        </Section>

        <Section label="Acordo financeiro">
          <p className="font-sans text-body text-inkMuted mb-4">
            Pelo menos uma das duas tem que estar ativa. Pode ser só comissão,
            só aluguel fixo, ou os dois.
          </p>

          {/* Comissão */}
          <div className="border border-hairline rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={chargeCommission}
                onChange={(e) => setChargeCommission(e.target.checked)}
                className="w-4 h-4 mt-1 accent-primary cursor-pointer"
              />
              <div className="flex-1">
                <p className="font-sans text-body-lg text-ink">
                  Comissão sobre as vendas
                </p>
                <p className="mt-0.5 font-sans text-body-sm text-inkMuted">
                  Percentual do que a cozinha fatura, descontado no repasse.
                </p>
              </div>
            </label>

            {chargeCommission && (
              <div className="pl-7 pt-3 border-t border-hairlineSoft">
                <Field label={`${commissionPct}% sobre o bruto`}>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={5} max={25} step={1}
                      value={commissionPct}
                      onChange={(e) => setCommissionPct(parseInt(e.target.value))}
                      className="flex-1 accent-primary cursor-pointer"
                    />
                    <span className="w-16 text-right font-mono text-body-lg text-primary tabular-nums">
                      {commissionPct}%
                    </span>
                  </div>
                  <p className="mt-2 font-sans text-body-sm text-inkDim">
                    Sugerido: 15%. Pra cozinhas convidadas/parceiras, 5–10%.
                  </p>
                </Field>
              </div>
            )}
          </div>

          {/* Aluguel fixo */}
          <div className="border border-hairline rounded-lg p-4 mt-3">
            <label className="flex items-start gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={chargeRent}
                onChange={(e) => setChargeRent(e.target.checked)}
                className="w-4 h-4 mt-1 accent-primary cursor-pointer"
              />
              <div className="flex-1">
                <p className="font-sans text-body-lg text-ink">
                  Aluguel fixo mensal
                </p>
                <p className="mt-0.5 font-sans text-body-sm text-inkMuted">
                  Valor fixo da casinha, cobrado todo mês independente do que vende.
                </p>
              </div>
            </label>

            {chargeRent && (
              <div className="pl-7 pt-3 border-t border-hairlineSoft">
                <Field label="Valor por mês">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-body-lg text-inkMuted">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={rentReais}
                      onChange={(e) => setRentReais(e.target.value.replace(/\D/g, ''))}
                      className={`${inputCls} w-32 font-mono text-body-lg`}
                    />
                    <span className="font-mono text-mono-sm text-inkDim">/ mês</span>
                  </div>
                </Field>
              </div>
            )}
          </div>

          {noAgreement && (
            <p className="mt-3 font-mono text-mono-sm uppercase tracking-wider text-danger">
              Marque pelo menos uma forma de cobrança.
            </p>
          )}
        </Section>
      </div>

      <div className="mt-12 pt-6 border-t border-hairline max-w-2xl flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button
          variant="primary"
          size="lg"
          disabled={!canSend}
          onClick={() =>
            alert(
              `Mock: convidar ${ownerEmail} pra operar "${internalName}".\n` +
              `Acordo: ${chargeCommission ? `${commissionPct}% comissão` : ''}${chargeCommission && chargeRent ? ' + ' : ''}${chargeRent ? `R$ ${rentReais}/mês aluguel` : ''}.`
            )
          }
        >
          Enviar convite
        </Button>
        <Button variant="ghost" size="lg" onClick={() => alert('Mock: salvar rascunho')}>
          Salvar rascunho
        </Button>
      </div>

      <p className="mt-6 max-w-2xl font-sans text-body-sm text-inkDim">
        O responsável recebe um email com link de cadastro. Após aceitar, ele preenche
        nome final, descrição, foto, cardápio e demais detalhes da cozinha. Você é avisada
        quando a cozinha estiver pronta pra publicar no quintal.
      </p>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <Divider label={label} />
      <div className="mt-4 space-y-5">
        {children}
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <label className="font-mono text-label uppercase tracking-wider text-inkDim">
          {label}
        </label>
        {hint && (
          <span className="font-mono text-mono-sm text-inkDim normal-case tracking-normal text-right">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 h-10 bg-surface border border-hairline rounded-md ' +
  'font-sans text-body text-ink placeholder:text-inkDim ' +
  'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash';
