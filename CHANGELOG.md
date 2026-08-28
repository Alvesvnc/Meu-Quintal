# Changelog

Todas as mudanças relevantes deste projeto. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento
segue [SemVer](https://semver.org/lang/pt-BR/).

## Como versionar aqui

Este é um **produto**, não uma biblioteca publicada — ninguém depende da nossa
API de código. Então o SemVer se aplica ao que os clientes enxergam:

| Parte | Sobe quando |
|---|---|
| `MAJOR` | Quebra de contrato da API HTTP/WebSocket, ou migração que exige intervenção manual no deploy |
| `MINOR` | Funcionalidade nova compatível com o que já existe |
| `PATCH` | Correção, ajuste de performance, mudança interna sem efeito visível |

A versão vive no `package.json` da raiz. Os workspaces ficam em `0.0.1` de
propósito: são privados, nunca publicados, e versioná-los separadamente só
criaria trabalho de sincronização sem ninguém para consumir.

Ao lançar: atualize a versão da raiz, mova o bloco `Não lançado` para uma seção
nova com a data, e crie a tag `vX.Y.Z` — o CI publica a imagem com essa tag.

---

## Não lançado

### Adicionado

- **As seções do cardápio passaram a ser da cozinha.** Eram um enum de quatro
  valores — entradas, pratos, sobremesas, bebidas — iguais para todo mundo: uma
  padaria tinha que chamar pão de "prato" e uma drinkeria não tinha onde pôr os
  drinks. Agora cada cozinha escreve, renomeia, reordena e apaga os títulos
  dela, em `/cardapio` do app do restaurante. Rotas novas: `POST`, `PATCH` e
  `DELETE /api/r/cardapio/categorias[/:id]` mais `PATCH
  /api/r/cardapio/categorias/ordem`. Renomear NÃO move item de lugar (o item
  aponta para o id, não para o texto), e apagar uma seção com prato dentro exige
  dizer para onde os pratos vão. **Quebra de contrato**: `category` saiu de
  `GET /api/m/k/:slug` e `GET /api/r/cardapio`, substituído por `categoriaId`
  mais uma lista `categorias` na resposta. Toda cozinha que já existia foi
  migrada com as mesmas quatro seções de antes, na mesma ordem, e nenhum
  cardápio mudou de aparência.

- **Miniatura dos itens nas telas de pedido.** `GET /api/m/pedidos` passou a
  devolver `itens[]` (id, nome, quantidade e capa) e `GET /api/m/pedido/:id`
  ganhou `foto` em cada linha. É o que permite a lista de pedidos trocar "2
  itens" em texto por uma fileira de fotos — sem isso, desenhar a tela exigiria
  uma consulta por item só pra achar a imagem. Item cancelado não entra: a
  fileira mostra o que VAI CHEGAR. Campos aditivos; nada no contrato mudou de
  forma.

- **Foto de verdade no cardápio — e mais de uma por prato.** A cozinha envia
  até seis fotos por item; a primeira é a capa, que é a única que aparece na
  lista. No app do cliente elas viram uma galeria com rolagem por gesto, que é
  onde ele decide o que pedir.

  **O arquivo nunca é guardado como veio.** Reencodar resolve quatro coisas de
  uma vez: prova que aquilo é mesmo uma imagem (extensão e `content-type` são
  escritos por quem envia), reduz foto de celular de 4–12 MB para algo que abre
  no 4G dentro do restaurante, barra bomba de descompressão — e **apaga o
  EXIF**, que numa foto de celular carrega a coordenada de onde ela foi tirada.
  Cozinheira que fotografa o prato em casa teria o endereço publicado junto com
  o cardápio. A orientação do EXIF é aplicada antes de descartar, senão o prato
  chega deitado.

  A chave do arquivo é aleatória, nunca o nome enviado. `/api/fotos/:chave` é
  pública de propósito: `<img src>` não manda `Authorization`, então imagem com
  token simplesmente não aparece — o que protege é a chave de 128 bits, e o
  conteúdo é público por natureza.
- **O app do restaurante deixou de ser meia casca.** As sete telas que liam de
  mock passaram a falar com o servidor: cardápio (criar, editar, esgotar,
  excluir), perfil público, histórico do dia, métricas de operação e conta. O
  contador de pedidos no cabeçalho e no menu agora vem da **mesma consulta que
  desenha a fila** — havia um store paralelo alimentado por mock, então o badge
  mostrava um número e a fila logo abaixo mostrava outro, na mesma tela.
  `src/mocks/` e `src/stores/queue.ts` foram apagados.
- **Cardápio editável pela cozinha.** Oito rotas novas em `/api/r/*`, num módulo
  separado da operação: a fila fica aberta o dia inteiro num tablet e é o
  caminho quente; isto é consultado de vez em quando.
- **Excluir item do cardápio arquiva, não apaga.** `MenuItem.archivedAt`.
  `OrderItem` referencia `MenuItem` com `Restrict`: um DELETE de verdade
  falharia em qualquer item já vendido — e "consertar" isso com `Cascade`
  apagaria o histórico de pedidos junto, reescrevendo faturamento de ciclo já
  fechado. Arquivado some do cardápio do cliente e não pode ser pedido nem por
  quem estava com a página velha aberta; o que já foi vendido fica intacto.
- **A cozinha pode se pausar.** Botão na tela de conta: para de receber pedido
  novo sem abandonar quem já está na fila.
- **Ranking de desempenho das mesas.** A tela de mesas responde qual mesa dá mais
  retorno — e não "onde ficam as mesas grandes", que é o que um ranking cru por
  valor mostraria. Cada mesa aparece com o faturamento, quanto isso é acima ou
  abaixo da **média do salão**, e o giro (pedidos e em quantos dias distintos).
  A média usa só mesas ativas que existiam no início do período: mesa cadastrada
  no dia 28 teve três dias para faturar e puxaria o número para baixo, fazendo
  todas as outras parecerem melhores. Mesa ativa que vendeu zero entra na média
  — isso é sinal, não ruído.

  O valor do mês fica **em cima do número de cada mesa**, no próprio desenho do
  salão: o ranking se lê olhando o layout, sem tabela. Média, giro e ticket
  ficam no painel lateral ao clicar.
- **O app do dono deixou de ser casca.** Todas as telas passaram a ler do
  servidor: visão geral, restaurantes, convite de cozinha, financeiro, mesas e
  conta. Login próprio, com o token em chave separada da do app do restaurante —
  no restaurante único a mesma pessoa abre os dois. `src/mocks/` foi apagado.
  O que o mock mostrava e a API não tem (gráfico por hora, itens mais vendidos,
  alertas que o servidor não sabe responder) foi **removido em vez de
  preenchido com invenção**.
- **Modo restaurante único.** O espaço deixou de precisar ter várias cozinhas.
  `Space.tipo` distingue praça de alimentação de restaurante único; no segundo,
  o cliente cai direto no cardápio e as telas param de falar em "quintal". A
  decisão é pelo tipo, nunca por "só tem uma cozinha" — uma praça com uma
  cozinha só continua sendo uma praça.
- **Login único para quem é dono e cozinha ao mesmo tempo.** `AccountUser`
  pode estar vinculado a uma `Kitchen`, e então o token de dono também abre
  `/api/r/*`. O vínculo é reconferido no banco a cada request, porque o token
  vale sete dias e pode ter sido revogado nesse intervalo. O caminho contrário
  não existe: um usuário de cozinha nunca vira dono. No modo único a comissão e
  o aluguel nascem desligados — não se cobra de si mesmo.
- **Alteração de pedido pela cozinha.** A cozinha propõe reduzir quantidade ou
  cancelar itens; o cliente aceita ou recusa numa tela que interrompe o que ele
  estiver fazendo, com som e vibração. Recusar cancela o item por inteiro — a
  cozinha não tem o ingrediente para entregar o original. Sem resposta em 5
  minutos vale como recusa, e a fila da cozinha não trava esperando. A cozinha
  acompanha a proposta aberta com contador regressivo no próprio card, e uma
  varredura periódica encerra o que vence — segura com várias réplicas sem lock
  distribuído.
- **Motivo de cancelamento como métrica.** Categoria fechada (acabou
  ingrediente, não dou conta no tempo, equipamento, fim de expediente, item
  errado no cardápio, cliente desistiu, outro) gravada no item, com o texto
  livre ao lado para o cliente ler. Nova tela na cozinha mostra o que mais faz
  cancelar e quanto deixou de ser vendido. Antes o motivo era validado e
  descartado — a cozinha escrevia achando que servia para alguma coisa.
- **Multi-tenant.** `Account` acima de `Space`, com `AccountUser` (papéis
  owner/admin/staff), convites e isolamento por `accountId` em toda query.
- **App do dono (backend).** 11 rotas em `/api/a/*`: overview, cozinhas, acordo
  financeiro, convite, financeiro, fechamento de ciclo, cobranças e mesas.
- **Modelo de cobrança.** `BillingCycle` e `KitchenCharge` — a cozinha deve
  comissão + aluguel ao quintal; o dinheiro não passa pelo app.
- **Autenticação do Socket.io.** Handshake exige credencial; entrada em sala é
  conferida contra ela. Salas passam a ser endereçadas por ID, não por slug.
- **Deploy.** Imagem Docker do server (Alpine, 469 MB) e dos três apps
  (nginx-unprivileged, ~74 MB), mais `docker-compose.prod.yml`.
- **CI.** Cinco jobs: `check`, `migrations`, `isolamento`, `image-server`,
  `image-front`.
- **Observabilidade.** `x-request-id` em toda resposta e `/metrics` no formato
  Prometheus, protegida por `METRICS_TOKEN` e desabilitada por padrão.
- **`bootstrap`.** Comando de onboarding: cria conta, dono e primeiro quintal.
  Vai no bundle, então roda na imagem de produção.
- **Sentry**, desligado por padrão (`SENTRY_DSN` vazio = no-op). Só 5xx
  desconhecido vira evento; `beforeSend` apaga token, senha e hash antes de
  qualquer envio, com 14 testes cobrindo o scrubbing.
- **`useAgora`**, ticker compartilhado no design system: um único timer para
  todos os componentes, com resync ao voltar para a aba.
- **`mensagemDeErro`** em `@mq/shared`: extrai a mensagem do servidor sem
  depender de axios e sem `any`.
- **506 testes** (funções puras, rotas HTTP com Prisma mockado, integração
  real do Socket.io, hooks) e uma sonda de isolamento multi-tenant contra
  Postgres real. Cobertura: 62% de linha, 85% de branch.
- **LICENSE proprietária.** O README anunciava MIT e o arquivo nunca existiu.

### Alterado

- **O sistema agora se chama QRO.** O nome diz o que ele é: o QR da mesa. "Meu
  Quintal" não sumiu — desceu de marca do produto para nome do espaço-exemplo,
  o food-court fictício do seed. Quem assina o QRO é o dono de um quintal.

  Trocou a marca visível nos três apps (header do cliente, login do dono e do
  restaurante, top bar do admin), os `<title>`, o favicon e os domínios, que
  passaram para `qro.com.br` e `qro.app`. O wordmark é **HTML, não imagem**:
  "QR" em Archivo 800 mais um quadrado vazado no lugar do "O". Como ele escala
  pelo `font-size` e herda a cor, virou componente do design system (`Logo`,
  `LogoIcone`) em vez de arquivo numa pasta de assets — o único SVG é o favicon,
  que precisa ser arquivo mesmo. O quadrado do wordmark JÁ É o ícone: marca e
  ícone lado a lado é erro de uso.

  As imagens e containers docker passaram de `meu-quintal-*` para `qro-*` e o
  compose de produção virou `qro-prod` — **o deploy exige rebuild das imagens**,
  senão o compose sobe procurando tag que não existe. A documentação de desenho
  mudou de `docs/design-system/meu-quintal/` para `docs/design-system/qro/`.

  O scope dos pacotes (`@mq/*`) ficou como estava: é identificador interno, não
  aparece para o usuário, e renomeá-lo tocaria todos os imports sem ganho algum.

- **Redesign completo do front: o sistema Modernist.** A identidade anterior
  (Fraunces itálico + DM Sans + JetBrains Mono, paleta terracota e creme, verde
  pra "pronto", cantos arredondados) foi substituída por uma família só —
  **Archivo** —, vermelho `#ec3013` sobre fundo claro, **raio zero em tudo** e
  grade modular com réguas de 2px. O handoff canônico e o protótipo das sete
  telas moram em `docs/design-system/qro/modernist/`; o MASTER foi
  reescrito.

  **A foto continua colorida, e esse é o único ponto em que divergimos do
  handoff de propósito.** Ele mandava todo `<img>` de conteúdo em P&B pra que só
  o vermelho carregasse cor. Com fotos reais na tela, prato em cinza some — e a
  tela existe justamente pra dar vontade. A interface segue monocromática com um
  acento só; a cor entra apenas pela fotografia.

  **O que o redesign resolve não é gosto, é leitura.** O app era textual demais
  pra onde é usado: de pé, com fome, num salão barulhento. A tela de pedidos era
  o caso extremo — cada pedido virava três linhas de rótulo e uma timeline de
  quatro palavras, e "o seu está pronto, pode buscar" chegava por último, em
  cinza. Agora estado é **bloco**: pedido pronto é um pôster vermelho sólido com
  uma frase de 26px; em andamento é uma barra segmentada de quatro células onde
  a proporção se lê antes de qualquer palavra; "2 itens" virou uma fileira de
  miniaturas. Na fila da cozinha, o número da mesa virou um tile preenchido de
  54×54 — é a única informação que precisa ser legível a um metro, de pé, com as
  mãos ocupadas.

  **Estado deixou de depender de matiz.** Não existe mais verde de sucesso nem
  amarelo de atraso: feito é tinta escura, agora é vermelho pulsando, futuro é
  neutro claro. Quem não distingue vermelho de verde lia dois status idênticos.

  Os nomes de token antigos (`primary`, `inkMuted`, `hairline`, `warn`…)
  continuam existindo apontando pros tons novos — apagá-los trocaria um redesign
  por uma quebra de compilação em dezenas de arquivos do app do dono, que não
  faz parte deste redesign e herdou a paleta pelos tokens.

- **A raiz de fonte customizada saiu dos apps.** Cliente rodava com
  `html { font-size: 17px }` e restaurante com 18px, pra compensar distância
  olho-tela. Isso escalava junto TODAS as classes de espaço do Tailwind, que são
  rem: `p-4` saía 17px, `h-16` saía 68 — e o `TABS_HEIGHT` em pixel que o layout
  reservava discordava da barra que ele reservava espaço pra. Os dois voltaram
  pros 16px do navegador, e a legibilidade passou a vir do desenho.

- **A tela de carrinho tem um botão primário, não três.** Cada cozinha era um
  card com "Mandar pra X" próprio, mais um "Mandar todos" no rodapé: com duas
  cozinhas, três botões vermelhos disputavam o mesmo gesto. Agora é uma lista só,
  agrupada por cozinha, com um `MANDAR PEDIDO` no rodapé. O envio continua sendo
  **um pedido por cozinha** — isso é do servidor e não mudou; mandar só uma
  virou ação secundária em texto, que é onde a exceção pertence.

- Ícones passaram a vir do **Lucide** (`lucide-react`), substituindo os glifos de
  texto `✓ ◐ ○ ×` que dependiam da fonte do sistema pra ter o mesmo tamanho.

- Gerenciador de pacotes: npm → **pnpm**, com versão travada em `packageManager`.
- Build do server: `tsc` → **esbuild**, que inlina `@mq/shared`.
- Base das imagens: `bookworm-slim` → **Alpine** (server: 512 → 406 MB; o SDK
  do Sentry devolveu 63 MB por arrastar OpenTelemetry, fechando em 469 MB).
- `server.ts` foi dividido: `app.ts` monta o app (testável via `inject`),
  `server.ts` só escuta e trata sinais.
- Produção recusa subir com `JWT_SECRET` fraco ou `CORS_ORIGINS` inseguro.
- **A linguagem do financeiro estava invertida.** As telas do dono diziam "a
  transferir para 5 cozinhas" e "repasses", como se o dono pagasse as cozinhas.
  É o contrário: o dinheiro não passa pelo app, cada cozinha cobra no próprio
  caixa e **deve** comissão + aluguel ao quintal. Virou "a receber" e
  "cobranças", inclusive no menu.
- **Contrato:** `CozinhaResumo.grossTodayCents` e `CobrancaLinha.grossCents`
  passaram a ser `number | null`, e `null` significa "você não vê este número".
  Renderizar como `R$ 0,00` reintroduz a mentira que a mudança existe para
  evitar. `FinanceiroResponse.totais` e `OverviewResponse.hoje` ganharam
  `grossParcial` e `cozinhasOcultas`; `MesaResumo` ganhou `grossParcial`.

### Corrigido

- **O "+ Item" do editor de cardápio parava em cima da lista.** Era um botão
  solto flutuando no canto inferior direito e pousava sobre o preço da última
  linha visível — numa tela de editar preço, ler 14,00 pela metade é pior que
  ocupar a faixa. Virou faixa fixa opaca de largura cheia acima das abas, a
  mesma anatomia que o app do cliente já usa na barra do carrinho.

- **Remover um funcionário da cozinha não revogava o acesso dele.** O auth do
  app do restaurante reconferia a *cozinha* a cada requisição, mas nunca a
  *pessoa*: o token de quem foi desligado seguia valendo até expirar, por até
  sete dias. Agora o usuário é relido junto — existe, ainda pertence àquela
  cozinha, e a versão do token bate.
- **Login com hash inválido respondia 500 em vez de 401.** `argon2.verify`
  **lança** quando a string guardada não é um hash válido — não devolve
  `false`. Uma conta recém-criada guarda um marcador de "sem senha utilizável"
  até a pessoa definir a dela, e tentar entrar antes disso derrubava a rota:
  erro de sistema para o que é apenas uma credencial inválida, e alerta no
  Sentry por nada. Todo login passou a usar `lib/senha.ts`.
- **O botão de pausar trancava a cozinha fora do próprio app.** `Kitchen.status`
  bloqueava o login e toda rota autenticada com 403. Enquanto ninguém expunha
  um botão de pausar, era latente; quando a tela de conta ganhou o dele, pausar
  passou a ser irreversível pela interface — a cozinha não conseguia nem
  despausar, e a única saída era editar o banco.

  E o efeito útil não existia: a criação de pedido **não** conferia status,
  então "pausada" trancava o operador e continuava recebendo pedido. A checagem
  mudou de lugar: `status` agora governa o que o cliente vê e se ele consegue
  pedir (409, mesmo com a página aberta desde antes da pausa), e não o acesso ao
  app.
- **O seletor de foto era falso.** Gerava um `blob:` que aparecia na tela,
  sumia ao recarregar e nunca saía do navegador — e o botão de salvar era um
  `alert('Mock: salvar perfil')`. O do item do cardápio virou upload de
  verdade; o do perfil da cozinha virou um campo de URL honesto, com prévia e
  aviso de imagem quebrada, até ganhar o mesmo tratamento.
- **A tela de avisos prometia o que o produto não faz.** Era uma maquete de
  notificação de tela bloqueada montada sobre pedidos falsos — e notificação de
  tela bloqueada não existe aqui. Virou uma página que explica o que funciona
  hoje (som e vibração com o app aberto), deixa testar o som antes do primeiro
  pedido de verdade — cozinha é barulhenta — e diz sem rodeio que com o app
  fechado ainda não avisa.
- **Marcar uma cobrança como paga era impossível pela interface.**
  `PATCH /api/a/cobrancas/:id` existia e tinha teste, mas a resposta do
  financeiro nunca devolvia o id da cobrança — não havia como chamar a rota.
  `CobrancaLinha` ganhou `chargeId`, nulo enquanto o ciclo está aberto (aí não
  existe linha gravada e o valor ainda sobe a cada pedido).
- **A conta era fechada pelo valor original.** `POST /pedidos/fechar-conta`
  somava o snapshot do pedido, então o cliente reduzia de 4 para 1, aceitava, e
  a cozinha era avisada para cobrar as 4 — no balcão, na frente dele. O
  overview e a tela de mesas do dono tinham o mesmo defeito, e contradiziam o
  financeiro da própria tela.

- **O cronômetro "há X min" não andava.** `Date.now()` no corpo do render deixa
  o valor congelado até que outra coisa force um re-render — numa fila de
  cozinha, um cronômetro parado passa confiança falsa.
- **Trocar de item abria o formulário com o texto do anterior** por um quadro
  (`ItemDetailSheet`, `EditItemSheet`). Num campo de preço, mostrar o valor
  errado mesmo por um instante gera dúvida sobre o que foi salvo.
- **Cliente e cozinha mostravam status diferentes do mesmo pedido.** Havia duas
  implementações de `aggregateStatus` com semânticas opostas: cancelar um item
  de um pedido de dois fazia o cliente ler "cancelado" e ir embora achando que
  perdeu tudo, enquanto a cozinha entregava o outro item no balcão. Agora há uma
  só, alinhada com o financeiro do dono — cancelado significa "não aconteceu" em
  todo lugar.
- **O total incluía item cancelado.** O contrato ganhou `totalAtivosCents` (o
  que se paga), mantendo `totalCents` como o snapshot do que foi pedido. As
  telas mostram o valor a pagar com o original riscado.
- **A cozinha via item cancelado sem nenhuma marca** e prepararia comida que
  ninguém iria buscar. `FilaOrderItem` ganhou `status`.
- **O socket da cozinha reassinava a cada render.** Entre o `unsubscribe` e o
  `subscribe` há uma janela em que evento do servidor não chega a ninguém —
  isto é, pedido que não apita.

- **`pnpm start` estava quebrado**: o build emitia `dist/src/server.js` e o
  script apontava para `dist/server.js`.
- **`/health` respondia 500 com o banco fora**, o que faria o orquestrador
  matar o container a cada instabilidade do Postgres. Separado em `/health`
  (liveness) e `/ready` (readiness).
- **Rate limit devolvia 500 em vez de 429**, escondendo o limite do cliente e
  das métricas.
- **`packages/shared` importava `zod` sem declarar a dependência** — funcionava
  por acidente de hoisting e quebrava em ambiente limpo.
- **`favicon.svg` não entrava na imagem do front** (404 em toda visita).
- **Rota `/api/_dev/order/:id/advance` ficava exposta em produção**, sem
  autenticação nenhuma.
- **Logs gravavam o `Authorization` em texto puro** — qrToken de mesa e JWT de
  cozinha iam para o agregador.
- **Pedir o mesmo prato em duas linhas era recusado** com "Algum item nao
  existe". A checagem comparava o resultado de um `WHERE id IN` (que devolve
  distintos) com o número de linhas do pedido — e duas linhas do mesmo item,
  com observações diferentes, é justamente o motivo de `note` existir por
  linha.

