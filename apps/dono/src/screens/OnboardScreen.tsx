import { useState } from 'react';
import { Button, Divider } from '@mq/design-system';
import { mensagemDeErro, type ConviteResponse } from '@mq/shared';
import { useConvidarCozinha } from '../api/hooks';

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
  const convidar = useConvidarCozinha();
  const [convite, setConvite] = useState<ConviteResponse | null>(null);
  const [internalName, setInternalName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  // Acordo financeiro — ambos opcionais, mas pelo menos um deve estar ativo
  const [chargeCommission, setChargeCommission] = useState(true);
  const [commissionPct, setCommissionPct] = useState(15);

  const [chargeRent, setChargeRent] = useState(false);
  const [rentReais, setRentReais] = useState('800');

  const noAgreement = !chargeCommission && !chargeRent;
  const canSend =
    !!internalName.trim() && !!ownerEmail.trim() && !noAgreement && !convidar.isPending;

  const enviar = () => {
    convidar.mutate(
      {
        email: ownerEmail.trim(),
        kitchenName: internalName.trim(),
        chargeCommission,
        commissionPct: chargeCommission ? commissionPct : null,
        chargeRent,
        rentCents: chargeRent ? Number(rentReais || 0) * 100 : 0,
      },
      { onSuccess: setConvite },
    );
  };

  const erro = convidar.error
    ? mensagemDeErro(convidar.error, 'Nao consegui criar o convite.')
    : null;

  // Convite criado: o link aparece UMA vez. Depois disto so existe o hash no
  // banco, e nao ha rota que devolva o link de novo — por isso a tela para
  // tudo e mostra so ele, em vez de voltar pro formulario.
  if (convite) {
    return (
      <ConviteCriado
        convite={convite}
        aoNovo={() => {
          setConvite(null);
          setInternalName('');
          setOwnerEmail('');
        }}
      />
    );
  }

  return (
    <>
      <header className="mb-8">
        <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">
          Configurar · novo restaurante
        </p>
        <h1 className="font-display text-display-xl text-ink leading-tight text-pretty">
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
          <div className="border border-hairline p-4">
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
                  Percentual do que a cozinha fatura. Ela cobra o cliente no próprio caixa e te
                  deve essa parte no fim do ciclo.
                </p>
                <p className="mt-1 font-sans text-body-sm text-inkDim">
                  Com comissão, você passa a ver quanto essa cozinha vende — o bruto é a base do
                  cálculo. Só com aluguel, não vê.
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
          <div className="border border-hairline p-4 mt-3">
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
                  Valor fixo da casinha, devido todo mês independente do que ela vende — e por
                  isso o faturamento dela não aparece pra você.
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
        <Button variant="primary" size="lg" disabled={!canSend} onClick={enviar}>
          {convidar.isPending ? 'Criando…' : 'Criar convite'}
        </Button>
      </div>

      {erro && <p className="mt-3 max-w-2xl font-mono text-mono-sm text-danger">{erro}</p>}

      <p className="mt-6 max-w-2xl font-sans text-body-sm text-inkDim">
        Ainda não há envio de email configurado: o link do convite aparece aqui na tela e você
        manda pro responsável pelo canal que preferir. Ele vale 7 dias e serve uma vez só.
      </p>
    </>
  );
}

/**
 * O link do convite aparece UMA vez.
 *
 * Depois de criado, o banco guarda só o hash — não existe rota que devolva o
 * link de novo, e não deve existir: link recuperável a qualquer momento vale
 * tanto quanto senha guardada em texto puro.
 */
function ConviteCriado({ convite, aoNovo }: { convite: ConviteResponse; aoNovo: () => void }) {
  const link = convite.linkDeAceite;
  const expira = new Date(convite.expiresAt).toLocaleDateString('pt-BR');

  return (
    <>
      <header className="mb-8">
        <p className="font-mono text-label uppercase tracking-wider text-inkDim mb-1">
          Configurar · convite criado
        </p>
        <h1 className="font-display text-display-xl text-ink leading-tight">
          Convite pronto pra {convite.email}.
        </h1>
      </header>

      <div className="max-w-2xl">
        <Divider label="Link de aceite" />
        <p className="mt-4 font-sans text-body text-inkMuted">
          Copie agora. Este link não aparece de novo — daqui pra frente o sistema guarda só o
          hash dele, do mesmo jeito que faz com senha.
        </p>

        <div className="mt-4 p-4 bg-surface border border-hairline">
          <code className="block font-mono text-mono text-ink break-all">{link ?? '—'}</code>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {link && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigator.clipboard?.writeText(link)}
            >
              Copiar link
            </Button>
          )}
          <Button variant="ghost" size="md" onClick={aoNovo}>
            Convidar outra cozinha
          </Button>
        </div>

        <p className="mt-6 font-sans text-body-sm text-inkDim">
          Vale até {expira} e serve uma vez só.
        </p>
      </div>
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
  'w-full px-3 py-2 h-10 bg-surface border border-hairline ' +
  'font-sans text-body text-ink placeholder:text-inkDim ' +
  'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash';
