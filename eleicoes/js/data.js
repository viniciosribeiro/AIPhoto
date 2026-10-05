/* Dados-base do painel. Edite POLLS para incluir novas pesquisas (ou use o formulário na aba Pesquisas). */
const CANDIDATES = {
  lula:     { name: 'Lula',            full: 'Luiz Inácio Lula da Silva', party: 'PT',     color: '#d62828', match: ['LULA'], num: 13, role: 'Presidente (candidato à reeleição)' },
  flavio:   { name: 'Flávio Bolsonaro', full: 'Flávio Bolsonaro',          party: 'PL',     color: '#1d6fd8', match: ['FLAVIO'], num: 22, role: 'Senador (RJ)' },
  cury:     { name: 'Augusto Cury',    full: 'Augusto Cury',              party: 'Avante', color: '#e0a100', match: ['CURY'], num: 70, role: 'Psiquiatra e escritor' },
  caiado:   { name: 'Ronaldo Caiado',  full: 'Ronaldo Caiado',            party: 'PSD',    color: '#0f9d8a', match: ['CAIADO'], num: 55, role: 'Ex-governador de Goiás' },
  renan:    { name: 'Renan Santos',    full: 'Renan Santos',              party: 'Missão', color: '#7b2cbf', match: ['RENAN'], num: 14, role: 'Empreendedor / MBL' },
  zema:     { name: 'Romeu Zema',      full: 'Romeu Zema',                party: 'Novo',   color: '#ff7a00', match: ['ZEMA'], num: 30, role: 'Ex-governador de Minas Gerais' },
  marcal:   { name: 'Pablo Marçal',    full: 'Pablo Marçal',              party: 'PRTB',   color: '#6c757d', match: ['MARCAL'], num: 28, role: 'Candidatura sub judice (inelegibilidade em análise no TSE)' },
  /* candidatos de 2022 – usados no modo "Replay 2022" */
  bolsonaro:{ name: 'Bolsonaro',       full: 'Jair Bolsonaro',            party: 'PL',     color: '#1d6fd8', match: ['BOLSONARO'], hidden: true },
  ciro:     { name: 'Ciro Gomes',      full: 'Ciro Gomes',                party: 'PDT',    color: '#2a9d8f', match: ['CIRO'], hidden: true },
  tebet:    { name: 'Simone Tebet',    full: 'Simone Tebet',              party: 'MDB',    color: '#8ab17d', match: ['TEBET'], hidden: true },
};
const MAIN = ['lula', 'flavio', 'cury', 'caiado', 'renan', 'zema'];
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
function candKey(name) {
  const n = norm(name);
  for (const [k, c] of Object.entries(CANDIDATES)) if (c.match.some(m => n.includes(m))) return k;
  return null;
}

/* uf, código IBGE, nome, região, eleitores (milhões, aprox.), % válidos 2022 1º turno (Lula / Bolsonaro, aprox.), grade do cartograma */
const STATES = [
  ['AC',12,'Acre','Norte',.58,30,63,[1,2]], ['AL',27,'Alagoas','Nordeste',2.3,55,38,[7,3]], ['AP',16,'Amapá','Norte',.56,50,41,[5,0]],
  ['AM',13,'Amazonas','Norte',2.6,46,45,[2,1]], ['BA',29,'Bahia','Nordeste',11.4,69,25,[5,3]], ['CE',23,'Ceará','Nordeste',6.7,66,29,[6,1]],
  ['DF',53,'Distrito Federal','Centro-Oeste',2.2,35,50,[4,4]], ['ES',32,'Espírito Santo','Sudeste',2.9,38,50,[6,4]], ['GO',52,'Goiás','Centro-Oeste',4.9,36,54,[4,3]],
  ['MA',21,'Maranhão','Nordeste',5.0,71,25,[5,1]], ['MT',51,'Mato Grosso','Centro-Oeste',2.6,29,62,[3,3]], ['MS',50,'Mato Grosso do Sul','Centro-Oeste',2.0,33,57,[3,5]],
  ['MG',31,'Minas Gerais','Sudeste',16.3,48,44,[5,4]], ['PA',15,'Pará','Norte',6.0,50,42,[4,1]], ['PB',25,'Paraíba','Nordeste',3.1,64,29,[7,2]],
  ['PR',41,'Paraná','Sul',8.5,35,54,[4,6]], ['PE',26,'Pernambuco','Nordeste',7.0,63,30,[6,2]], ['PI',22,'Piauí','Nordeste',2.5,74,22,[5,2]],
  ['RJ',33,'Rio de Janeiro','Sudeste',12.8,41,47,[5,5]], ['RN',24,'Rio Grande do Norte','Nordeste',2.6,58,35,[7,1]], ['RS',43,'Rio Grande do Sul','Sul',8.5,44,46,[4,8]],
  ['RO',11,'Rondônia','Norte',1.2,30,62,[2,2]], ['RR',14,'Roraima','Norte',.37,26,65,[3,0]], ['SC',42,'Santa Catarina','Sul',5.5,29,62,[4,7]],
  ['SP',35,'São Paulo','Sudeste',34.6,40,47,[4,5]], ['SE',28,'Sergipe','Nordeste',1.8,62,33,[6,3]], ['TO',17,'Tocantins','Norte',1.1,46,47,[4,2]],
].map(a => ({ uf: a[0], code: a[1], name: a[2], region: a[3], voters: a[4], l22: a[5], b22: a[6], grid: a[7] }));
const REGIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

