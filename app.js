import { companyDefaults, decimalUnits, demoQuote, line, money, newItem, newQuote, newVariant, number, packing, parsePriceFile, pickSpecification, productGroups, productsById, totals, unitPrice, validate } from './quote.js?v=4';
import { renderQuote } from './pdf.js?v=4';
import { importPricingWorkbook, WorkbookImportError } from './pricing-workbook.js?v=4';

const app = document.querySelector('#app');
const modal = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const prefix = 'scico-quote/v1/';
let storageWorks = true;
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(prefix + key)) ?? fallback; }
  catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(prefix + key, JSON.stringify(value)); storageWorks = true; return true; }
  catch { storageWorks = false; return false; }
}

let quote = read('draft', newQuote());
let company = { ...companyDefaults, ...read('company', {}) };
let history = read('history', []);
let pricing = read('pricing', { exchangeRate:'', entries:Object.fromEntries(Object.entries(read('reference-prices',{})).map(([id,unitPrice])=>[id,{unitPrice}])) });
let pricingProduct = '';
let page = 'editor';
let toastTimer;
let objectUrls = [];
let exportFile;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const label = item => escape(item.name || '自定义产品');
const show = message => { clearTimeout(toastTimer); toast.textContent = message; toastTimer = setTimeout(() => toast.textContent = '', 4800); };

function field(title, path, value, options = {}) {
  const { type = 'text', mode, max = 100, placeholder = '', wide = false, multiline = false } = options;
  const attrs = `data-field="${path}" maxlength="${max}" placeholder="${escape(placeholder)}"${mode ? ` inputmode="${mode}"` : ''}`;
  return `<label class="field${wide ? ' wide' : ''}"><span>${title}</span>${multiline ? `<textarea ${attrs}>${escape(value)}</textarea>` : `<input type="${type}" ${attrs} value="${escape(value)}">`}</label>`;
}
function option(value, title, selected) {
  return `<option value="${escape(value)}"${value === selected ? ' selected' : ''}>${escape(title)}</option>`;
}
const btn = (text, action, cls = '', index = '', variant = '') => `<button type="button" class="btn ${cls}" data-action="${action}" data-index="${index}" data-variant="${variant}">${text}</button>`;
function group(i, title, content) { return `<section class="panel"><div class="panel-head"><h2 id="${i}">${title}</h2></div>${content}</section>`; }
function changed() {
  write('draft', quote);
  updateTotals();
}

function variantHtml(item, i, variant, j) {
  const path = `items.${i}.variants.${j}.`;
  return `<div class="variant"><div class="variant-fields">
    ${field('颜色', `${path}color`, variant.color, { placeholder: 'Black', max: 40 })}
    <div class="quantity-input">${field('数量', `${path}qty`, variant.qty, { mode: 'numeric', max: 7, placeholder: '0' })}
    <select aria-label="数量单位" data-field="${path}mode">${option('rolls','卷',variant.mode)}${option('cartons','箱',variant.mode)}</select></div>
  </div><div class="variant-bottom"><span class="variant-out" data-line="${i}.${j}"></span>
  ${item.variants.length > 1 ? `<button class="plain danger" type="button" data-action="remove-variant" data-index="${i}" data-variant="${j}" aria-label="删除第 ${j+1} 个颜色">删除</button>` : ''}</div></div>`;
}

function itemHtml(item, i) {
  const path = `items.${i}.`;
  const specs = productGroups.get(item.family);
  const price = item.variants[0].price;
  return `<article class="item"><div class="item-title">
    ${item.image ? `<img class="item-img" src="${escape(item.image)}" alt="">` : ''}
    <div class="item-title-text"><h3>${label(item)}</h3>${item.code ? `<small>${escape(item.code)}</small>` : ''}</div>
    <button class="plain danger" type="button" data-action="remove-item" data-index="${i}">移除</button>
  </div><div class="grid">
    <label class="field"><span>规格</span><select aria-label="规格" data-spec="${i}"${specs?'':' disabled'}>${specs ? `<option value="" disabled${item.catalogId?'':' selected'}>选择规格</option>`+specs.map(product=>option(product.id,product.size,item.catalogId)).join('') : option(item.size,item.size||'历史规格',item.size)}</select></label>
    ${field('每外箱卷数', `${path}perCarton`, item.perCarton, { mode: 'numeric', max: 7, placeholder: '输入卷数' })}
  </div>
  <div class="item-meta"><span class="muted" data-packing="${i}">${escape(packing(item)).replaceAll('\n',' · ')}</span>
    ${item.size ? (price ? `<span class="unit-price">US$${escape(price)} / 卷</span>` : item.catalogId ? btn('设置本机单价','setup-price','quiet',i) : '') : ''}
  </div>
  ${item.moq ? `<p class="storage-note" data-moq="${i}"></p>` : ''}
  ${item.variants.map((variant,j) => variantHtml(item,i,variant,j)).join('')}
  ${!item.family ? `<details class="terms" data-detail="legacy-${i}"><summary>历史产品详情</summary><div class="grid">
    ${field('英文品名',`${path}name`,item.name,{wide:true})}${field('规格',`${path}size`,item.size,{max:55})}
    ${item.variants.map((variant,j)=>field(`第 ${j+1} 行单价 (USD / 卷)`,`${path}variants.${j}.price`,variant.price,{mode:'decimal',max:9})).join('')}
  </div></details>` : ''}
  ${btn('+ 添加颜色', 'add-variant', 'quiet', i)}</article>`;
}

