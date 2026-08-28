import { describe, it, expect } from 'vitest';
import { fotoDaCozinha } from './fotoDaCozinha.js';

/**
 * A regra é de precedência, e ela aparece em quatro rotas (quintal, cardápio,
 * perfil e /me). O que estes testes seguram é que as quatro contem a mesma
 * história — foto enviada ganha da URL antiga, e a URL antiga não some.
 */
describe('fotoDaCozinha', () => {
  it('sem nada, nao ha foto', () => {
    expect(fotoDaCozinha({ photoKey: null, photoUrl: null })).toBeNull();
  });

  it('so a URL antiga: ela ainda serve', () => {
    expect(fotoDaCozinha({ photoKey: null, photoUrl: 'https://exemplo.com/a.jpg' })).toBe(
      'https://exemplo.com/a.jpg',
    );
  });

  it('so a foto enviada: caminho publico do nosso arquivo', () => {
    expect(fotoDaCozinha({ photoKey: 'abc.webp', photoUrl: null })).toBe('/api/fotos/abc.webp');
  });

  it('as duas: a ENVIADA ganha — foi a ultima escolha da cozinha', () => {
    expect(fotoDaCozinha({ photoKey: 'abc.webp', photoUrl: 'https://exemplo.com/a.jpg' })).toBe(
      '/api/fotos/abc.webp',
    );
  });
});
