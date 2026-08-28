interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}

/**
 * Chave liga/desliga: trilho retangular com moldura e botão QUADRADO.
 *
 * Sem raio, como todo o resto do sistema — a pílula com bolinha era a única
 * forma arredondada que restava na tela. O estado ligado preenche o trilho de
 * vermelho; desligado, ele fica vazio com o botão em tinta escura. A posição
 * sozinha já diria, mas o preenchimento é o que se lê de relance.
 *
 * Geometria em PIXEL e não em classe rem: esta peça tem tamanho fixo, e o
 * corpo do app pode mudar de tamanho de fonte sem que a chave mude junto.
 */
export function Switch({ checked, onChange, ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={[
        'shrink-0 relative rounded-none cursor-pointer border',
        'transition-colors duration-base ease-out',
        checked ? 'bg-accent border-accent' : 'bg-surface border-divider',
      ].join(' ')}
      style={{ width: '52px', height: '28px' }}
    >
      <span
        aria-hidden
        className={[
          'absolute block rounded-none',
          'transition-all duration-base ease-out',
          checked ? 'bg-bg' : 'bg-neutral-700',
        ].join(' ')}
        style={{
          width: '18px',
          height: '18px',
          top: '4px',
          left: checked ? '28px' : '4px',
        }}
      />
    </button>
  );
}
