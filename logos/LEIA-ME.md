# Logos QRO — guia de uso (para humanos e IAs)

Regra geral: **wordmark = HTML** (texto de verdade, escala e herda tudo) · **ícones = SVG** (geometria pura, funcionam em qualquer lugar). Cores: vermelho `#ec3013`, tinta `#201e1d`, claro `#f3f2f2`. Nunca esticar, arredondar, sombrear, nem usar wordmark e ícone lado a lado (o quadrado do wordmark JÁ É o ícone).

## Arquivos

| Arquivo               | O que é                                                                  | Onde usar                                                                                                     |
| --------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `qro-wordmark.html`   | A marca principal em HTML/CSS (variantes claro/escuro dentro do arquivo) | Header do site, login, e-mails, qualquer lugar onde o nome aparece — **copie o snippet de dentro do arquivo** |
| `qro-favicon.svg`     | Olho de QR sobre campo vermelho                                          | Favicon, avatar de redes/WhatsApp, ícone de app/atalho                                                        |
| `qro-icone-claro.svg` | Olho de QR sem fundo (tinta + vermelho)                                  | Ícone solto sobre fundo claro na UI: header da cozinha, loading, marca d'água                                 |

## Como colocar no site

Wordmark (abra `qro-wordmark.html`, copie o bloco `<style>` + o `<a class="qro-logo">`):

    <a href="/" class="qro-logo" aria-label="QRO">QR<span class="o"></span></a>

- Escala pelo `font-size` (tudo em `em` acompanha). Fundo vermelho/escuro: adicione a classe `clara`.
- Requisito único: Archivo 800 carregada na página — os apps já têm, porque o design
  system **hospeda a fonte** em `packages/design-system/src/fontes/`. Não puxe
  do Google Fonts: o CSP de produção bloqueia esse domínio.

Favicon (no `<head>` de cada app):

    <link rel="icon" type="image/svg+xml" href="/logo/qro-favicon.svg">
    <title>QRO</title>

Ícone avulso na UI:

    <img src="/logo/qro-icone-claro.svg" alt="" height="22">

## Tamanhos mínimos

Wordmark: `font-size` ≥ 16px. Ícones: ≥ 12px. Abaixo disso, não use nada.

## Ícones de app (PWA)

O app do restaurante é instalável, e o manifest exige PNG — navegador nenhum
aceita só SVG aqui. Os arquivos ficam em `apps/restaurante/public/logo/` e são
**derivados de `qro-favicon.svg`**, não desenhos novos:

| Arquivo                    | Tamanho | Papel                                          |
| -------------------------- | ------- | ---------------------------------------------- |
| `qro-app-192.png`          | 192×192 | Ícone padrão do manifest                       |
| `qro-app-512.png`          | 512×512 | Splash e listagens grandes                     |
| `qro-app-maskable-512.png` | 512×512 | `purpose: maskable` — Android                  |
| `qro-app-touch-180.png`    | 180×180 | `apple-touch-icon`; o iPhone ignora o manifest |

A variante **maskable** é a mesma geometria escalada a 0,75 em torno do centro.
Não é capricho: o Android recorta o ícone num círculo de 80% do lado, e no
arquivo normal os cantos do quadro encostam exatamente na linha do corte.

Se precisar regerar, escale o SVG — **não redesenhe**, e continue valendo a
regra geral: nunca arredondar, esticar nem sombrear.
