import { line, money, number, packing, totals } from './quote.js?v=4';

const cols = [43,112,185,77,100,68,71,137,113,134];
const left = 40;
const right = left + cols.reduce((sum, width) => sum + width, 0);
const edge = cols.reduce((offsets, width) => [...offsets, offsets.at(-1) + width], [left]);
const width = 1120;
const height = 792;
const bottom = height - 43;
const scale = 2.5;
const encoder = new TextEncoder();
const loadImage = source => new Promise(resolve => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = source;
});

function pdfFile(jpegs) {
  const pieces = [];
  const positions = [0];
  let length = 0;
  function write(value) {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    pieces.push(bytes);
    length += bytes.byteLength;
  }
  function object(id, value, stream) {
    positions[id] = length;
    write(`${id} 0 obj\n${value}\n`);
    if (stream) {
      write('stream\n');
      write(stream);
      write('\nendstream\n');
    }
    write('endobj\n');
  }
  write('%PDF-1.4\n');
  write(new Uint8Array([37,226,227,207,211,10]));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = jpegs.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  object(2, `<< /Type /Pages /Count ${jpegs.length} /Kids [ ${kids} ] >>`);
  jpegs.forEach((jpeg, i) => {
    const id = 3 + i * 3;
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
    object(id+1, `<< /Type /XObject /Subtype /Image /Width ${width*scale} /Height ${height*scale} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
    const contents = encoder.encode('q\n841.89 0 0 595.28 0 0 cm\n/Im Do\nQ\n');
    object(id+2, `<< /Length ${contents.length} >>`, contents);
  });
  const xref = length;
  write(`xref\n0 ${positions.length}\n0000000000 65535 f \n`);
  positions.slice(1).forEach(offset => write(`${String(offset).padStart(10, '0')} 00000 n \n`));
  write(`trailer\n<< /Size ${positions.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(pieces, { type: 'application/pdf' });
}

export async function renderQuote(quote, company) {
  const sources = [...new Set(['assets/logo.png', ...quote.items.map(item => item.image).filter(Boolean)])];
  const images = new Map(await Promise.all(sources.map(async source => [source, await loadImage(source)])));
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.scale(scale, scale);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#141414';
  ctx.textBaseline = 'middle';
  let y;
  let page = 0;
  const jpegBlobs = [];
  function font(size, bold = false) {
    ctx.font = `${bold ? 700 : 400} ${size}px Arial, "PingFang SC", "Microsoft YaHei", sans-serif`;
  }
  function wrap(value, measure, size = 12, bold = false) {
    font(size, bold);
    return String(value || '').replace(/\r/g, '').split('\n').flatMap(part => {
      const lines = [];
      let current = '';
      for (const word of part.split(/\s+/)) {
        const joined = current ? `${current} ${word}` : word;
        if (ctx.measureText(joined).width <= measure) { current = joined; continue; }
        if (current) lines.push(current);
        current = '';
        for (const char of word) {
          if (current && ctx.measureText(current + char).width > measure) { lines.push(current); current = ''; }
          current += char;
        }
      }
      lines.push(current);
      return lines;
    });
  }
  function box(x, top, w, h, fill) {
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, top, w, h); }
    ctx.strokeRect(x, top, w, h);
  }
  function text(value, x, mid, measure, opts = {}) {
    const { size = 12, bold = false, align = 'left', step = size + 3 } = opts;
    const lines = Array.isArray(value) ? value : wrap(value, measure, size, bold);
    font(size, bold);
    ctx.fillStyle = '#121212';
    ctx.textAlign = align;
    lines.forEach((line, index) => ctx.fillText(line, align === 'center' ? x + measure/2 : align === 'right' ? x + measure : x,
      mid + (index - (lines.length-1)/2)*step));
  }
  function cell(value, x, top, w, h, opts = {}) {
    box(x, top, w, h, opts.fill);
    if (value) text(value, x+6, top+h/2, w-12, { align: 'center', ...opts });
  }
  function picture(source, x, top, w, h) {
    const image = images.get(source);
    if (!image) return;
    const ratio = Math.min(w / image.naturalWidth, h / image.naturalHeight);
    const iw = image.naturalWidth * ratio;
    const ih = image.naturalHeight * ratio;
    ctx.drawImage(image, x + (w-iw)/2, top + (h-ih)/2, iw, ih);
  }
  function fieldsHeight(fields, valueWidth) {
    return fields.reduce((sum, [,value]) => sum + 15 * wrap(value, valueWidth).length, 0);
  }
  function fieldsBlock(fields, x, top, w, labelWidth) {
    let cursor = top;
    fields.forEach(([label,value]) => {
      const lines = wrap(value, w-labelWidth);
      const h = lines.length * 15;
      text([label], x, cursor+7.5, labelWidth-5);
      text(lines, x+labelWidth, cursor+h/2, w-labelWidth);
      cursor += h;
    });
  }
  function begin(withColumns) {
    page++;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    y = 31;
    const name = wrap(company.name, 764, 23, true);
    const address = wrap(company.address, 814, 11);
    const contacts = wrap([company.phone && `Tel: ${company.phone}`, company.email && `Email: ${company.email}`].filter(Boolean).join('     '), 814, 11);
    const mast = Math.max(82, 18+26*name.length+14*(address.length+contacts.length));
    box(left, y, right-left, mast);
    picture('assets/logo.png', left+12, y+10, 100, mast-20);
    text(name, 166, y+10+13*name.length, 820, { size: 23, bold: true, align: 'center' });
    text([...address, ...contacts], 145, y+13+26*name.length+7*(address.length+contacts.length), 862, { size: 11, align: 'center' });
    y += mast;
    cell(quote.type === 'contract' ? 'SALES CONTRACT' : 'QUOTATION', left, y, right-left, 34, { size: 18, bold: true });
    y += 34;
    const fields = [['To:',quote.customer], ['Address:',quote.address], ['Tel:',quote.phone], ['Contact:',quote.contact]].filter(([,value]) => value);
    const docFields = [['No.',quote.number], ['Date:',quote.date]];
    const h = page === 1 ? Math.max(fieldsHeight(fields, 655), fieldsHeight(docFields, 162)) + 14 : 29;
    box(left, y, right-left, h);
    if (page === 1) {
      fieldsBlock(fields, left+10, y+7, 730, 75);
      fieldsBlock(docFields, right-228, y+7, 217, 55);
    } else text(`${quote.customer}   /   ${quote.number}`, left+11, y+h/2, right-left-22);
    y += h;
    if (withColumns) {
      const labels = ['No.','Image','Product','Color','Size','Rolls','Cartons','Packaging','Price\n(USD / roll)','In total\n(USD)'];
      labels.forEach((label, index) => cell(label, edge[index], y, cols[index], 47, { fill: '#0db0df', size: 12 }));
      y += 47;
    }
  }
  async function end() {
    text(`${quote.number}   /   ${page}`, left, height-25, right-left, { align: 'right', size: 10 });
    const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
    if (!jpeg) throw new Error('Cannot encode PDF page');
    jpegBlobs.push(jpeg);
  }
  begin(true);
  for (const [index, item] of quote.items.entries()) {
    const name = wrap(item.name, cols[2]-14, 14, true);
    const descriptionText = [item.code && `Item: ${item.code}`,item.description].filter(Boolean).join('\n');
    const description = descriptionText ? wrap(descriptionText, cols[2]-14) : [];
    const packaging = wrap(packing(item), cols[7]-12, 11);
    const minHeight = Math.max(38, item.image ? 79 : 0, name.length*17+description.length*15+17, packaging.length*14+12);
    const rows = item.variants.map(variant => {
      const row = line(item, variant);
      const cartons = row.cartons === null ? '—' : `${number(row.cartons)}${row.loose ? `\n+${number(row.loose)} loose` : ''}`;
      const values = [variant.color || '—', item.size, number(row.rolls), cartons, '', `US$${(row.price/1000).toFixed(3)}`, money(row.cents)];
      const lines = values.map((value, i) => wrap(value, cols[3+i]-12));
      return { lines, height: Math.max(28, ...lines.map(list => 15*list.length + 8)) };
    });
    let start = 0;
    while (start < rows.length) {
      if (y + Math.max(rows[start].height, minHeight) > bottom) { await end(); begin(true); }
      let stop = start;
      let rowHeight = 0;
      while (stop < rows.length && Math.max(minHeight, rowHeight+rows[stop].height)+y <= bottom) rowHeight += rows[stop++].height;
      if (stop === start) throw new Error('Product group exceeds page');
      const h = Math.max(rowHeight, minHeight);
      cell(String(index+1), edge[0], y, cols[0], h);
      box(edge[1], y, cols[1], h);
      picture(item.image, edge[1]+5, y+5, cols[1]-10, Math.min(112,h-10));
      box(edge[2], y, cols[2], h);
      const nameTop = y+(h-name.length*17-description.length*15)/2;
      text(name, edge[2]+7, nameTop+name.length*17/2, cols[2]-14, { size: 14, bold: true, align: 'center' });
      text(description, edge[2]+7, nameTop+name.length*17+description.length*15/2, cols[2]-14, { align: 'center' });
      cell(packaging, edge[7], y, cols[7], h, { size: 11 });
      let rowY = y;
      for (let i=start; i<stop; i++) {
        const rowH = rows[i].height + (i === stop-1 ? h-rowHeight : 0);
        rows[i].lines.forEach((list,j) => { if (j !== 4) cell(list, edge[j+3], rowY, cols[j+3], rowH); });
        rowY += rowH;
      }
      y += h;
      start = stop;
      if (start < rows.length) { await end(); begin(true); }
    }
  }

  const sums = totals(quote);
  const terms = [['TRADE TERM:',quote.term], ['PAYMENT:',quote.payment], ['DELIVERY TIME:',quote.delivery],
    ['VALIDITY:',quote.validity], ['RATE:',quote.rate], ['NOTE:',quote.notes]].filter(([,value]) => value.trim());
  const bank = [['BENEFICIARY:',company.beneficiary], ['ACCOUNT NO.:',company.account], ['OPENING BANK:',company.bank],
    ['BANK SWIFT:',company.swift], ['BANK ADDRESS:',company.bankAddress]].filter(([,value]) => value.trim());
  const buyer = [['REPRESENTATIVE:',quote.contact], ['POSITION:',quote.buyerRole], ['DATE:',quote.date], ['PLACE:',quote.buyerPlace]];
  const seller = [['REPRESENTATIVE:',company.seller], ['POSITION:',company.sellerRole], ['DATE:',quote.date], ['PLACE:',company.sellerPlace]];
  const labeledHeight = fields => 25+fieldsHeight(fields, right-left-205)+8;
  const half = (right-left)/2;
  const signatureHeight = 58+Math.max(fieldsHeight(buyer, half-169),fieldsHeight(seller, half-169));
  const sections = [];
  const footnote = [sums.loose && `* Loose rolls included in total quantity: ${number(sums.loose)}. Cartons are counted separately by line.`, sums.unknownCartons && '— Carton quantity unavailable for some items.'].filter(Boolean).join('  ');
  sections.push([87+(footnote?23:0), () => {
    cell('Total products:', left, y, edge[5]-left, 29, { align:'right' });
    cell(number(sums.rolls), edge[5], y, cols[5], 29);
    cell(sums.unknownCartons ? '—' : `${number(sums.cartons)}${sums.loose?'*':''}`, edge[6], y, cols[6], 29);
    cell('', edge[7], y, edge[9]-edge[7], 29);
    cell(money(sums.goods), edge[9], y, cols[9], 29);
    y += 29;
    for (const [label,amount,bold] of [[quote.freightLabel || 'Shipping and service cost',sums.freight,false],['TOTAL:',sums.total,true]]) {
      cell(label, left, y, edge[9]-left, 29, { bold });
      cell(money(amount), edge[9], y, cols[9], 29, { bold });
      y += 29;
    }
    if (footnote) { cell(footnote,left,y,right-left,23,{ size:10, align:'left' }); y += 23; }
  }]);
  for (const [title, fields] of [['TRADE DETAILS',terms],['BANK',quote.includeBank?bank:[]]]) {
    if (!fields.length) continue;
    const h = labeledHeight(fields);
    sections.push([h, () => {
      box(left,y,right-left,h);
      text(title,left+9,y+12,right-left-18,{bold:true});
      fieldsBlock(fields,left+9,y+24,right-left-20,185);
      y += h;
    }]);
  }
  if (quote.type === 'contract') sections.push([signatureHeight, () => {
    [[left,'BUYER:',buyer],[left+half,'SELLER:',seller]].forEach(([x,title,fields]) => {
      box(x,y,half,signatureHeight);
      text(title,x+9,y+14,half-18,{size:15,bold:true});
      fieldsBlock(fields,x+9,y+27,half-19,150);
    });
    y += signatureHeight;
  }]);
  const sectionHeight = sections.reduce((sum,[h]) => sum+h,0);
  if (y + sectionHeight > bottom && sectionHeight <= 490) { await end(); begin(false); }
  for (const [h, draw] of sections) {
    if (y+h > bottom) { await end(); begin(false); }
    draw();
  }
  await end();
  canvas.width = 1;
  canvas.height = 1;
  const data = await Promise.all(jpegBlobs.map(async blob => new Uint8Array(await blob.arrayBuffer())));
  return { blob: pdfFile(data), pages: jpegBlobs };
}
