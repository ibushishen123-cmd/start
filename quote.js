import { extraCatalog } from './catalog-extra.js';

export const companyDefaults = {
  name: 'Wenzhou Scico Medical Corporation Co.,Ltd',
  address: 'Floors 1, 4 & 5, Building 1, No. 14, Lane 699, Shiji Avenue, Longgang City, 325802 Wenzhou, Zhejiang Sheng, China',
  phone: '+86-577-64706888', email: 'scicocare@scico.cn',
  seller: '', sellerRole: '', sellerPlace: 'CHINA',
  beneficiary: '', account: '', bank: '', swift: '', bankAddress: '',
};

const sizes = ['2.5 cm x 5 m', '3.8 cm x 5 m', '5 cm x 5 m', '7.5 cm x 5 m', '10 cm x 5 m'];
const tapePacks = [[240,12],[160,8],[120,6],[80,4],[60,2]];
const bandageSizes = [2.5,5,7.5,10,15].map(width => `${width} cm x 4.5 m`);
const bandagePacks = [[576,48],[288,24],[192,16],[144,12],[96,8]];
const items = (family, name, description, picture, sizeList, packaging, moq = 5000, packs = [], codes = []) =>
  sizeList.map((size, i) => ({ id: `${family}-${i}`, family, name, description, image: `assets/item-${picture}.png`, size,
    packaging, moq, code: codes[i], perCarton: packs[i] ? String(packs[i][0]) : '', perBox: packs[i]?.[1] }));

export const sport = {
  id: 'sport', family: 'sport', name: 'Sport Tape', description: 'Cohesive bandage (nonwoven, latex).',
  image: 'assets/sport-tape.png', size: '7.5 cm x 4.5 m',
  packaging: '1 roll/plastic bag', perBox: 12, perCarton: '192',
};

export const catalog = [sport,
  ...items('cotton', 'Professional Cotton Kinesiology Tape', '96% cotton + 4% spandex. Medical acrylic glue. Blue grid release paper.', 7, sizes, 'OEM box', 5000, tapePacks),
  ...items('synthetic', 'Synthetic Pro Kinesiology Tape', '96% synthetic + 4% spandex. Medical acrylic glue. White release paper.', 6, sizes, 'OEM box', 5000, tapePacks),
  ...items('precut-cotton', 'I Precut Kinesiology Tape (Cotton)', 'Cotton', 5, [sizes[2]], 'OEM box'),
  ...items('precut-synthetic', 'I Precut Kinesiology Tape (Synthetic)', 'Synthetic', 8, [sizes[2]], 'OEM box'),
  ...items('cohesive', 'Professional Nonwoven Cohesive Bandage', '95% nonwoven + 5% polyester. Natural latex glue.', 3, bandageSizes, 'OEM box', 5000, bandagePacks, bandageSizes.map((_,i)=>`SA020${i+1}`)),
  ...items('bio', 'BioWrap (PLA)', 'PLA, latex free', 2, [bandageSizes[1],...bandageSizes.filter((_,i)=>i!==1)], 'OEM box', 20000,
    [bandagePacks[1],...bandagePacks.filter((_,i)=>i!==1)], ['SA0502LF','SA0501LF','SA0503LF','SA0504LF','SA0505LF']),
  ...items('bio-alt', 'BioWrap (Latex-free)', 'Latex free', 1, [bandageSizes[1]], 'OEM box', 20000),
  ...items('cooling', 'Cohesive Cooling Bandage', 'Nonwoven fabric + liquid', 4, [bandageSizes[2],bandageSizes[3]], 'OEM bag', 5000, [[120,10],[96,8]], ['CB0203','CB0204']),
  ...extraCatalog,
];

export const productsById = new Map(catalog.map(product => [product.id, product]));
export const productGroups = new Map();
for (const product of catalog) {
  if (!productGroups.has(product.family)) productGroups.set(product.family, []);
  productGroups.get(product.family).push(product);
}

export const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(new Date()).filter(part => ['year','month','day'].includes(part.type)).map(part => part.value).join('-');

