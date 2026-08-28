import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Divider } from '@mq/design-system';
import { mensagemDeErro, type PerfilCozinhaResponse } from '@mq/shared';
import { usePerfil, useSalvarPerfil } from '../api/hooks';
import { Switch } from '../components/Switch';
import { ScreenError } from '../components/ScreenError';
import { FotoDaCozinha } from '../components/FotoDaCozinha';

/**
 * O que o cliente vê: nome, foto, categoria, frase, tempo de preparo.
 *
 * O dono do quintal cuida do acordo financeiro e não escolhe nada disto — é o
 * responsável pela cozinha que preenche.
 *
 * O SLUG NÃO ESTÁ AQUI de propósito. Ele é o endereço da cozinha dentro do
 * quintal: mudar quebraria link salvo, QR impresso e a sala de socket. Trocar
 * slug é operação do dono do espaço.
 *
 * A FOTO É UM ARQUIVO ENVIADO daqui — computador ou celular. O servidor
 * reencoda pra webp antes de guardar, então o cliente baixa uma imagem leve
 * mesmo quando a cozinha manda a foto crua de 9 MB do celular.
 *
 * O campo de URL continua existindo, mas SÓ pra quem já tinha um preenchido:
 * ele aponta pra imagem hospedada em outro site e some no dia em que aquele
 * site cair. Mesmo desenho do `EditItemSheet` com as fotos de prato.
 */
export function PerfilScreen() {
  const navigate = useNavigate();
  const q = usePerfil();
  const salvar = useSalvarPerfil();

  if (q.isLoading) {
    return (
      <main className="w-full max-w-[720px] mx-auto px-5 sm:px-6 py-12 font-sans text-body text-inkDim">
        Carregando…
      </main>
    );
  }
  if (q.isError || !q.data) {
    return (
      <ScreenError
        title="Nao consegui carregar o perfil."
        body={mensagemDeErro(q.error, 'O servidor nao respondeu.')}
        onRetry={() => q.refetch()}
      />
    );
  }

  return (
    <Formulario
      // `key` no id: se a query trouxer outra cozinha (troca de login), o
      // formulário remonta em vez de manter o rascunho da anterior.
      key={q.data.id}
      perfil={q.data}
      salvando={salvar.isPending}
      erro={salvar.error ? mensagemDeErro(salvar.error, 'Nao consegui salvar.') : null}
      onSalvar={(dados) => salvar.mutate(dados, { onSuccess: () => navigate('/eu') })}
      onCancelar={() => navigate('/eu')}
    />
  );
}

interface FormProps {
  perfil: PerfilCozinhaResponse;
  salvando: boolean;
  erro: string | null;
  onSalvar: (dados: {
    name: string;
    category: string | null;
    tagline: string | null;
    description: string | null;
    photoUrl: string | null;
    slaMinutes: number;
    status: 'ativa' | 'pausada';
  }) => void;
  onCancelar: () => void;
}