### Segurança

- **Esqueci minha senha.** Dono e cozinha pedem um link de uso único e criam a
  própria senha. A resposta é sempre a mesma, exista o e-mail ou não — inclusive
  para e-mail malformado: responder "não encontrado" transformaria a rota num
  oráculo de quais endereços têm conta aqui. A tela também não contradiz isso,
  e fala em condicional. O link vale **uma hora**, contra sete dias do primeiro
  acesso: quem pediu está na frente do computador agora. Pedir de novo invalida
  o anterior.
- **Trocar a senha derruba as sessões abertas.** O JWT é stateless e vale sete
  dias, então sem isso quem trocasse a senha *justamente por desconfiar de
  invasão* continuaria com o invasor dentro por mais uma semana. Os dois
  usuários ganharam `tokenVersion`, o token carrega a versão, e os dois plugins
  de auth comparam com o banco.
- **Senha nunca trafega.** Nem para o dono da conta, nem para a cozinha: os
  dois recebem um link de uso único e escolhem a própria senha. O `bootstrap`
  gerava uma senha, imprimia no terminal e mandava "passe pro dono por canal
  seguro" — na prática, a credencial que abre o financeiro inteiro ditada por
  WhatsApp e guardada no histórico da conversa para sempre.

  A conta nasce **sem senha utilizável**: o hash guardado é um marcador que não
  casa com nada, e a única entrada é o link. Definir a senha mata os outros
  links pendentes do mesmo usuário — se alguém pediu dois, o antigo não pode
  continuar valendo para trocar a senha recém-criada.
