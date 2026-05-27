import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip, Divider } from '@mq/design-system';
import { MINHA_COZINHA, STATUS_LABEL, type KitchenStatus } from '../mocks/kitchen';
import { Switch } from '../components/Switch';

/**
 * Tela 07 — Perfil público da cozinha.
 *
 * É aqui que o responsável preenche o que apareceu pro cliente:
 *   foto, nome final, categoria, tagline, descrição, tempo de preparo.
 *
 * O dono do quintal apenas convida via email + define acordo financeiro
 * (não escolhe nome/foto/cardápio do restaurante de outra pessoa).
 */
export function PerfilScreen() {
  const navigate = useNavigate();

  // Form state
  const [name, setName]               = useState(MINHA_COZINHA.name);
  const [category, setCategory]       = useState(MINHA_COZINHA.category);
  const [tagline, setTagline]         = useState(MINHA_COZINHA.tagline);
  const [description, setDescription] = useState(MINHA_COZINHA.description);
  const [slaStr, setSlaStr]           = useState(String(MINHA_COZINHA.slaMinutes));
  const [active, setActive]           = useState(MINHA_COZINHA.status === 'ativa');
  const [photoUrl, setPhotoUrl]       = useState<string | undefined>(MINHA_COZINHA.photoUrl);

  // File picker
  const fileRef = useRef<HTMLInputElement>(null);
  const lastObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
    };
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
    const url = URL.createObjectURL(f);
    lastObjectUrlRef.current = url;
    setPhotoUrl(url);
    e.target.value = '';
  };

  const handleSave = () => {
    // Mock: aqui chamaria PATCH /api/me/kitchen
    alert(
      `Mock: salvar perfil\n` +
      `  ${name} · ${category}\n` +
      `  SLA ${slaStr} min · ${active ? 'ativa' : 'pausada'}`
    );
  };

  const status: KitchenStatus = active ? 'ativa' : 'pausada';

  return (
    <main className="pb-48 px-5">
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Identidade · o que o cliente vê
        </p>
        <h1 className="mt-1 font-display text-display-lg italic text-ink leading-tight text-pretty">
          Perfil da cozinha.
        </h1>
        <p className="mt-2 font-sans text-body text-inkMuted">
          O dono do quintal cuida do acordo financeiro. Aqui é com você:
          o que você vende, a foto, a frase, quanto tempo demora.
        </p>
      </section>

      {/* Status */}
      <section className="mt-7">
        <Divider label="Status" />
        <div className="mt-4 flex items-center justify-between gap-4 py-2">
          <div className="flex-1 min-w-0">
            <p className="font-sans text-body-lg text-ink">
              {active ? 'Aparecendo pro cliente' : 'Não aparece pro cliente'}
            </p>
            <p className="mt-0.5 font-sans text-body-sm text-inkMuted">
              {STATUS_LABEL[status]}
            </p>
          </div>
          <Switch checked={active} onChange={() => setActive(!active)} ariaLabel="Cozinha ativa" />
        </div>
      </section>

      {/* Foto */}
      <section className="mt-7">
        <Divider label="Foto da cozinha" />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <p className="mt-3 font-sans text-body-sm text-inkMuted mb-3">
          A foto principal — vai aparecer grande na lista de cozinhas. 4:5 vertical funciona melhor.
        </p>
        {photoUrl ? (
          <div className="relative rounded-md overflow-hidden bg-surface aspect-[4/5] max-w-[280px]">
            <img
              src={photoUrl}
              alt={`Foto da ${name}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 p-2 flex gap-2 bg-gradient-to-t from-ink/60 to-transparent">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex-1 h-10 px-3 rounded-md bg-bg/95 border border-hairline
                           font-sans text-body-sm text-ink cursor-pointer
                           hover:bg-primaryWash transition-colors duration-base ease-out"
              >
                Trocar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
                  setPhotoUrl(undefined);
                }}
                className="h-10 px-3 rounded-md bg-bg/95 border border-hairline
                           font-mono text-mono-sm uppercase tracking-wider text-inkDim cursor-pointer
                           hover:text-danger transition-colors duration-base ease-out"
              >
                Remover
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-[4/5] max-w-[280px] rounded-md border border-dashed border-hairline
                       bg-surface flex flex-col items-center justify-center gap-1 cursor-pointer
                       hover:border-primary hover:bg-primaryWash transition-colors duration-base ease-out"
          >
            <span className="font-display italic text-display-md text-inkMuted">
              Adicionar foto
            </span>
            <span className="font-mono text-mono-sm text-inkDim">
              4:5 · JPG ou PNG
            </span>
          </button>
        )}
      </section>

      {/* Texto */}
      <section className="mt-7">
        <Divider label="O que aparece pro cliente" />

        <Field label="Nome da cozinha" hint={`${name.length}/40`}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="ex: Lou Burger"
            className={inputCls}
          />
        </Field>

        <Field label="Categoria">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="ex: Hamburgueria, Frutos do mar, Feira…"
            className={inputCls}
          />
        </Field>

        <Field label="Frase curta" hint={`${tagline.length}/80 · 1 linha, 2 chaves do menu`}>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={80}
            placeholder="Hambúrguer de pasto, batata-doce frita."
            className={inputCls}
          />
        </Field>

        <Field label="Descrição" hint={`${description.length}/300 · opcional, aparece no cardápio`}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Conte algo sobre a casa, ingredientes, fornecedores…"
            className={`${inputCls} resize-none`}
          />
        </Field>
      </section>

      {/* Operação */}
      <section className="mt-7">
        <Divider label="Operação" />

        <Field label="Tempo médio de preparo" hint="aparece pro cliente como ~X min">
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={slaStr}
              onChange={(e) => setSlaStr(e.target.value.replace(/\D/g, ''))}
              className={`${inputCls} w-24 font-mono text-body-lg`}
            />
            <span className="font-mono text-body text-inkDim">minutos</span>
          </div>
          <p className="mt-2 font-sans text-body-sm text-inkDim">
            Se um pedido passa disso, fica marcado como atrasado no painel.
          </p>
        </Field>
      </section>

      {/* Preview do que cliente vê */}
      <section className="mt-7">
        <Divider label="Como você aparece pro cliente" />
        <ClientPreview
          name={name}
          tagline={tagline}
          category={category}
          slaMinutes={parseInt(slaStr) || 0}
          photoUrl={photoUrl}
          paused={!active}
        />
      </section>

      {/* CTA sticky */}
      <div className="fixed inset-x-0 bottom-16 z-30 pointer-events-none">
        <div className="mx-auto max-w-[480px] px-5 py-3 bg-bg/95 backdrop-blur-[2px] border-t border-hairline pointer-events-auto flex gap-3">
          <Button variant="ghost" size="lg" onClick={() => navigate('/eu')}>
            Voltar
          </Button>
          <Button variant="primary" size="lg" fullWidth onClick={handleSave}>
            Salvar
          </Button>
        </div>
      </div>
    </main>
  );
}

interface ClientPreviewProps {
  name: string;
  tagline: string;
  category: string;
  slaMinutes: number;
  photoUrl?: string;
  paused?: boolean;
}

/** Mini-card que simula como a cozinha aparece na lista do cliente. */
function ClientPreview({ name, tagline, category, slaMinutes, photoUrl, paused }: ClientPreviewProps) {
  return (
    <div className="mt-4" style={{ width: 200, maxWidth: 200, marginLeft: 'auto', marginRight: 'auto' }}>
      <div
        className="rounded-lg overflow-hidden bg-surface mb-3"
        style={{ width: 200, height: 250, display: 'block' }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            className="flex items-center justify-center font-mono text-mono-sm text-inkDim"
            style={{ width: '100%', height: '100%' }}
          >
            sem foto
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-mono-sm text-primary">01.</span>
        <h3 className="font-display leading-tight text-ink flex-1" style={{ fontSize: '20px' }}>
          {name || 'Sem nome'}
        </h3>
      </div>
      <p className="mt-1 font-mono text-mono-sm text-inkDim">
        ~{slaMinutes || '?'} min · {category || 'sem categoria'}
      </p>
      <p
        className="mt-1.5 font-sans text-body-sm text-inkMuted leading-snug"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {tagline || 'sem frase'}
      </p>
      {paused && (
        <div className="mt-2">
          <Chip tone="warn">pausada — cliente não vê</Chip>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
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
  'w-full px-4 py-3 bg-surface border border-hairline rounded-md ' +
  'font-sans text-body text-ink placeholder:text-inkDim ' +
  'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash';