function recentClients() {
  return [...new Map(history.map(record=>record.quote).filter(record=>record.customer).reverse().map(record=>[record.customer,record])).values()].reverse();
}

function editorHtml() {
  const contacts = recentClients();
  const isContract = quote.type === 'contract';
  return `<div class="heading"><div><h1>${isContract ? '销售合同' : '报价单'}</h1><p class="muted">${isContract ? 'Sales contract' : 'Quotation'}</p></div>
    <div class="heading-actions">${btn('载入样例','demo')}${btn('新建','new','quiet')}</div></div>
    <div class="editor"><div class="main-col">
    <section class="panel"><div class="panel-head"><h2>产品明细</h2>${btn('+ 添加产品','catalog','quiet')}</div>
      ${quote.items.length ? `<div class="items">${quote.items.map(itemHtml).join('')}</div>` : `<div class="empty">搜索英文品名，再从目录选择规格。</div>`}
    </section>
    ${group('quote-terms','运费与条款',`<div class="grid">
      ${field('运费和服务费 (USD)','freight',quote.freight,{mode:'decimal',placeholder:'0.00',max:10})}
    </div><details class="terms" data-detail="terms"><summary>付款、交期与其他条款</summary><div class="grid">
      ${field('贸易条款','term',quote.term,{placeholder:'FOB Ningbo / DDP',max:60})}
      ${field('英文费用名称','freightLabel',quote.freightLabel,{wide:true,max:90})}
      ${field('英文付款方式','payment',quote.payment,{multiline:true,wide:true,max:230})}
      ${field('英文交期','delivery',quote.delivery,{wide:true,max:165})}
      ${field('报价有效期','validity',quote.validity,{max:85})}
      ${field('汇率条款','rate',quote.rate,{max:130})}
      ${field('英文备注','notes',quote.notes,{multiline:true,wide:true,max:280})}
      ${isContract ? field('客户签署人职务','buyerRole',quote.buyerRole,{max:65}) + field('客户签署地点','buyerPlace',quote.buyerPlace,{max:65}) : ''}
      <label class="check wide"><input type="checkbox" data-field="includeBank"${quote.includeBank?' checked':''}>在 PDF 中显示公司收款账户</label>
    </div></details>`)}
    <details class="panel terms" data-detail="quote-info"><summary>客户与单据${quote.customer ? ` · ${escape(quote.customer)}` : ''}</summary><div class="grid">
      <label class="field"><span>单据类型</span><select data-field="type">${option('quote','报价单',quote.type)}${option('contract','销售合同',quote.type)}</select></label>
      ${field('日期','date',quote.date,{type:'date'})}
      ${field('单号','number',quote.number,{max:45})}
      ${field('客户名称','customer',quote.customer,{placeholder:'英文公司名称',max:115})}
      ${contacts.length ? `<label class="field wide"><span>历史客户</span><select id="recent-client"><option value="">选客户并带入联系方式</option>${contacts.map((contact,i)=>option(String(i),contact.customer,'')).join('')}</select></label>` : ''}
      ${field('客户地址','address',quote.address,{wide:true,max:180})}
      ${field('联系人','contact',quote.contact,{max:80})}${field('电话','phone',quote.phone,{type:'tel',max:45})}
    </div></details>
    </div><aside class="side-col">${group('quote-summary','金额汇总',`
      <dl class="totals"><div><dt>产品数量</dt><dd data-total="quantity"></dd></div><div><dt>货款</dt><dd data-total="goods"></dd></div><div><dt>运费和服务费</dt><dd data-total="freight"></dd></div><div class="total"><dt>总额</dt><dd data-total="total"></dd></div></dl>
      <div class="pdf-actions">${btn('预览并导出 PDF','preview','primary block')}${btn('保存到历史','save','block')}</div><p class="storage-note muted" data-storage>草稿自动保存在本机浏览器。</p>`)}</aside></div>
    <div class="mobile-actions"><div><small>总额</small><strong data-total="total"></strong></div><div class="actions">${btn('保存','save')}${btn('预览 PDF','preview','primary')}</div></div>`;
}