export function newQuote() {
  const date = today();
  return { id: uid(), type: 'quote', number: `Q-${date.replaceAll('-', '')}-${uid().slice(-4).toUpperCase()}`, date,
    customer: '', address: '', phone: '', contact: '', buyerRole: '', buyerPlace: '',
    term: 'FOB Ningbo', freight: '', freightLabel: 'Shipping and service cost',
    payment: '30% deposit in advance, 70% balance to be paid before shipment.',
    delivery: '35–40 days after order details are confirmed.', validity: '60 days', rate: '',
    notes: 'Prices are indicative and subject to final specifications, materials, packaging and printing requirements.', includeBank: false, items: [] };
}

export const newVariant = (price = '', color = '', qty = '', mode = 'rolls') => ({ color, qty, mode, price });

export function newItem(product = {}, price = '') {
  return { name: product.name || '', description: product.description || '', image: product.image || '',
    size: product.size || '', packaging: product.packaging || '', perCarton: product.perCarton || '',
    variants: [newVariant(price)] };
}

export function pickSpecification(item, product, price) {
  const previous = productsById.get(item.catalogId);
  const keepCarton = item.perCarton && !previous;
  return {
    ...item, ...newItem(product), family: product.family, catalogId: product.id, code: product.code || '',
    perBox: product.perBox, autoPrice: true, moq: product.moq || 0,
    perCarton: keepCarton ? item.perCarton : product.perCarton,
    variants: item.variants.map(variant => ({ ...variant, price })),
  };
}

export function packing(item) {
  if (!item.catalogId) return item.packaging;
  const carton = decimalUnits(item.perCarton,0);
  const inner = item.perBox && carton && carton % item.perBox === 0 ? `${item.perBox} rolls/inner box` : '';
  return [item.packaging, inner, carton ? `${carton} rolls/carton` : ''].filter(Boolean).join('\n');
}

export function demoQuote() {
  const item = { ...pickSpecification(newItem(),sport,'0.250'), autoPrice:false };
  item.variants = ['Black','White','Red','Blue','Orange'].map((color, i) => newVariant('0.250', color, String([1,2,2,1,1][i]), 'cartons'));
  return { ...newQuote(), type: 'contract', customer: 'Example Football Club', address: 'Sharjah, UAE', buyerPlace: 'UAE',
    term: 'DDP', freight: '100.00', freightLabel: 'DDP service and shipping cost', validity: '',
    payment: '50% deposit in advance, balance to be paid before dispatch.',
    delivery: '20 days after receipt of the deposit.', notes: 'Demonstration only. Figures are illustrative.', items: [item] };
}

const numberFormat = new Intl.NumberFormat('en-US');
const moneyFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const number = value => numberFormat.format(value);
export const money = cents => `US$${moneyFormat.format(cents / 100)}`;

export function decimalUnits(value, precision, maxWhole = 9999999) {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(String(value ?? '').trim());
  if (!match || !(match[1] || match[2]) || (match[2]?.length ?? 0) > precision) return null;
  const whole = Number(match[1]);
  return whole <= maxWhole ? whole * 10 ** precision + Number((match[2] || '').padEnd(precision, '0')) : null;
}

export function parsePriceFile(content) {
  const { schema, exchangeRate = '', prices } = JSON.parse(content) ?? {};
  if (!['scico-quote-prices-v1','scico-quote-prices-v2'].includes(schema) || !Array.isArray(prices) || !prices.length || prices.length > catalog.length) {
    throw new Error('Invalid price list');
  }
  const v2 = schema === 'scico-quote-prices-v2';
  if (v2 && !decimalUnits(exchangeRate,4,999)) throw new Error('Invalid exchange rate');
  const parsed = new Map();
  for (const row of prices) {
    if (!row || !productsById.has(row.id) || parsed.has(row.id)) throw new Error('Invalid product');
    if (typeof row.unitPrice === 'string' && decimalUnits(row.unitPrice,3,99999) !== null) {
      parsed.set(row.id,{unitPrice:row.unitPrice.trim()});
    } else if (v2 && Array.isArray(row.costs) && row.costs.length === 4 && row.costs.every(cost => decimalUnits(cost,6,99999) !== null) &&
        decimalUnits(row.multiplier,4,9) && [2,3].includes(row.decimals)) {
      parsed.set(row.id,{costs:row.costs,multiplier:row.multiplier,decimals:row.decimals});
    } else {
      throw new Error('Invalid price row');
    }
  }
  return { exchangeRate, entries:Object.fromEntries(parsed) };
}

