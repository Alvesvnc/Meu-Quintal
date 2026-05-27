import type { ReactNode } from 'react';

interface DividerProps {
  label?: ReactNode;
  className?: string;
}

/**
 * Divisor editorial: linha hairline com label uppercase mono opcional no centro.
 * Substitui titulos-de-secao genericos no MASTER.
 */
export function Divider({ label, className = '' }: DividerProps) {
  if (!label) {
    return <hr className={`border-0 border-t border-hairlineSoft dark:border-hairlineDark ${className}`} />;
  }
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <hr className="flex-1 border-0 border-t border-hairlineSoft dark:border-hairlineDark" />
      <span className="text-label uppercase text-inkDim dark:text-inkInverseDim font-sans">{label}</span>
      <hr className="flex-1 border-0 border-t border-hairlineSoft dark:border-hairlineDark" />
    </div>
  );
}