- **E-mail de boas-vindas quando a conta é criada.** Mesmo caminho do convite,
  via Resend, desligado por padrão: sem chave o `bootstrap` imprime o link para
  você mandar à mão.
- **O convite de cozinha virou um ciclo fechado.** Antes o convite era criado,
  o link aparecia uma vez e nenhuma rota o consumia — não havia como aceitar.
  Agora quem recebe abre o link, **lê o acordo financeiro antes de escolher a
  senha**, e já entra logado. Aceitar comissão e aluguel sem ler seria assinar
  em branco, e o convite é o único momento em que esses termos passam pela
  frente do responsável.

  O e-mail vem do convite, nunca do corpo da requisição — aceitá-lo do corpo
  deixaria quem tem o link criar acesso para outro endereço. O aceite é uma
  transação só, e a trava contra duplo clique é a condição `acceptedAt: null`
  no `updateMany`: o segundo encontra zero e desiste, em vez de criar uma
  cozinha gêmea. O teto do plano é reconferido no aceite, porque o convite vale
  sete dias e o quintal pode ter enchido nesse intervalo.

  A cozinha nasce **pausada**: o cliente não pode ver cozinha sem cardápio.
- **Envio de convite por e-mail, via Resend.** Desligado por padrão — com
  `RESEND_API_KEY` vazio nada é enviado, nenhuma requisição de rede sai, e o
  convite continua devolvendo o link na tela. Falha de envio **não derruba a
  criação**: o convite já está no banco, e responder erro faria o dono convidar
  a mesma pessoa de novo.