/* Pesquisas nacionais, 1º turno estimulado. v = null: candidato não divulgado nesta fonte. valid=true: percentuais já em votos válidos. */
const POLLS = [
  { id: 'datafolha-1003', inst: 'Datafolha', date: '2026-10-03', n: 2000, valid: false, v: { lula: 38, flavio: 33, cury: 8, caiado: null, renan: null, zema: null }, src: 'https://www.nsctotal.com.br/?p=8030039' },
  { id: 'quaest-0928',    inst: 'Quaest',    date: '2026-09-28', n: 2000, valid: false, v: { lula: 39, flavio: 34, cury: null, caiado: null, renan: null, zema: null }, src: 'https://portaldeprefeitura.com.br/bastidores-da-politica/pesquisa-quaest-lula-tem-39-e-flavio-bolsonaro-34-no-1o-turno/632993/' },
  { id: 'atlas-0923',     inst: 'AtlasIntel',date: '2026-09-23', n: 2000, valid: true,  v: { lula: 46.3, flavio: 43.9, cury: 2.1, caiado: 1.4, renan: 4.6, zema: 0.9 }, src: 'https://www.gazetadopovo.com.br/eleicoes/2026/pesquisa-eleitoral-2026/atlasintel-presidente-setembro-2026-3/' },
  { id: 'datafolha-0917', inst: 'Datafolha', date: '2026-09-17', n: 2000, valid: false, v: { lula: 39, flavio: 36, cury: 6, caiado: 4, renan: 3, zema: 2 }, src: 'https://exame.com/brasil/datafolha-lula-tem-39-e-flavio-35-no-primeiro-turno-das-eleicoes-2026/' },
  { id: 'quaest-0914',    inst: 'Quaest',    date: '2026-09-14', n: 2000, valid: false, v: { lula: 36, flavio: 31, cury: null, caiado: null, renan: null, zema: null }, src: 'https://revistaforum.com.br/politica/pesquisas-para-presidente-em-2026/' },
];
/* Para onde vão os eleitores de cada candidato num 2º turno Lula x Flávio: % que diz votar em Flávio.
   Média das pesquisas disponíveis; as fontes não trazem a divisão do restante entre Lula e branco/nulo (ver Model.restToLula). */
const RUNOFF_SOURCES = {
  datafolha: { inst: 'Datafolha', date: '2026-09-20', n: 2058, src: 'https://www.cartacapital.com.br/cartaexpressa/datafolha-detalha-a-migracao-de-votos-de-zema-caiado-e-renan-santos-no-2o-turno-veja-os-numeros/' },
  quaest:    { inst: 'Quaest',    date: '2026-09-06', src: 'https://revistaoeste.com/politica/maioria-dos-eleitores-de-cury-renan-caiado-e-zema-votaria-em-flavio-no-2o-turno/' },
};
const RUNOFF_TRANSFER = {
  zema:   { flavio: 59.5, by: { datafolha: 60, quaest: 59 } },
  renan:  { flavio: 53,   by: { datafolha: 48, quaest: 58 } },
  caiado: { flavio: 45,   by: { datafolha: 54, quaest: 36 } },
  cury:   { flavio: 46,   by: { quaest: 46 } },
  marcal: { flavio: 47,   by: { quaest: 47 } },
};
/* 2º turno estimulado Lula x Flávio (votos válidos) */
const RUNOFF_POLLS = [{ inst: 'AtlasIntel', date: '2026-09-23', lula: 50.2, flavio: 49.8 }];
