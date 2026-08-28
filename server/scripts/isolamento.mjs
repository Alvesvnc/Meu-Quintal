/**
 * Prova manual do isolamento multi-tenant contra o servidor rodando.
 *
 *   pnpm --filter @mq/server isolamento
 *
 * Cada linha e um ataque plausivel de um cliente do SaaS contra outro.
 * Nao substitui teste automatizado — ver pendencias.txt, item 5.
 */
const API = process.env.API ?? 'http://localhost:3001';

let falhas = 0;

function checar(rotulo, ok, detalhe = '') {
  const marca = ok ? 'OK  ' : 'FALHA';
  if (!ok) falhas++;
  console.log(`  [${marca}] ${rotulo}${detalhe ? '  -> ' + detalhe : ''}`);
}

async function login(rota, email, password) {
  const r = await fetch(`${API}${rota}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`login ${email} falhou: ${r.status}`);
  return (await r.json()).token;
}

const get = (caminho, token) =>
  fetch(`${API}${caminho}`, { headers: { Authorization: `Bearer ${token}` } });

const patch = (caminho, token, body) =>
  fetch(`${API}${caminho}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const marina = await login('/api/a/auth/login', 'marina@qro.app', 'quintal2026');
const roberto = await login('/api/a/auth/login', 'roberto@quintalubatuba.com', 'quintal2026');
const garcom = await login('/api/a/auth/login', 'garcom@quintalubatuba.com', 'quintal2026');
const cozinha = await login('/api/r/auth/login', 'marcos@louburger.com', 'quintal2026');

console.log('\n── Cada dono so enxerga o proprio quintal ──────────────────────');

const meMarina = await (await get('/api/a/auth/me', marina)).json();
const meRoberto = await (await get('/api/a/auth/me', roberto)).json();
checar('Marina ve so o quintal dela', meMarina.spaces.length === 1 && meMarina.spaces[0].slug === 'sao-sebastiao', meMarina.spaces.map((s) => s.slug).join(','));
checar('Roberto ve so o quintal dele', meRoberto.spaces.length === 1 && meRoberto.spaces[0].slug === 'ubatuba-centro', meRoberto.spaces.map((s) => s.slug).join(','));
checar('contas sao distintas', meMarina.account.id !== meRoberto.account.id);

console.log('\n── Acessar o espaco do outro pelo slug ─────────────────────────');

const cruzado = await get('/api/a/overview?espaco=sao-sebastiao', roberto);
checar('Roberto pedindo o quintal da Marina -> 404', cruzado.status === 404, `HTTP ${cruzado.status}`);

const proprio = await get('/api/a/overview?espaco=ubatuba-centro', roberto);
checar('Roberto pedindo o proprio quintal -> 200', proprio.status === 200, `HTTP ${proprio.status}`);

console.log('\n── Slug de cozinha repetido nos dois quintais ──────────────────');

const cozMarina = await (await get('/api/a/cozinhas', marina)).json();
const cozRoberto = await (await get('/api/a/cozinhas', roberto)).json();
const louM = cozMarina.find((k) => k.slug === 'lou-burger');
const louR = cozRoberto.find((k) => k.slug === 'lou-burger');
checar('os dois tem uma "lou-burger"', Boolean(louM && louR));
checar('mas sao registros diferentes', louM?.id !== louR?.id);
checar('Marina ve 6 cozinhas, Roberto 1', cozMarina.length === 6 && cozRoberto.length === 1, `${cozMarina.length} vs ${cozRoberto.length}`);

console.log('\n── Escrever no acordo financeiro do outro ──────────────────────');

const ataque = await patch('/api/a/cozinhas/lou-burger/acordo?espaco=sao-sebastiao', roberto, {
  chargeCommission: true,
  commissionPct: 99,
  chargeRent: false,
  rentCents: 0,
});
checar('Roberto alterando a comissao da cozinha da Marina -> 404', ataque.status === 404, `HTTP ${ataque.status}`);

const depois = await (await get('/api/a/cozinhas', marina)).json();
const louDepois = depois.find((k) => k.slug === 'lou-burger');
checar('comissao da Marina intacta (15%, nao 99%)', louDepois.acordo.commissionPctEfetivo === 15, `${louDepois.acordo.commissionPctEfetivo}%`);

console.log('\n── Papeis dentro da mesma conta ────────────────────────────────');

const staffFin = await get('/api/a/financeiro', garcom);
checar('staff no financeiro -> 403', staffFin.status === 403, `HTTP ${staffFin.status}`);
const staffMesas = await get('/api/a/mesas', garcom);
checar('staff nas mesas -> 200 (e o trabalho dele)', staffMesas.status === 200, `HTTP ${staffMesas.status}`);
const donoFin = await get('/api/a/financeiro', roberto);
checar('owner no financeiro -> 200', donoFin.status === 200, `HTTP ${donoFin.status}`);

console.log('\n── Um tipo de token nao vale no app do outro ───────────────────');

const cozNoDono = await get('/api/a/overview', cozinha);
checar('JWT de cozinha em rota de dono -> 403', cozNoDono.status === 403, `HTTP ${cozNoDono.status}`);
const donoNaCozinha = await get('/api/r/fila', marina);
checar('JWT de dono em rota de cozinha -> 403', donoNaCozinha.status === 403, `HTTP ${donoNaCozinha.status}`);

console.log('\n── Comissao padrao de cada quintal e independente ──────────────');

const finM = await (await get('/api/a/financeiro', marina)).json();
const finR = await (await get('/api/a/financeiro', roberto)).json();
checar('Marina usa 15%', finM.linhas.find((l) => l.kitchenSlug === 'lou-burger').commissionPct === 15);
checar('Roberto usa 20%', finR.linhas.find((l) => l.kitchenSlug === 'lou-burger').commissionPct === 20);
checar('faturamentos nao se misturam', finM.totais.grossCents !== finR.totais.grossCents || finR.totais.grossCents === 0);

console.log('\n── Mesa de um quintal nao abre o outro ─────────────────────────');

const mesaCruzada = await fetch(`${API}/api/m/quintal`, {
  headers: { Authorization: 'Bearer uba-mesa-1-dev' },
});
const quintalUba = await mesaCruzada.json();
checar('mesa de Ubatuba ve o quintal de Ubatuba', quintalUba.space?.slug === 'ubatuba-centro', quintalUba.space?.slug);
checar('e so a cozinha de la', quintalUba.kitchens?.length === 1, `${quintalUba.kitchens?.length} cozinha(s)`);

console.log(`\n${falhas === 0 ? 'TODAS AS BARREIRAS SEGURARAM' : falhas + ' FALHA(S) DE ISOLAMENTO'}\n`);
process.exit(falhas === 0 ? 0 : 1);