- **O plano passou a decidir o formato do negócio.** `Account.plan` era
  `trial | basico | pro` — nomes genéricos que nunca decidiram nada, lidos só
  para escrever na tela. Viraram **`restaurante | praca`**, e agora mandam: o
  plano define o tipo do espaço e o teto de cozinhas.

  A trava morde no convite de cozinha: quem está no plano Restaurante recebe
  402 ao tentar convidar a segunda, com a mensagem dizendo qual plano resolve.
  Sem isso "restaurante único" seria só um rótulo — qualquer assinante do plano
  mais barato viraria praça sozinho. Convite pendente ocupa vaga, senão daria
  para disparar cinco e estourar o teto quando fossem aceitos.

  **`trial` deixou de ser plano.** Quem testa já escolheu um formato; até quando
  testa vive em `Account.trialEndsAt`. Enquanto era valor do enum, um trial
  expirado virava plano nenhum e nada sabia o que fazer com isso. A migração faz
  o backfill **pelo dado** — conta cujo espaço é restaurante-único vira
  `restaurante` — e não pelo nome antigo, que poria a conta de teste no plano
  errado.

  `bootstrap` passou a exigir `PLANO`; `TIPO` deixou de existir, porque o tipo
  do espaço é consequência.
- **O dono não converte o próprio espaço.** Existiu por algumas horas um botão
  que convertia praça ↔ restaurante único de graça. Foi retirado no mesmo dia:
  converter é mudar de plano, e mudar de plano é decisão comercial — não um
  interruptor em "configurações". A tela de conta agora mostra o plano e o que
  ele permite, em vez de oferecer a troca.