export function unitPrice(pricing, id) {
  const entry = pricing.entries[id];
  if (!entry) return '';
  if (entry.unitPrice !== undefined) return entry.unitPrice;
  const rate = decimalUnits(pricing.exchangeRate,4,999);
  if (!rate) return '';
  const cost = entry.costs.reduce((sum,part)=>sum + BigInt(decimalUnits(part,6)),0n);
  const numerator = cost * BigInt(decimalUnits(entry.multiplier,4));
  const denominator = BigInt(rate) * BigInt(10 ** (6-entry.decimals));
  const rounded = (numerator*2n+denominator)/(denominator*2n);
  const price = (Number(rounded) / 10 ** entry.decimals).toFixed(3);
  return decimalUnits(price,3,99999) === null ? '' : price;
}

export function line(item, variant) {
  const qty = decimalUnits(variant.qty, 0, 9999999);
  const pack = decimalUnits(item.perCarton, 0, 9999999);
  const price = decimalUnits(variant.price, 3, 99999);
  const rolls = variant.mode === 'cartons' ? (qty !== null && pack ? qty * pack : null) : qty;
  const cartons = rolls !== null && pack ? Math.floor(rolls / pack) : null;
  const loose = rolls !== null && pack ? rolls % pack : 0;
  const quantityValid = rolls > 0 && rolls <= 99999999;
  const valid = quantityValid && price !== null;
  const cents = valid ? Math.floor((rolls * price + 5) / 10) : 0;
  return { rolls, cartons, loose, price, quantityValid, valid, cents };
}

export function totals(quote) {
  const rows = quote.items.flatMap(item => item.variants.map(variant => line(item, variant)));
  const goods = rows.reduce((sum, row) => sum + row.cents, 0);
  const freight = quote.freight === '' ? 0 : decimalUnits(quote.freight, 2);
  return {
    rolls: rows.reduce((sum, row) => sum + (row.quantityValid ? row.rolls : 0), 0),
    cartons: rows.reduce((sum, row) => sum + (row.quantityValid ? row.cartons || 0 : 0), 0),
    loose: rows.reduce((sum, row) => sum + (row.quantityValid ? row.loose : 0), 0),
    unknownCartons: rows.some(row => row.quantityValid && row.cartons === null),
    pendingPrice: rows.some(row => row.quantityValid && row.price === null),
    goods, freight, total: goods + (freight ?? 0),
  };
}

export function validate(quote, company) {
  if (quote.type === 'contract' && !quote.customer.trim()) return '销售合同需要客户名称。请展开「客户与单据」。';
  if (!quote.number.trim() || !quote.date) return '请填写单号和日期。';
  if (!company.name.trim()) return '请在公司资料中填写公司名称。';
  if (!quote.items.length) return '请至少添加一项产品。';
  for (const [i, item] of quote.items.entries()) {
    if (!item.name.trim() || !item.size.trim()) return `请选择第 ${i + 1} 项产品的规格。`;
    if ((item.catalogId || item.perCarton.trim()) && !decimalUnits(item.perCarton,0)) return `第 ${i + 1} 项产品需要填写有效的每外箱卷数。`;
    for (const [j, variant] of item.variants.entries()) {
      const row = line(item,variant);
      if (!row.quantityValid) return `请核对第 ${i + 1} 项产品第 ${j + 1} 行的数量。`;
      if (!row.valid) return `第 ${i + 1} 项产品缺少单价。请到「公司资料」导入计价资料或设置本机单价。`;
    }
  }
  if (totals(quote).freight === null) return '请输入有效的运费，最多两位小数。';
  if (quote.includeBank && ![company.beneficiary, company.account, company.bank, company.swift].every(field => field.trim())) {
    return '请在公司资料中补齐收款人、账号、开户行和 SWIFT。';
  }
  return '';
}
