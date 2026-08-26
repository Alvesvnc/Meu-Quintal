/** Contratos do app do dono (/api/a/*). */

export type AccountRole = 'owner' | 'admin' | 'staff';
/**
 * O plano diz o FORMATO do negocio, nao um degrau generico.
 *
 * `trial` nao esta aqui de proposito: quem testa ja escolheu um formato, e ate
 * quando ele testa vive em `Account.trialEndsAt`. Ver server/src/lib/planos.ts.
 */
export type AccountPlan = 'restaurante' | 'praca';
export type AccountStatus = 'ativa' | 'suspensa' | 'cancelada';
export type MesaStatus = 'livre' | 'ocupada' | 'precisa-limpar';

/**
 * Como o espaco funciona.
 *
 * `restaurante-unico`: uma cozinha so, e o dono E a cozinha. Sem comissao
 * (seria cobrar de si mesmo) e o cliente vai direto ao cardapio.
 */
export type TipoDeEspaco = 'food-court' | 'restaurante-unico';
export type ChargeStatus = 'aberta' | 'fechada' | 'paga' | 'atrasada';

export interface DonoMeResponse {
  userId: string;
  email: string;
  name: string | null;
  role: AccountRole;
  account: {
    id: string;
    slug: string;
    name: string;
    plan: AccountPlan;
    status: AccountStatus;
    /** Fim do periodo de teste, ou `null`. O plano diz O QUE foi assinado;
     *  isto diz ATE QUANDO o teste vale. */
    trialEndsAt: string | null;
  };
  spaces: Array<{
    id: string;
    slug: string;
    name: string;
    tipo: TipoDeEspaco;
    defaultCommissionPct: number;
    closingDay: number;
    tablesTotal: number;
  }>;
  /**
   * So no restaurante unico: a cozinha que este usuario opera diretamente.
   * Quando presente, o mesmo login serve pros dois apps.
   */
  kitchenId: string | null;
}

export interface DonoLoginResponse {
  token: string;
  me: DonoMeResponse;
}

export interface CozinhaResumo {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  status: 'ativa' | 'pausada' | 'rascunho';
  slaMinutes: number;
  /**
   * Pedidos de hoje, ou `null` — ver `grossTodayCents`.
   *
   * Contagem de pedido tambem e operacao da cozinha. Quantas comandas ela
   * tirou hoje nao muda em nada o que ela deve ao quintal.
   */
  ordersToday: number | null;
  /**
   * Bruto vendido hoje, ou `null` quando nao e da conta de quem esta olhando.
   *
   * ESTA ROTA E DE CONFIGURACAO: ela responde "qual e o acordo com cada
   * cozinha", nao "como cada cozinha foi hoje". O movimento do dia e operacao
   * da cozinha e nao serve de base pra cobranca nenhuma — o que o dono cobra
   * sai do bruto DO CICLO, que continua em /api/a/financeiro quando o acordo
   * tem comissao.
   *
   * Preenchido so pra cozinha que o proprio usuario opera (restaurante unico,
   * ou dono de praca que tambem toca uma casinha).
   *
   * `null` e nao `0`: zero se leria como "nao vendeu nada".
   */
  grossTodayCents: number | null;
  /** Acordo financeiro vigente */
  acordo: {
    chargeCommission: boolean;
    /** null = herda defaultCommissionPct do quintal */
    commissionPct: number | null;
    /** Percentual que sera efetivamente aplicado, ja resolvida a heranca */
    commissionPctEfetivo: number;
    chargeRent: boolean;
    rentCents: number;
  };
}

export interface OverviewResponse {
  space: { id: string; slug: string; name: string; tipo: TipoDeEspaco };
  hoje: {
    ordersCount: number;
    /**
     * Faturamento do ESPACO, contando todas as cozinhas — inclusive as que
     * pagam so aluguel.
     *
     * E agregado, nao quebra por cozinha, e o dono precisa dele pra tocar o
     * lugar. A regra de privacidade vale nas respostas que QUEBRAM por cozinha
     * (/cozinhas e /financeiro) — ver lib/faturamento.ts no server.
     */
    grossCents: number;
    ticketMedioCents: number;
  };
  mesas: { total: number; livres: number; ocupadas: number; precisamLimpar: number };
  cozinhas: { total: number; ativas: number; pausadas: number };
}

export interface CobrancaLinha {
  /**
   * Id da cobranca gravada, para `PATCH /api/a/cobrancas/:id`.
   *
   * `null` enquanto o ciclo esta ABERTO: os valores sao calculados ao vivo e
   * nao existe linha gravada ainda. Marcar como paga so faz sentido depois de
   * fechar o ciclo — antes disso o valor ainda sobe a cada pedido.
   */
  chargeId: string | null;
  kitchenId: string;
  kitchenSlug: string;
  kitchenName: string;
  /** Base do calculo, ou `null` quando o acordo nao tem comissao. */
  grossCents: number | null;
  commissionPct: number;
  commissionCents: number;
  rentCents: number;
  /** O que a cozinha deve ao quintal */
  totalDueCents: number;
  status: ChargeStatus;
  paidAt: string | null;
}

