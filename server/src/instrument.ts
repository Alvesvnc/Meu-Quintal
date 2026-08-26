/**
 * Modulo de efeito colateral: inicializa o Sentry ao ser importado.
 *
 * POR QUE NAO CHAMAR setupSentry() DIRETO NO server.ts:
 * em ESM os `import` sao HOISTED — todos sao resolvidos e avaliados antes da
 * primeira linha executavel do modulo. Uma chamada escrita "antes" dos outros
 * imports roda, na verdade, DEPOIS de todos eles. Ficaria parecendo que o
 * Sentry sobe primeiro sem subir.
 *
 * O que a especificacao garante e a ORDEM DOS IMPORTS: o efeito colateral de
 * um modulo importado em primeiro lugar acontece antes do proximo ser
 * avaliado. Por isso este arquivo existe e por isso ele e o primeiro import do
 * server.ts.
 *
 * Isso importa de verdade quando SENTRY_TRACES_SAMPLE_RATE for maior que zero:
 * a instrumentacao automatica precisa aplicar patch nos modulos (http, prisma)
 * ANTES de qualquer um deles ser carregado. Com amostragem 0 e captura manual
 * a ordem e indiferente — mas depender disso seria uma armadilha esperando o
 * dia em que alguem subir a amostragem.
 */
import { setupSentry } from './lib/sentry.js';

setupSentry();