function Formulario({ perfil, salvando, erro, onSalvar, onCancelar }: FormProps) {
  const [name, setName] = useState(perfil.name);
  const [category, setCategory] = useState(perfil.category ?? '');
  const [tagline, setTagline] = useState(perfil.tagline ?? '');
  const [description, setDescription] = useState(perfil.description ?? '');
  const [photoUrl, setPhotoUrl] = useState(perfil.photoUrl ?? '');
  const [slaStr, setSlaStr] = useState(String(perfil.slaMinutes));
  const [ativa, setAtiva] = useState(perfil.status !== 'pausada');

  // A foto que aparece vem do campo antigo quando nao ha arquivo enviado — e o
  // servidor ja resolveu essa precedencia, entao basta comparar.
  const ehLegado = perfil.foto !== null && perfil.foto === perfil.photoUrl;

  const sla = Number(slaStr);
  const slaValido = Number.isInteger(sla) && sla >= 1 && sla <= 120;
  const nomeValido = name.trim().length >= 2;
  const podeSalvar = nomeValido && slaValido && !salvando;

  const enviar = () => {
    if (!podeSalvar) return;
    onSalvar({
      name: name.trim(),
      // Campo vazio vira `null`, não string vazia: `""` apareceria como uma
      // categoria de verdade nas telas do cliente e do dono.
      category: category.trim() || null,
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      photoUrl: photoUrl.trim() || null,
      slaMinutes: sla,
      status: ativa ? 'ativa' : 'pausada',
    });
  };

  return (
    <main className="w-full max-w-[720px] mx-auto px-5 sm:px-6 pb-48">
      <section className="pt-6">
        <p className="font-mono text-mono-sm uppercase tracking-wider text-inkDim">
          Identidade · o que o cliente vê
        </p>
        <h1 className="mt-1 font-display text-display-lg text-ink leading-tight text-pretty">
          Perfil da cozinha.
        </h1>
        <p className="mt-2 font-sans text-body text-inkMuted">
          O dono do quintal cuida do acordo financeiro. Aqui é com você: o que você vende, a foto, a
          frase, quanto tempo demora.
        </p>
      </section>

      <section className="mt-7">
        <Divider label="Status" />
        <div className="mt-4 flex items-center justify-between gap-4 py-2">
          <div className="flex-1 min-w-0">
            <p className="font-sans text-body-lg text-ink">
              {ativa ? 'Aparecendo pro cliente' : 'Não aparece pro cliente'}
            </p>
            <p className="mt-0.5 font-sans text-body-sm text-inkMuted">
              {ativa
                ? 'Sua cozinha está na lista do quintal.'
                : 'Pausada — ninguém consegue pedir até você voltar.'}
            </p>
          </div>
          <Switch checked={ativa} onChange={() => setAtiva(!ativa)} ariaLabel="Cozinha ativa" />
        </div>
      </section>

      <section className="mt-7">
        <Divider label="Foto da cozinha" />
        <p className="mt-3 font-sans text-body-sm text-inkMuted mb-4">
          Escolha uma foto do computador ou do celular. 4:5 vertical funciona melhor. Pode mandar a
          foto grande — ela é reduzida e convertida aqui, pro cardápio abrir rápido no 4G.
        </p>

        {/* A foto é salva NA HORA, fora do botão "Salvar" do formulário: ela
            já está no servidor quando o upload termina. Fingir que depende do
            botão faria a cozinha achar que perdeu a foto ao cancelar. */}
        <FotoDaCozinha foto={perfil.foto} nome={perfil.name} ehLegado={ehLegado} />

        {/* Legado: cozinha cadastrada antes de existir upload. Só aparece se
            já tiver valor — não há por que oferecer o caminho velho pra quem
            está começando agora. */}
        {photoUrl.trim() !== '' && (
          <Campo rotulo="Foto por endereço" dica="campo antigo">
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
            <p className="mt-2 font-sans text-body-sm text-inkMuted">
              {ehLegado
                ? 'Envie a foto acima e apague este endereço — assim ela fica guardada aqui e não depende de outro site continuar no ar.'
                : 'Sem efeito enquanto houver foto enviada. Fica guardado caso você remova a de cima.'}
            </p>
          </Campo>
        )}
      </section>

      <section className="mt-7">
        <Divider label="O que aparece pro cliente" />

        <Campo rotulo="Nome da cozinha" dica={`${name.length}/80`}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="ex: Lou Burger"
            className={inputCls}
          />
          {!nomeValido && (
            <p className="mt-2 font-mono text-mono-sm text-danger">
              O nome precisa de ao menos 2 letras.
            </p>
          )}
        </Campo>

        <Campo rotulo="Categoria">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={40}
            placeholder="ex: Hamburgueria, Frutos do mar, Feira…"
            className={inputCls}
          />
        </Campo>

        <Campo rotulo="Frase curta" dica={`${tagline.length}/120`}>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={120}
            placeholder="Hambúrguer de pasto, batata-doce frita."
            className={inputCls}
          />
        </Campo>

        <Campo rotulo="Descrição" dica={`${description.length}/600 · opcional`}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={600}
            rows={3}
            placeholder="Conte algo sobre a casa, ingredientes, fornecedores…"
            className={`${inputCls} resize-none`}
          />
        </Campo>
      </section>

      <section className="mt-7">
        <Divider label="Operação" />
        <Campo rotulo="Tempo de preparo" dica="usado pra marcar pedido atrasado">
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              value={slaStr}
              onChange={(e) => setSlaStr(e.target.value.replace(/\D/g, ''))}
              className={`${inputCls} w-24 font-mono`}
            />
            <span className="font-sans text-body text-inkMuted">minutos</span>
          </div>
          {!slaValido && (
            <p className="mt-2 font-mono text-mono-sm text-danger">Entre 1 e 120 minutos.</p>
          )}
        </Campo>
      </section>

      {erro && <p className="mt-6 font-mono text-mono-sm text-danger">{erro}</p>}

      <div className="mt-8 space-y-2">
        <Button variant="primary" size="lg" fullWidth disabled={!podeSalvar} onClick={enviar}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button variant="ghost" size="lg" fullWidth onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </main>
  );
}

function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <label className="font-mono text-label uppercase tracking-wider text-inkDim">
          {rotulo}
        </label>
        {dica && (
          <span className="font-mono text-mono-sm text-inkDim normal-case tracking-normal text-right">
            {dica}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-4 py-3 bg-surface border border-hairline  ' +
  'font-sans text-body text-ink placeholder:text-inkDim ' +
  'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash';