export interface FinanceiroResponse {
  space: { id: string; slug: string; name: string };
  refMonth: string;
  startsAt: string;
  endsAt: string;
  /** Ainda em andamento (valores sobem a cada pedido) ou congelado */
  fechado: boolean;
  closingDay: number;
  totais: {
    /**
     * Soma so das linhas visiveis. Somar todo mundo aqui e esconder linha por
     * linha seria teatro: bastaria subtrair para achar a oculta.
     */
    grossCents: number;
    commissionCents: number;
    rentCents: number;
    /** Total que as cozinhas devem ao quintal no ciclo */
    aReceberCents: number;
    /** `true` se alguma cozinha ficou fora de `grossCents`. */
    grossParcial: boolean;
    cozinhasOcultas: number;
  };
  linhas: CobrancaLinha[];
}

/** Uma mesa no ranking de desempenho. */
export interface MesaDesempenho {
  id: string;
  numero: number;
  isActive: boolean;
  /** Cadastrada depois do inicio do periodo — a comparacao dela ainda nao vale. */
  novaNoPeriodo: boolean;
  pedidos: number;
  grossCents: number;
  ticketMedioCents: number;
  /** Em quantos dias distintos a mesa teve movimento. Separa a mesa boa da
   *  mesa que pegou uma noite cheia. */
  diasComMovimento: number;
  /** Quanto rende acima/abaixo da media, em %. `null` sem base de comparacao. */
  vsMediaPct: number | null;
}

export interface MediaDoSalao {
  grossCents: number;
  pedidos: number;
  ticketMedioCents: number;
  /** Quantas mesas entraram na media — desativadas e novas ficam de fora. */
  mesasNaBase: number;
}

export interface DesempenhoMesasResponse {
  refMonth: string;
  startsAt: string;
  endsAt: string;
  media: MediaDoSalao;
  /**
   * Ordenado por faturamento, maior primeiro. Conta todas as cozinhas: filtrar
   * por acordo faria a mesa boa da cozinha so-aluguel parecer fraca, e o dono
   * mudaria o salao de lugar por causa disso.
   */
  mesas: MesaDesempenho[];
}

export interface MesaResumo {
  id: string;
  numero: number;
  status: MesaStatus;
  isActive: boolean;
  ordersToday: number;
  /**
   * Consumo da mesa hoje, contando TODAS as cozinhas.
   *
   * A mesa e do dono e o numero serve pra ele decidir salao. Nao ha quebra por
   * cozinha aqui, entao o valor nao identifica restaurante nenhum.
   */
  grossTodayCents: number;
}

export interface ConviteResponse {
  id: string;
  email: string;
  kind: 'cozinha' | 'equipe';
  expiresAt: string;
  /**
   * `false` quando nao ha provedor de email configurado, ou quando o envio
   * falhou. Nos dois casos o convite EXISTE — o dono manda o link na mao.
   */
  emailEnviado?: boolean;
  /** Só vem na CRIAÇÃO — depois disso só existe o hash no banco. */
  linkDeAceite?: string;
}

/** O que a tela de aceite mostra ANTES de pedir senha. */
export interface ConvitePublicoResponse {
  email: string;
  kitchenName: string;
  spaceName: string;
  accountName: string;
  expiresAt: string;
  /** Os termos combinados. Aceitar sem ler seria assinar em branco. */
  acordo: {
    chargeCommission: boolean;
    /** `null` = herda o padrão do quintal. */
    commissionPct: number | null;
    chargeRent: boolean;
    rentCents: number;
  };
}

export interface AceitarConviteResponse {
  /** Já entra logado: a pessoa acabou de escolher a senha. */
  token: string;
  kitchen: {
    id: string;
    slug: string;
    name: string;
    status: 'ativa' | 'pausada' | 'rascunho';
  };
}

/** O que a tela mostra antes de pedir a senha. */
export interface PrimeiroAcessoResponse {
  /** Muda o texto da tela: criar a primeira senha ou trocar a que esqueceu. */
  tipo: 'primeiro-acesso' | 'recuperar-senha';
  email: string;
  name: string | null;
  /** Nome da conta (dono) ou da cozinha (operador) — pra pessoa se reconhecer. */
  accountName: string;
  expiresAt: string;
}

/**
 * Já entra logado: a pessoa acabou de provar que tem o link e escolheu a senha.
 *
 * `app` diz de quem é o link. O mesmo endereço serve dono e cozinha, e cada um
 * volta pra um app diferente.
 */
export type DefinirSenhaResponse =
  | { app: 'dono'; token: string; me: DonoMeResponse }
  | {
      app: 'cozinha';
      token: string;
      kitchen: { id: string; slug: string; name: string; status: 'ativa' | 'pausada' | 'rascunho' };
    };