function historyHtml() {
  return `<div class="heading"><h1>历史单据</h1>${btn('新建报价','new','primary')}</div><section class="panel">
    ${history.length ? history.map(({quote: saved}, i) => `<article class="record"><div class="record-details"><h3>${escape(saved.customer || (saved.type==='contract'?'销售合同':'通用报价单'))}</h3><p class="muted">${escape(saved.number)} · ${escape(saved.date)} · ${money(totals(saved).total)}</p></div><div class="actions">
    ${btn('打开','open-record','quiet',i)}${btn('复制','copy-record','',i)}${btn('删除','delete-record','danger',i)}</div></article>`).join('') : '<div class="empty">保存一张报价单后，历史单据会显示在这里。</div>'}
    <p class="storage-note muted">历史单据保存在当前浏览器。清除网站数据会移除本机记录。</p></section>`;
}

function settingsHtml() {
  const c = (title,key,opts) => field(title, `company.${key}`, company[key], opts);
  const priceCount = Object.keys(pricing.entries).length;
  const hasFormula = Object.values(pricing.entries).some(entry=>entry.costs);
  return `<div class="heading"><h1>公司资料</h1>${btn('返回开单','editor','quiet')}</div><div class="settings">
  ${group('settings-prices','本机计价',`<label class="field"><span>导入计价资料（Excel 或 JSON）</span><input type="file" id="price-file" accept=".xlsx,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json"></label>
    <p class="storage-note muted">可直接导入《报价模板.xlsx》。${priceCount ? `本机已配置 ${priceCount} 个规格。` : '导入后选择规格即可自动计价。'}资料只保存于当前浏览器。</p>
    ${hasFormula ? `<div class="grid settings-row"><label class="field"><span>计价汇率（人民币 / 美元）</span><input id="exchange-rate" inputmode="decimal" maxlength="8" value="${escape(pricing.exchangeRate)}"></label>${btn('应用汇率','apply-rate','quiet')}</div>` : ''}
    <div class="grid settings-row"><label class="field wide"><span>为缺价规格设置固定单价</span><select id="price-product">${option('','选择产品及规格',pricingProduct)}${[...productGroups.values()].map(list=>`<optgroup label="${escape(list[0].name)}">${list.map(product=>option(product.id,product.size,pricingProduct)).join('')}</optgroup>`).join('')}</select></label>
    <label class="field"><span>固定单价 (USD / 卷)</span><input id="manual-price" inputmode="decimal" maxlength="9" value="${escape(pricing.entries[pricingProduct]?.unitPrice??'')}" placeholder="0.000"></label>${btn('保存本机单价','save-price','quiet')}</div>
    ${priceCount ? btn('清除本机计价资料','clear-prices','danger price-clear') : ''}`)}
  ${group('settings-company','PDF 抬头与签署',`<div class="grid">
    ${c('英文公司名称','name',{wide:true,max:140})}${c('英文地址','address',{wide:true,max:230})}
    ${c('电话','phone',{type:'tel',max:46})}${c('邮箱','email',{type:'email',max:80})}
    ${c('卖方代表','seller',{max:75})}${c('职务','sellerRole',{max:65})}${c('签署地点','sellerPlace',{max:65})}</div>`)}
  ${group('settings-bank','收款账户',`<div class="grid">${c('收款人','beneficiary',{wide:true,max:140})}${c('账号','account',{max:65})}${c('SWIFT','swift',{max:60})}
    ${c('开户行','bank',{wide:true,max:130})}${c('银行英文地址','bankAddress',{wide:true,max:180})}</div>
    <p class="storage-note muted" data-storage>修改自动保存在本机。开单时可勾选在 PDF 中显示账户。</p>`)}
  </div>`;
}