- **O dono não vê pedido — e isso virou decisão registrada, não acaso.** Não
  existe fila do espaço, sala de socket do dono nem campo em `/api/a/*` que
  diga *o que* foi pedido; só contagem e valor agregado. A tela "Pedidos ao
  vivo" chegou a estar planejada e foi descartada: o que cada mesa pediu, de
  quem e quando é operação do restaurante. Há teste passando dados proibidos
  pelos mocks e procurando por eles no JSON de cada rota — um `...item`
  espalhado por descuido faz o teste cair. No restaurante único não há
  limitação: o dono é a cozinha e o mesmo login abre a fila no app dela.
- **A lista de cozinhas parou de mostrar o movimento do dia.**
  `GET /api/a/cozinhas` responde "qual é o acordo com cada cozinha", não "como
  cada cozinha foi hoje" — e o segundo é informação dela. Nem com comissão no
  acordo o dono vê o dia: comissão dá acesso ao bruto do **ciclo**, que é a base
  da conta e segue no Financeiro; o movimento de hoje não é base de nada.
  `ordersToday` e `grossTodayCents` viraram `number | null` e só vêm preenchidos
  para a cozinha que o próprio usuário opera. Nome, status e o acordo continuam
  inteiros — esconder isso seria pior.
- **O faturamento da cozinha deixou de ser do dono.** Ele só vê quanto uma
  cozinha vendeu quando o acordo tem **comissão** — aí o bruto é a base do que
  ele cobra, e sem ele a cozinha não teria como conferir a conta. Com aluguel
  fixo o valor não aparece: R$ 3.000 são R$ 3.000 tenha ela vendido dez pratos
  ou mil. Aceitar o convite com comissão já é o consentimento; não há checkbox
  separado.

  A regra não é "dinheiro se esconde" — é **nunca identificar quanto é de cada
  restaurante**. Ela vale nas respostas que quebram por cozinha (`/cozinhas` e
  `/financeiro`), e ali o total do rodapé soma só o visível: esconder linha a
  linha e totalizar todo mundo se desfaz com uma subtração na mesma tela.

  Os agregados do espaço — faturamento do dia, consumo por mesa, ranking de
  mesas — contam **todas** as cozinhas, inclusive as que pagam só aluguel. O
  salão é do dono e ele precisa do número cheio para decidir layout; filtrar por
  acordo faria a mesa boa da cozinha só-aluguel parecer fraca. O que sustenta
  isso é a ausência de qualquer campo por cozinha nessas respostas, e há testes
  conferindo as chaves e procurando slug de cozinha no JSON inteiro.

  Consequência assumida: somando as mesas e subtraindo o total visível do
  financeiro chega-se à *soma* das cozinhas ocultas — o que não identifica
  nenhuma quando há duas ou mais, e identifica a única quando há uma só.

  `KitchenCharge` passou a congelar `chargeCommission` junto com os outros
  termos, então um mês fechado sob aluguel fixo continua protegido mesmo que a
  comissão seja ligada depois. O ciclo **em andamento** ainda usa o acordo
  atual — ligar a comissão para espiar o mês corrente é possível, fica no log e
  está registrado em `pendencias.txt` como buraco conhecido.

  Quem opera a própria cozinha continua vendo o próprio caixa (é o caso do
  restaurante único, onde a comissão nasce desligada), e operar uma casinha não
  abre a do vizinho.
- Helmet, rate limit global e limite específico de 10/min no login.
- Limite de body em 256 KB.
- Error handler que não vaza stack nem detalhe de driver em 5xx.
- Campo `kind` no JWT: os tokens de cozinha e de dono compartilham o segredo e
  seriam intercambiáveis sem ele.

---

## [0.0.1] — 2026-06-09

Primeira versão com backend. Não lançada em produção.

- Três apps React (cliente, restaurante, dono) com design system compartilhado
- Backend do cliente: Fastify + Prisma + Socket.io, autenticação por QR de mesa
- Multi-carrinho por cozinha e fechamento de conta
