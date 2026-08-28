import { MOTIVOS_CANCELAMENTO, MOTIVO_LABEL, type MotivoCancelamento } from '@mq/shared';

interface Props {
  valor: MotivoCancelamento | null;
  onChange: (m: MotivoCancelamento) => void;
  texto: string;
  onTextoChange: (t: string) => void;
}

/**
 * Categoria do cancelamento — o que vira métrica.
 *
 * Botões e não um campo de texto: texto livre não agrega. "acabou o pão",
 * "sem pão" e "pao acabou" são a mesma causa escrita de três jeitos, e nenhum
 * número sai disso. O campo livre continua existindo ao lado, mas com outra
 * função: é o que o CLIENTE lê.
 *
 * Escolhendo "outro", o texto vira obrigatório. Sem essa regra, "outro" é o
 * caminho mais rápido para quem está com a mão ocupada — e a métrica morre.
 */
export function SeletorDeMotivo({ valor, onChange, texto, onTextoChange }: Props) {
  const precisaDeTexto = valor === 'outro';
  const textoCurto = texto.trim().length < 3;

  return (
    <div>
      <p className="font-mono text-label uppercase tracking-wider text-inkDim">
        Por que?
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {MOTIVOS_CANCELAMENTO.map((m) => {
          const ativo = valor === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              className={[
                // min-h-11: alvo de toque numa tela que pode estar engordurada
                'min-h-11 px-3 py-2 text-left',
                'font-sans text-body-sm border transition-colors duration-base ease-out',
                ativo
                  ? 'border-primary bg-primary text-bg'
                  : 'border-hairline text-inkDim',
              ].join(' ')}
            >
              {MOTIVO_LABEL[m]}
            </button>
          );
        })}
      </div>

      <label className="mt-4 block">
        <span className="font-mono text-label uppercase tracking-wider text-inkDim">
          {precisaDeTexto ? 'Explique (obrigatório)' : 'Detalhe (o cliente vai ler)'}
        </span>
        <input
          type="text"
          value={texto}
          onChange={(e) => onTextoChange(e.target.value)}
          maxLength={140}
          placeholder={
            precisaDeTexto ? 'o que aconteceu?' : 'acabou a costela, só tenho frango…'
          }
          className={[
            'mt-2 w-full bg-surface px-4 py-3',
            'font-sans text-body text-ink placeholder:text-inkDim border',
            'focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primaryWash',
            precisaDeTexto && textoCurto ? 'border-danger' : 'border-hairline',
          ].join(' ')}
        />
      </label>

      {precisaDeTexto && textoCurto && (
        <p className="mt-2 font-mono text-mono-sm text-danger">
          Escolhendo “outro”, explique o motivo.
        </p>
      )}
    </div>
  );
}