function render({ preserve = false } = {}) {
  const open = preserve ? [...app.querySelectorAll('details[open]')].map(detail => detail.dataset.detail) : [];
  app.innerHTML = page === 'editor' ? editorHtml() : page === 'history' ? historyHtml() : settingsHtml();
  if (preserve) for (const detail of app.querySelectorAll('details')) {
    if (open.includes(detail.dataset.detail)) detail.open = true;
  }
  document.querySelectorAll('nav button').forEach(button => {
    if (button.dataset.action === page) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  updateTotals();
}

function updateTotals() {
  const sum = totals(quote);
  const qty = [`${number(sum.rolls)} 卷`, sum.unknownCartons ? '部分箱数待确认' : `${number(sum.cartons)} 箱`, sum.loose ? `${number(sum.loose)} 零卷` : ''].filter(Boolean).join(' · ');
  const values = { quantity: qty, goods: sum.pendingPrice ? '待计价' : money(sum.goods), freight: sum.freight === null ? '请核对运费' : money(sum.freight),
    total: sum.pendingPrice || sum.freight === null ? '待核对' : money(sum.total) };
  app.querySelectorAll('[data-total]').forEach(el => el.textContent = values[el.dataset.total]);
  quote.items.forEach((item,i) => {
    const packageLabel = app.querySelector(`[data-packing="${i}"]`);
    if (packageLabel) packageLabel.textContent = packing(item).replaceAll('\n',' · ');
    const moq = app.querySelector(`[data-moq="${i}"]`);
    if (moq) {
      const rolls = item.variants.reduce((sum,variant)=>{
        const row = line(item,variant);
        return sum + (row.quantityValid ? row.rolls : 0);
      },0);
      moq.textContent = rolls && rolls < item.moq ? `低于起订量 ${number(item.moq)} 卷，请核对。` : '';
      moq.hidden = !moq.textContent;
    }
    item.variants.forEach((variant,j) => {
      const el = app.querySelector(`[data-line="${i}.${j}"]`);
      if (!el) return;
      const calculated = line(item, variant);
      const details = calculated.quantityValid ? `${number(calculated.rolls)} 卷${calculated.cartons === null ? '' : ` · ${number(calculated.cartons)} 整箱`}` : '';
      const warning = calculated.loose > 0 ? ` · 另有 ${number(calculated.loose)} 零卷` : '';
      el.innerHTML = calculated.quantityValid ? `${details}<span class="warning">${warning}</span> · ${calculated.valid ? `<strong>${money(calculated.cents)}</strong>` : '<span class="warning">待计价</span>'}` :
        variant.qty ? '<span class="warning">请核对每外箱卷数和数量</span>' : '待填写数量';
    });
  });
  if (!storageWorks) app.querySelectorAll('[data-storage]').forEach(el => el.textContent = '当前浏览器存储不可用，请及时导出 PDF。');
}

app.addEventListener('input', event => {
  const el = event.target;
  const key = el.dataset.field;
  if (!key) return;
  const value = el.type === 'checkbox' ? el.checked : el.value;
  if (key.startsWith('company.')) {
    company[key.split('.')[1]] = value;
    write('company', company);
    updateTotals();
    return;
  }
  const keys = key.split('.');
  const record = keys.slice(0,-1).reduce((obj, segment) => obj[segment], quote);
  record[keys.at(-1)] = value;
  changed();
  if (key === 'type') render({preserve:true});
});

app.addEventListener('change', async event => {
  if (event.target.dataset.spec !== undefined && event.target.value) {
    const index = Number(event.target.dataset.spec);
    const product = productsById.get(event.target.value);
    quote.items[index] = pickSpecification(quote.items[index],product,unitPrice(pricing,product.id));
    changed(); render({preserve:true});
    return;
  }
  if (event.target.id === 'price-product') {
    pricingProduct = event.target.value;
    app.querySelector('#manual-price').value = pricing.entries[pricingProduct]?.unitPrice ?? '';
    return;
  }
  if (event.target.id === 'price-file') {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;
    const isWorkbook = /\.xlsx$/i.test(file.name);
    input.disabled = true;
    try {
      if (file.size > (isWorkbook ? 16*1024*1024 : 65536)) { show('文件过大，请使用报价模板或较小的计价文件。'); return; }
      const imported = isWorkbook ? await importPricingWorkbook(file) : parsePriceFile(await file.text());
      const count = Object.keys(imported.entries).length;
      updatePricing({exchangeRate:imported.exchangeRate || pricing.exchangeRate, entries:{...pricing.entries,...imported.entries}},`已导入 ${count} 个规格的计价资料。`);
    } catch (error) {
      show(error instanceof WorkbookImportError ? error.message : '无法导入，请选择原版或另存的《报价模板.xlsx》，或 SCICO 计价 JSON 文件。');
    } finally {
      input.value = '';
      input.disabled = false;
    }
    return;
  }
  if (event.target.id !== 'recent-client' || event.target.value === '') return;
  const contacts = recentClients();
  const record = contacts[Number(event.target.value)];
  for (const field of ['customer','address','contact','phone','buyerPlace','buyerRole']) quote[field] = record[field];
  changed();
  render({preserve:true});
});

function navigate(next) { page = next; render(); window.scrollTo(0,0); }
function updatePricing(next, message) {
  if (!write('pricing',next)) { show('本机存储不可用，计价资料未保存。'); return; }
  pricing = next;
  const saved = history.find(record=>record.quote.id === quote.id);
  if (JSON.stringify(saved?.quote) !== JSON.stringify(quote)) {
    for (const item of quote.items) if (item.autoPrice) {
      const price = unitPrice(pricing,item.catalogId);
      item.variants.forEach(variant=>variant.price = price);
    }
    changed();
  }
  render();
  show(message);
}
function setDraft(next) { quote = next; changed(); navigate('editor'); }
function keepCurrent() {
  const saved = history.find(record => record.quote.id === quote.id);
  return !(quote.items.length || quote.customer) || JSON.stringify(saved?.quote) === JSON.stringify(quote) ||
    confirm('当前草稿尚未保存到历史。是否替换当前草稿？');
}
function save() {
  const error = validate(quote, company);
  if (error) { show(error); return; }
  const copy = JSON.parse(JSON.stringify(quote));
  const snapshot = { quote: copy, company: { ...company }, updated: Date.now() };
  const previous = history.find(row => row.quote.id === quote.id);
  if (previous && !confirm('替换这张历史单据的已保存版本？如需保留旧版，可在历史里复制后编辑。')) return;
  const next = [snapshot, ...history.filter(row => row.quote.id !== quote.id)];
  if (write('history', next)) { history = next; show('已保存到本机历史。'); render({preserve:true}); }
  else show('保存失败，请导出 PDF 保存这张单据。');
}

function catalogResults(value) {
  const normalize = value => value.toLowerCase().replace(/[-–]/g,'').replace(/\s+/g,' ');
  const words = normalize(value.trim()).split(' ');
  const matches = [...productGroups.values()].filter(list=>words.every(word=>normalize(list.map(product=>
    `${product.name} ${product.description} ${product.code || ''} ${product.size}`).join(' ')).includes(word)));
  return matches.length ? matches.map(list => {
    const product = list[0];
    return `<button type="button" class="btn catalog-row" data-action="add-product" data-product="${product.family}">
      <img loading="lazy" src="${product.image}" alt=""><span>${escape(product.name)}<small>${list.length===1?escape(product.size):`${list.length} 个规格`}</small></span></button>`;
  }).join('') : '<p class="empty">未找到匹配品名。可尝试简化英文关键词，或搜索目录货号。</p>';
}

function openCatalog() {
  modal.innerHTML = `<div class="dialog-header"><h2>添加产品</h2>${btn('关闭','close')}</div><div class="dialog-body">
    <label class="field"><span>英文品名或目录货号</span><input id="catalog-search" type="search" placeholder="例如 Sport Tape 或 SA0203" autocomplete="off" autofocus></label>
    <div class="catalog-list" id="catalog-results">${catalogResults('')}</div></div>`;
  modal.showModal();
  modal.querySelector('#catalog-search').addEventListener('input', event => modal.querySelector('#catalog-results').innerHTML = catalogResults(event.target.value));
}

function addItem(family) {
  if (modal.open) modal.close();
  const specs = productGroups.get(family);
  const product = specs[0];
  const base = {...newItem(product),family,size:'',perCarton:''};
  const item = specs.length === 1 ? pickSpecification(base,product,unitPrice(pricing,product.id)) : base;
  const last = quote.items.push(item) - 1;
  changed(); render({preserve:true});
  app.querySelectorAll('.item')[last].scrollIntoView({ block:'center' });
}

function releasePreview() {
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
  exportFile = undefined;
}

async function preview(button) {
  const saved = history.find(record => record.quote.id === quote.id && JSON.stringify(record.quote) === JSON.stringify(quote));
  const profile = saved?.company ?? company;
  const error = validate(quote, profile);
  if (error) { show(error); return; }
  button.disabled = true;
  button.textContent = '正在生成…';
  try {
    const {blob,pages} = await renderQuote(JSON.parse(JSON.stringify(quote)), {...profile});
    const filename = `${quote.number.replace(/[^\p{L}\p{N}._-]/gu,'_')}.pdf`;
    releasePreview();
    exportFile = new File([blob],filename,{type:'application/pdf'});
    objectUrls.push(URL.createObjectURL(blob), ...pages.map(page => URL.createObjectURL(page)));
    const canShare = navigator.canShare?.({files:[exportFile]});
    modal.innerHTML = `<div class="dialog-header"><h2>PDF 预览 <small>· ${pages.length} 页</small></h2>${btn('关闭','close')}</div>
      <div class="dialog-body preview">${objectUrls.slice(1).map((url,i) => `<img src="${url}" alt="PDF 第 ${i+1} 页">`).join('')}</div><div class="dialog-footer">
      <a class="btn${canShare ? '' : ' primary'}" href="${objectUrls[0]}" download="${escape(filename)}">保存 PDF</a>${canShare ? btn('分享 PDF','share','primary') : ''}</div>`;
    modal.showModal();
  } catch (error) { console.error(error); show('PDF 生成失败，请重试。'); }
  finally { button.disabled = false; button.textContent = button.closest('.mobile-actions') ? '预览 PDF' : '预览并导出 PDF'; }
}

modal.addEventListener('close', releasePreview);
render();

document.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const i = Number(button.dataset.index);
  const j = Number(button.dataset.variant);
  switch (action) {
    case 'editor': case 'history': case 'settings': navigate(action); return;
    case 'new': if (keepCurrent()) setDraft(newQuote()); return;
    case 'demo': if (keepCurrent()) setDraft(demoQuote()); return;
    case 'catalog': openCatalog(); return;
    case 'add-product': addItem(button.dataset.product); return;
    case 'close': modal.close(); return;
    case 'save': save(); return;
    case 'setup-price':
      pricingProduct = quote.items[i].catalogId;
      navigate('settings');
      app.querySelector('#manual-price').focus();
      return;
    case 'save-price': {
      const price = app.querySelector('#manual-price').value.trim();
      if (!productsById.has(pricingProduct) || decimalUnits(price,3,99999) === null) { show('请选择产品规格并输入有效单价，最多三位小数。'); return; }
      updatePricing({...pricing,entries:{...pricing.entries,[pricingProduct]:{unitPrice:price}}},'固定单价已保存在本机。');
      return;
    }
    case 'apply-rate': {
      const exchangeRate = app.querySelector('#exchange-rate').value.trim();
      if (!decimalUnits(exchangeRate,4,999)) { show('请输入大于 0 的汇率，最多四位小数。'); return; }
      updatePricing({...pricing,exchangeRate},'汇率已更新。');
      return;
    }
    case 'clear-prices':
      if (confirm('清除本机的参考价和计价资料？')) updatePricing({exchangeRate:'',entries:{}},'已清除本机计价资料。');
      return;
    case 'preview': await preview(button); return;
    case 'share':
      try { await navigator.share({files:[exportFile]}); }
      catch (error) { if (error.name !== 'AbortError') window.alert('分享失败，请点“保存 PDF”。'); }
      return;
    case 'open-record':
      if (keepCurrent()) setDraft(JSON.parse(JSON.stringify(history[i].quote)));
      return;
    case 'copy-record': {
      if (!keepCurrent()) return;
      const {id, number, date} = newQuote();
      setDraft({...JSON.parse(JSON.stringify(history[i].quote)), id, number, date});
      return;
    }
    case 'delete-record': {
      if (!confirm('删除这张本机历史单据？')) return;
      const next = history.filter((_,index) => index !== i);
      if (write('history', next)) { history = next; render(); }
      else show('删除失败，请重试。');
      return;
    }
    case 'remove-item': quote.items.splice(i,1); break;
    case 'add-variant': {
      const {price,mode} = quote.items[i].variants.at(-1);
      quote.items[i].variants.push(newVariant(price,'','',mode));
      break;
    }
    case 'remove-variant': quote.items[i].variants.splice(j,1); break;
    default: return;
  }
  changed(); render({preserve:true});
});
