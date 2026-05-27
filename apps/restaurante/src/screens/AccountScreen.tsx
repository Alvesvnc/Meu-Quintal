import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Divider } from '@mq/design-system';
import { MINHA_COZINHA } from '../mocks/kitchen';
import { Switch } from '../components/Switch';

/**
 * Tela 06 — Conta / Eu. Configurações da cozinha + sair.
 */
export function AccountScreen() {
  const navigate = useNavigate();
  const [soundOn, setSoundOn] = useState(true);
  const [hapticOn, setHapticOn] = useState(true);

  return (
    <main className="px-5 pb-28">
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Cozinha
        </p>
        <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight">
          {MINHA_COZINHA.name}
        </h1>
        <p className="mt-2 font-sans text-body text-inkDim">
          {MINHA_COZINHA.ownerName} · SLA {MINHA_COZINHA.slaMinutes} min
        </p>

        <div className="mt-5">
          <Button variant="secondary" size="md" fullWidth onClick={() => navigate('/perfil')}>
            Editar perfil público
          </Button>
          <p className="mt-2 font-sans text-body-sm text-inkDim">
            Nome, foto, categoria, frase, tempo de preparo.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <Divider label="Avisos sonoros" />
        <ul className="mt-2 divide-y divide-hairlineSoft">
          <ToggleRow
            label="Som de pedido novo"
            help="Toca um sino curto quando entra pedido."
            checked={soundOn}
            onChange={setSoundOn}
          />
          <ToggleRow
            label="Vibração ao marcar pronto"
            help="Feedback tátil de confirmação."
            checked={hapticOn}
            onChange={setHapticOn}
          />
        </ul>
      </section>

      <section className="mt-8">
        <Divider label="Atalhos" />
        <ul className="mt-2 divide-y divide-hairlineSoft">
          <LinkRow label="Pré-visualizar push" onClick={() => navigate('/push')} />
          <LinkRow label="Histórico do dia"     onClick={() => navigate('/historico')} />
        </ul>
      </section>

      <section className="mt-10">
        <Button variant="ghost" size="lg" fullWidth onClick={() => alert('Mock: faria logout no MVP real')}>
          Sair
        </Button>
        <p className="mt-4 text-center font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Meu Quintal · cozinha v0.1
        </p>
      </section>
    </main>
  );
}

function ToggleRow({
  label, help, checked, onChange,
}: { label: string; help?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <li className="py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-sans text-body-lg text-ink">{label}</p>
        {help && <p className="mt-0.5 font-sans text-body-sm text-inkDim">{help}</p>}
      </div>
      <div className="mt-1">
        <Switch checked={checked} onChange={() => onChange(!checked)} ariaLabel={label} />
      </div>
    </li>
  );
}

function LinkRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full py-4 flex items-center justify-between gap-4 cursor-pointer
                   text-left font-sans text-body-lg text-ink
                   hover:text-primary transition-colors duration-base ease-out"
      >
        <span>{label}</span>
        <span aria-hidden className="font-mono text-mono text-inkDim">→</span>
      </button>
    </li>
  );
}
