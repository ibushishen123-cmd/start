import { catalog, parsePriceFile } from './quote.js?v=4';

export class WorkbookImportError extends Error {}

const elements = (node, name) => [...node.getElementsByTagNameNS('*',name)];
const child = (node, name) => node && [...node.children].find(el=>el.localName===name);
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/×/g,'x').replace(/[^\p{L}\p{N}.]/gu,'');
const numeric = String.raw`(\d+(?:\.\d+)?)`;
const conversion = new RegExp(String.raw`^([MN])(\d+)/${numeric}$`,'i');
const markup = new RegExp(String.raw`^M(\d+)\*${numeric}$`,'i');

async function readXml(zip,path) {
  const part = zip.file(path);
  if (!part) return null;
  const text = await part.async('string');
  if (/<!DOCTYPE/i.test(text)) throw new WorkbookImportError('无法读取此工作簿，请从 Excel 或 WPS 重新另存为 .xlsx。');
  const doc = new DOMParser().parseFromString(text,'application/xml');
  if (elements(doc,'parsererror').length) throw new WorkbookImportError('工作簿文件损坏，请重新保存后再导入。');
  return doc;
}

function productFor(series, material, size) {
  const name = normalize(series);
  const details = normalize(material);
  const byName = {
    professionalcohesivebandage:'cohesive', cohesivecoolingbandages:'cooling',
    iprecuttapeskinesiologytape:details.includes('synthetic')?'precut-synthetic':'precut-cotton',
    biowrap:details.includes('pla')?'bio':'bio-alt',
  };
  return catalog.find(product => normalize(product.size)===normalize(size) &&
    (byName[name] ? product.family===byName[name] : normalize(product.name)===name));
}

function sheetRows(sheet, strings) {
  const shared = new Map();
  const rows = elements(sheet,'row').map(row=>{
    const index = Number(row.getAttribute('r'));
    const cells = new Map([...row.children].filter(cell=>cell.localName==='c').map(cell=>{
      const address = cell.getAttribute('r');
      const column = address?.match(/^[A-Z]+/)?.[0];
      const type = cell.getAttribute('t');
      const raw = child(cell,'v')?.textContent;
      const value = type==='s' ? strings[Number(raw)] : type==='inlineStr' ? elements(cell,'t').map(t=>t.textContent).join('') : raw;
      const formula = child(cell,'f');
      const expression = formula?.textContent.replace(/[\s$=]/g,'').toUpperCase();
      const sharedId = formula?.getAttribute('si');
      const anchor = expression ? { expression,index } : null;
      if (anchor && sharedId!==null) shared.set(sharedId,anchor);
      return [column,{value:value?.trim()||'', type, formula, anchor, sharedId}];
    }));
    return {index,cells};
  });
  return rows.map(({index,cells})=>({
    index,
    get:col=>cells.get(col)?.value || '',
    getCell:col=>cells.get(col),
    getFormula:col=>{
      const cell = cells.get(col);
      return cell?.anchor || shared.get(cell?.sharedId);
    },
  }));
}

function costsFor(row) {
  return ['I','J','K','L'].map((col,i)=>{
    const cell = row.getCell(col);
    const value = cell?.value;
    if (!value && !cell?.formula && i!==0) return '0';
    if (!value || ['e','b','d'].includes(cell.type) || !/^\d+(?:\.\d*)?(?:e[+-]?\d+)?$/i.test(value) || !Number.isFinite(Number(value)) || Number(value)>=100000) {
      throw new WorkbookImportError(`第 ${row.index} 行 ${col} 列成本缺失或无效。请核对并在 Excel 或 WPS 重新计算、保存后导入。`);
    }
    return Number(value).toFixed(6);
  });
}

function pricingFromRows(rows) {
  const header = rows.findIndex(row=>
    ['series','size','产品采购价','包装','运费','人工费'].every((title,i)=>normalize(row.get(['C','E','I','J','K','L'][i]))===title));
  if (header===-1) return null;
  const prices = [];
  const ids = new Set();
  let exchangeRate = '';
  let series = '';
  let material = '';
  for (const row of rows.slice(header+1)) {
    if (row.get('C')) { series=row.get('C'); material=row.get('D'); }
    const size = row.get('E');
    if (!size) continue;
    const product = productFor(series,material,size);
    if (!product) throw new WorkbookImportError(`第 ${row.index} 行的系列和规格未匹配产品目录，请核对 C、D、E 列。`);
    if (ids.has(product.id)) throw new WorkbookImportError(`第 ${row.index} 行的产品规格重复，请保留一条计价记录。`);
    const formula = row.getFormula('O');
    const match = conversion.exec(formula?.expression||'');
    const sumFormula = row.getFormula('M');
    if (!match || Number(match[2])!==formula.index || !sumFormula || sumFormula.expression!==`SUM(I${sumFormula.index}:L${sumFormula.index})`) {
      throw new WorkbookImportError(`第 ${row.index} 行的成本合计或美元换算公式无法识别，请保留报价模板 M、O 列公式。`);
    }
    const [,base,,rate] = match;
    if (exchangeRate && Number(rate)!==Number(exchangeRate)) throw new WorkbookImportError(`第 ${row.index} 行的计价汇率与其他行不一致，请统一后导入。`);
    exchangeRate = rate;
    let multiplier = '1';
    if (base==='N') {
      const formula = row.getFormula('N');
      const match = markup.exec(formula?.expression||'');
      if (!match || Number(match[1])!==formula.index) throw new WorkbookImportError(`第 ${row.index} 行的加成公式无法识别，请保留报价模板 N 列公式。`);
      multiplier = match[2];
    }
    const decimals = product.family==='cooling' ? 2 : 3;
    prices.push({id:product.id,costs:costsFor(row),multiplier,decimals});
    ids.add(product.id);
  }
  if (!prices.length) throw new WorkbookImportError('报价模板里没有可导入的产品规格和成本。');
  try { return parsePriceFile(JSON.stringify({schema:'scico-quote-prices-v2',exchangeRate,prices})); }
  catch { throw new WorkbookImportError('计价数据超出支持的范围，请核对人民币成本、加成和汇率。'); }
}

export async function importPricingWorkbook(file) {
  await import('./vendor/jszip.min.js');
  const zip = await globalThis.JSZip.loadAsync(await file.arrayBuffer());
  const workbook = await readXml(zip,'xl/workbook.xml');
  const relations = await readXml(zip,'xl/_rels/workbook.xml.rels');
  if (!workbook || !relations) throw new WorkbookImportError('请选择项目中的「报价模板.xlsx」或用同一模板另存的文件。');
  const links = new Map(elements(relations,'Relationship').filter(el=>el.getAttribute('TargetMode')!=='External')
    .map(el=>[el.getAttribute('Id'),el.getAttribute('Target')]));
  const shared = await readXml(zip,'xl/sharedStrings.xml');
  const strings = shared ? elements(shared,'si').map(si=>elements(si,'t').map(t=>t.textContent).join('')) : [];
  for (const sheet of elements(workbook,'sheet')) {
    const relationId = [...sheet.attributes].find(attr=>attr.localName==='id')?.value;
    const target = links.get(relationId);
    if (!target) continue;
    const path = new URL(target,'https://xlsx.invalid/xl/workbook.xml').pathname.slice(1);
    const xml = await readXml(zip,path);
    const result = xml && pricingFromRows(sheetRows(xml,strings));
    if (result) return result;
  }
  throw new WorkbookImportError('没有找到报价模板工作表。请使用项目中的「报价模板.xlsx」，并保留系列、规格和成本列。');
}
