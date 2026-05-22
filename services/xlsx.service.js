const XLSX = require('xlsx');

function rows(wb, sheet) {
  const ws = wb.Sheets[sheet];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

function isDataRow(row) {
  if (!row[0]) return false;
  const cell = String(row[0]);
  if (cell.startsWith('⚠') || cell.startsWith('STATUS') || cell === 'Indicador'
    || cell === 'Área' || cell === 'Item' || cell === 'Frente') return false;
  return true;
}

function parseWorkbook(filePathOrBuffer) {
  const wb = Buffer.isBuffer(filePathOrBuffer)
    ? XLSX.read(filePathOrBuffer, { type: 'buffer' })
    : XLSX.readFile(filePathOrBuffer);
  const result = {};

  // INDICADORES
  const ki = rows(wb, 'INDICADORES');
  result.kpis = {};
  ki.filter(isDataRow).forEach(r => {
    if (r[0] && r[1] !== '') result.kpis[String(r[0]).trim()] = Number(r[1]) || 0;
  });

  // CURVA_S
  const cs = rows(wb, 'CURVA_S');
  result.curva_s = cs.slice(2)
    .filter(r => r[0] && String(r[0]).match(/^S\d+$/))
    .map(r => ({
      semana: String(r[0]),
      planejado: Number(r[1]) || 0,
      realizado: Number(r[2]) || 0
    }));

  // STATUS_AREAS
  const sa = rows(wb, 'STATUS_AREAS');
  result.areas = sa.slice(2)
    .filter(isDataRow)
    .map(r => ({
      nome: String(r[0]).trim(),
      realizado: Number(r[1]) || 0,
      a_concluir: Number(r[2]) || 0,
      desvio: Number(r[3]) || 0
    }));

  // AVANCOS
  const av = rows(wb, 'AVANCOS');
  result.avancos = av.slice(1)
    .filter(isDataRow)
    .filter(r => r[1] !== 'Frente' && r[1] !== 'Responsável')
    .map(r => ({
      item: r[0],
      frente: String(r[1] || '').trim(),
      responsavel: String(r[2] || '').trim(),
      marco: String(r[3] || '').trim(),
      status: String(r[4] || '').trim()
    }));

  // RISCOS
  const ri = rows(wb, 'RISCOS');
  result.riscos = ri.slice(1)
    .filter(isDataRow)
    .filter(r => r[1] !== 'Frente')
    .map(r => ({
      item: r[0],
      frente: String(r[1] || '').trim(),
      responsavel: String(r[2] || '').trim(),
      risco: String(r[3] || '').trim(),
      categoria: String(r[4] || '').trim()
    }));

  // Métricas resumidas
  const kpis = result.kpis;
  result.realizado = Number(kpis['Realizado']) || 0;
  result.planejado = Number(kpis['Planejado']) || 0;
  result.desvio    = result.realizado - result.planejado;

  // Última semana da Curva S
  const lastSem = result.curva_s[result.curva_s.length - 1];
  result.semana = lastSem ? lastSem.semana : 'S14';

  return result;
}

module.exports = { parseWorkbook };
