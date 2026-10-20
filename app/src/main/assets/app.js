const API = location.hostname === 'appassets.androidplatform.net' ? 'http://10.0.2.2:8080/api' : '/api';
let token = '', tab = 'Özet', page = '', products = [], orders = [], ads = [], profile = {};
let filters = { products: 'Tümü', orders: 'Tümü' };
let searchText = { products: '', orders: '' };
let days = 30, selectedOrder = '', viewGeneration = 0;
const $ = selector => document.querySelector(selector);
const root = $('#root');
const money = value => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
function input(label, name, type = 'text', value = '', attributes = '') {
  return `<input class="field" type="${type}" name="${name}" aria-label="${esc(label)}" placeholder="${esc(label)}" value="${esc(value)}" ${attributes}>`;
}
function searchField(id, placeholder, value, onInput) {
  return `<div class="search">${icon('search')}<input class="field" id="${id}" type="search" aria-label="${esc(placeholder)}" placeholder="${esc(placeholder)}" value="${esc(value)}" oninput="${onInput}(this.value)"></div>`;
}
function nav() {
  const items = [['Özet', 'overview'], ['Ürünler', 'products'], ['Siparişler', 'orders'], ['Reklam', 'ads'], ['Hesabım', 'account']];
  return `<nav class="bottom" aria-label="Ana menü">${items.map(([label, symbol]) => `<button type="button" class="${tab === label ? 'sel' : ''}" ${tab === label ? 'aria-current="page"' : ''} onclick="go('${label}')"><span class="nav-icon">${icon(symbol)}</span><span class="nav-label">${label}</span></button>`).join('')}</nav>`;
}
function status(value) {
  const kind = ['Yayında', 'Ödendi', 'Teslim edildi'].includes(value) ? 'ok' : ['Bekliyor', 'İncelemede'].includes(value) ? 'wait' : '';
  return `<span class="pill ${kind}">${esc(value)}</span>`;
}
function shell(content) { root.innerHTML = `<main class="wrap"><div class="pad">${content}</div></main>${nav()}`; }
function emptyState(message) { return `<div class="empty-state">${esc(message)}</div>`; }
function metric(label, value, symbol) { return `<div class="metric"><div class="ico">${icon(symbol)}</div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`; }
function pageHeader(title) { return `<div class="row"><button class="back" aria-label="Geri dön" onclick="openPage('')">${icon('back')}</button><h1 class="head" style="font-size:19px">${esc(title)}</h1></div>`; }
function showPageError(error, generation) {
  if (!token || generation !== viewGeneration) return;
  shell(`${page ? pageHeader('Bir sorun oluştu') : '<h1 class="head">Bir sorun oluştu</h1>'}<div class="card"><p class="error" role="alert">${esc(error.message || 'İstek tamamlanamadı.')}</p><button class="btn outline" onclick="draw()">Tekrar dene</button></div>`);
}
function isCurrent(generation) { return !!token && generation === viewGeneration; }
async function loadAll() {
  if (!token) return;
  const epoch = sessionEpoch;
  const result = await Promise.all([req('/products'), req('/orders'), req('/ads'), req('/profile')]);
  if (!token || epoch !== sessionEpoch) return;
  [products, orders, ads, profile] = result;
}
function go(value) { tab = value; page = ''; draw(); }
function openPage(value) { page = value; draw(); }
function draw() {
  viewGeneration++;
  if (!token) { auth(); return; }
  if (page === 'order') { orderPage(); return; }
  if (page === 'reports') { reportPage(); return; }
  if (page === 'settlements') { settlementPage(); return; }
  ({ Özet: dashboard, Ürünler: productPage, Siparişler: orderPageList, Reklam: adPage, Hesabım: accountPage }[tab] || dashboard)();
}

async function dashboard() {
  const generation = viewGeneration;
  shell('<div class="loading-state" role="status">Mağaza özeti yükleniyor…</div>');
  try {
    const data = await req('/dashboard');
    if (!isCurrent(generation)) return;
    shell(`<div class="row between"><div><div class="small" style="color:var(--deep)">BarBer Tedarikçi</div><h1 class="head">${esc(data.storeName || 'Mağazam')}</h1></div><button class="back" aria-label="Mağaza özetini yenile" onclick="draw()">${icon('refresh')}</button></div>
      <div class="success row">${icon('check')}<span class="grow">Mağazanız yayında</span><span>Onaylı</span></div>
      ${data.lowStockCount ? `<div class="warning row">${icon('warning')}<span>${Number(data.lowStockCount)} ürünün stoğu azaldı</span></div>` : ''}
      <button class="btn outline full" onclick="openPage('reports')">${icon('chart')}<span>Satış raporları</span></button>
      <div class="metricgrid">${metric('Ürün', data.productCount, 'products')}${metric('Sipariş', data.orderCount, 'orders')}${metric('Düşük stok', data.lowStockCount, 'warning')}${metric('Toplam satış', money(data.totalSales), 'money')}</div>
      <h2 class="section">Son siparişler</h2>${(data.latestOrders || []).map(orderCard).join('') || emptyState('Henüz sipariş bulunmuyor.')}`);
  } catch (error) { showPageError(error, generation); }
}
function productPage() {
  shell(`<div class="row between"><div><h1 class="head">Ürünlerim</h1><div class="sub">${products.length} ürün kataloğunuzda</div></div><button class="btn" onclick="productModal()">${icon('plus')}<span>Ekle</span></button></div>
    ${searchField('pSearch', 'Ürün adı, kod veya kategori ara', searchText.products, 'updateProductQuery')}
    <div class="filters" aria-label="Ürün filtreleri">${['Tümü', 'Aktif', 'Pasif', 'Düşük stok'].map(value => `<button class="${filters.products === value ? 'sel' : ''}" aria-pressed="${filters.products === value}" onclick="setProductFilter('${value}')">${value}</button>`).join('')}</div><div id="productList"></div>`);
  drawProducts();
}
function updateProductQuery(value) { searchText.products = value; drawProducts(); }
function setProductFilter(value) { filters.products = value; productPage(); }
function matchesProduct(product) {
  const query = searchText.products.toLocaleLowerCase('tr-TR');
  return (product.name + product.sku + product.category).toLocaleLowerCase('tr-TR').includes(query)
    && (filters.products === 'Tümü' || filters.products === 'Aktif' && product.active || filters.products === 'Pasif' && !product.active || filters.products === 'Düşük stok' && product.stock < 10);
}
function drawProducts() {
  $('#productList').innerHTML = products.filter(matchesProduct).map(product => `<article class="item"><div class="tile">${icon('scissors')}</div><div class="grow"><div class="title">${esc(product.name)}</div><div class="small">${esc(product.category)} · ${esc(product.sku)}</div><div class="price">${money(product.price)} · Stok: ${product.stock}</div><div class="actions"><button onclick="productModal('${product.id}')">Düzenle</button><button onclick="toggleProduct('${product.id}',this)">${product.active ? 'Pasife al' : 'Yayına al'}</button></div></div><span class="pill ${product.active ? 'ok' : ''}">${product.active ? 'Aktif' : 'Pasif'}</span></article>`).join('') || emptyState('Eşleşen ürün bulunamadı.');
}
async function toggleProduct(id, button) {
  const product = products.find(value => value.id === id);
  if (!product) return;
  if (button) button.disabled = true;
  try { await req('/products/' + id + '/active', 'PATCH', { active: !product.active }); await loadAll(); draw(); }
  catch (error) { alert(error.message); if (button) button.disabled = false; }
}
async function submitForm(form, action) {
  const button = form.querySelector('button[type="submit"]');
  const errorBox = form.querySelector('.form-error');
  if (button) button.disabled = true;
  if (errorBox) errorBox.textContent = '';
  try { await action(); }
  catch (error) { if (errorBox) errorBox.textContent = error.message || 'İşlem tamamlanamadı.'; }
  finally { if (button && form.isConnected) button.disabled = false; }
}
function productModal(id) {
  const product = products.find(value => value.id === id) || {};
  modal(`<h2>${id ? 'Ürünü düzenle' : 'Yeni ürün'}</h2><form id="productForm">
    ${input('Ürün adı', 'name', 'text', product.name || '', 'required maxlength="150"')}
    ${input('Kategori', 'category', 'text', product.category || '', 'required maxlength="100"')}
    ${input('Stok kodu (SKU)', 'sku', 'text', product.sku || '', 'required maxlength="80"')}
    <div class="grid2"><label class="form-label">Salon satış fiyatı${input('Salon satış fiyatı', 'price', 'number', product.price ?? '', 'required min="0" step="0.01"')}</label><label class="form-label">Stok adedi${input('Stok adedi', 'stock', 'number', product.stock ?? '', 'required min="0" step="1"')}</label></div>
    <textarea class="field" name="description" aria-label="Ürün açıklaması" placeholder="Ürün açıklaması" maxlength="1000">${esc(product.description || '')}</textarea>
    <div class="form-error" role="alert"></div><div class="sheetfoot"><button type="button" class="btn outline" onclick="closeModal()">Vazgeç</button><button type="submit" class="btn">Değişiklikleri kaydet</button></div></form>`, id ? 'Ürünü düzenle' : 'Yeni ürün');
  $('#productForm').onsubmit = event => {
    event.preventDefault();
    submitForm(event.target, async () => {
      const values = Object.fromEntries(new FormData(event.target));
      values.price = Number(values.price); values.stock = Number(values.stock);
      await req('/products' + (id ? '/' + id : ''), id ? 'PUT' : 'POST', values);
      await loadAll(); closeModal(); draw();
    });
  };
}
function orderCard(order) {
  return `<button type="button" class="item order-card" aria-label="${esc(order.id)} sipariş detayını aç" onclick="selectedOrder='${order.id}';openPage('order')"><div class="grow"><div class="row between"><div class="title">${esc(order.id)}</div>${status(order.status)}</div><div class="small">${esc(order.date)} · ${esc(order.salon)}</div><div class="price row"><span>${money(order.total)}</span>${icon('chevron')}</div></div></button>`;
}
function orderPageList() {
  shell(`<h1 class="head">Salon siparişleri</h1>${searchField('oSearch', 'Sipariş no veya salon ara', searchText.orders, 'updateOrderQuery')}
    <div class="filters" aria-label="Sipariş filtreleri">${['Tümü', 'Bekliyor', 'Onaylı', 'Hazırlanıyor', 'Teslim edildi'].map(value => `<button class="${filters.orders === value ? 'sel' : ''}" aria-pressed="${filters.orders === value}" onclick="setOrderFilter('${value}')">${value}</button>`).join('')}</div><div id="orderList"></div>`);
  drawOrders();
}
function updateOrderQuery(value) { searchText.orders = value; drawOrders(); }
function setOrderFilter(value) { filters.orders = value; orderPageList(); }
function matchesOrder(order) {
  return (order.id + order.salon).toLocaleLowerCase('tr-TR').includes(searchText.orders.toLocaleLowerCase('tr-TR'))
    && (filters.orders === 'Tümü' || order.status === filters.orders || filters.orders === 'Onaylı' && order.status === 'Onaylandı');
}
function drawOrders() { $('#orderList').innerHTML = orders.filter(matchesOrder).map(orderCard).join('') || emptyState('Bu arama ve filtreye uygun sipariş bulunamadı.'); }
function orderPage() {
  const order = orders.find(value => value.id === selectedOrder);
  if (!order) { page = ''; orderPageList(); return; }
  shell(`${pageHeader(order.id)}<article class="card"><div class="row between"><span class="small">${esc(order.date)}</span>${status(order.status)}</div><hr class="line"><b>Salon bilgileri</b><p>${esc(order.salon)}</p><div class="small">Telefon: ${esc(order.phone)}</div><div class="small">Adres: ${esc(order.address)}</div><hr class="line"><b>Sevkiyat ve notlar</b><p class="small">${esc(order.note || 'Teslimat notu bulunmuyor.')}</p></article>
    <article class="card"><b>Sipariş edilen ürünler</b>${order.lines.map(line => `<div class="row between" style="margin-top:13px"><div class="grow">${esc(line.name)}<div class="small">${line.quantity} adet</div></div><b>${money(line.unitPrice * line.quantity)}</b></div>`).join('')}<hr class="line"><div class="row between"><b>Toplam</b><b>${money(order.total)}</b></div></article>`);
}
function adPage() {
  const promotable = products.filter(product => product.active);
  shell(`<h1 class="head">Reklam ve öne çıkarma</h1><article class="card"><div class="row between"><b class="row">${icon('sparkle')}<span>Salon ekranı önizlemesi</span></b><span class="pill">Sponsorlu</span></div><div class="tile" style="margin-top:15px">${icon('scissors')}</div><div class="title">${esc(promotable[0]?.name || 'Ürün tanıtımı')}</div><div class="small">Ürünlerinizi salonlara duyurun.</div></article>
    <button class="btn full" onclick="adModal()" ${promotable.length ? '' : 'disabled'}>${icon('ads')}<span>Reklam başvurusu oluştur</span></button>${promotable.length ? '' : '<p class="small">Başvuru için önce bir ürünü yayına alın.</p>'}
    <h2 class="section">Kampanyalarım</h2>${ads.map(ad => `<button type="button" class="item campaign-card" onclick="campaignModal('${ad.id}')" aria-label="${esc(ad.title)} kampanya detayını aç"><div class="grow"><div class="row between"><b class="grow">${esc(ad.title)}</b>${status(ad.status)}</div><div class="small">${esc(ad.scope)} · ${money(ad.budget)}</div><div class="price">${esc(ad.productName)}</div></div>${icon('chevron')}</button>`).join('') || emptyState('Henüz kampanya başvurusu bulunmuyor.')}`);
}
function adModal() {
  const promotable = products.filter(product => product.active);
  if (!promotable.length) return;
  modal(`<h2>Reklam başvurusu</h2><form id="adForm"><input type="hidden" name="scope" value="Tek ürün"><div class="filters" aria-label="Reklam kapsamı">
    ${['Tüm ürünler', 'Tek ürün'].map(value => `<button type="button" class="${value === 'Tek ürün' ? 'sel' : ''}" onclick="setAdScope('${value}')">${value}</button>`).join('')}</div>
    <label class="form-label" id="adProductLabel">Öne çıkarılacak ürün<select class="field" name="productId" aria-label="Öne çıkarılacak ürün" onchange="updateAdPreview()">${promotable.map(product => `<option value="${product.id}">${esc(product.name)}</option>`).join('')}</select></label>
    ${input('Kampanya başlığı', 'title', 'text', '', 'required maxlength="100" oninput="updateAdPreview()"')}
    <textarea class="field" name="note" aria-label="Önizleme notu" placeholder="Önizleme notu" maxlength="500" oninput="updateAdPreview()"></textarea>
    <div class="card" id="adPreview" aria-live="polite"></div>
    <label class="form-label">Talep edilen aylık bütçe${input('Aylık bütçe', 'budget', 'number', 150, 'required min="1" step="0.01"')}</label>
    <div class="form-error" role="alert"></div><div class="sheetfoot"><button type="button" class="btn outline" onclick="closeModal()">Vazgeç</button><button type="submit" class="btn">Başvuruyu gönder</button></div></form>`, 'Reklam başvurusu');
  updateAdPreview();
  $('#adForm').onsubmit = event => {
    event.preventDefault();
    submitForm(event.target, async () => {
      const values = Object.fromEntries(new FormData(event.target));
      values.budget = Number(values.budget);
      await req('/ads', 'POST', values); await loadAll(); closeModal(); draw();
    });
  };
}
function setAdScope(value) {
  const form = $('#adForm');
  form.elements.scope.value = value;
  form.querySelectorAll('.filters button').forEach(button => button.classList.toggle('sel', button.textContent === value));
  $('#adProductLabel').classList.toggle('hide', value === 'Tüm ürünler');
  updateAdPreview();
}
function updateAdPreview() {
  const form = $('#adForm');
  const product = products.find(value => value.id === form.elements.productId.value);
  const all = form.elements.scope.value === 'Tüm ürünler';
  $('#adPreview').innerHTML = `<div class="row between"><b class="row">${icon('sparkle')}<span>Önizleme</span></b><span class="pill">Sponsorlu</span></div><p class="title">${esc(form.elements.title.value || (all ? 'Tüm ürün kataloğumuz' : product?.name || 'Ürün tanıtımı'))}</p><p class="small">${esc(form.elements.note.value || (all ? 'Kataloğunuzdaki tüm ürünler öne çıkarılır.' : product?.name || ''))}</p>${all ? '' : `<div class="price">${money(product?.price || 0)}</div>`}`;
}
function campaignModal(id) {
  const ad = ads.find(value => value.id === id);
  if (!ad) return;
  modal(`<h2>${esc(ad.title)}</h2><p>${status(ad.status)}</p><div class="card"><div class="small">Kapsam</div><p>${esc(ad.scope)}</p><div class="small">Ürün</div><p>${esc(ad.scope === 'Tüm ürünler' ? 'Tüm ürün kataloğu' : ad.productName)}</p><div class="small">Aylık bütçe</div><p>${money(ad.budget)}</p><div class="small">Önizleme notu</div><p>${esc(ad.note || 'Not eklenmemiş.')}</p></div><button type="button" class="btn outline full" onclick="closeModal()">Kapat</button>`, 'Kampanya detayı');
}
function accountPage() {
  shell(`<h1 class="head">Hesabım</h1><article class="card"><div class="row"><div class="tile">${icon('account')}</div><div class="grow"><div class="title">${esc(profile.companyName || 'Firma bilgileri')}</div><div class="small">${esc(profile.email || '')}</div></div></div><p class="small">Firma ve iletişim bilgilerinizi yönetin.</p><button class="btn outline full" onclick="profileModal()">${icon('account')}<span>Firma bilgileri</span></button></article>
    <button class="item menu-row" onclick="openPage('settlements')"><span class="tile">${icon('orders')}</span><b class="grow">Hakediş ve faturalar</b>${icon('chevron')}</button>
    <button class="item menu-row" onclick="openPage('reports')"><span class="tile">${icon('chart')}</span><b class="grow">Satış raporları</b>${icon('chevron')}</button>
    <button class="btn outline full" onclick="logout()">Çıkış yap</button>`);
}
function profileModal() {
  const fields = [['companyName', 'Şirket unvanı'], ['contactPerson', 'Yetkili kişi'], ['phone', 'Telefon'], ['taxNumber', 'Vergi numarası'], ['taxOffice', 'Vergi dairesi'], ['city', 'Şehir'], ['address', 'Firma adresi']];
  modal(`<h2>Firma bilgileri</h2><form id="profileForm">${fields.map(([key, label]) => input(label, key, key === 'phone' ? 'tel' : 'text', profile[key] || '', `maxlength="500" ${key === 'companyName' ? 'required' : ''}`)).join('')}<div class="form-error" role="alert"></div><div class="sheetfoot"><button type="button" class="btn outline" onclick="closeModal()">Vazgeç</button><button type="submit" class="btn">Kaydet</button></div></form>`, 'Firma bilgileri');
  $('#profileForm').onsubmit = event => {
    event.preventDefault();
    submitForm(event.target, async () => { profile = await req('/profile', 'PUT', Object.fromEntries(new FormData(event.target))); closeModal(); draw(); });
  };
}
async function reportPage() {
  const generation = viewGeneration;
  shell(`${pageHeader('Satış raporları')}<div class="loading-state" role="status">Rapor hazırlanıyor…</div>`);
  try {
    const data = await req('/reports?days=' + days);
    if (!isCurrent(generation)) return;
    const max = Math.max(0, ...data.dailySales.map(value => Number(value.value)));
    const chart = max > 0 ? `<div class="chart">${data.dailySales.map(value => `<div class="chartcol"><div class="chartbar" style="height:${Math.max(0, value.value / max * 95)}px"></div><span>${esc(value.label)}</span></div>`).join('')}</div>` : '<div class="chart-empty">Seçili dönemde satış bulunmuyor.</div>';
    shell(`${pageHeader('Satış raporları')}<div class="filters" aria-label="Rapor dönemi">${[7, 30, 90].map(value => `<button class="${days === value ? 'sel' : ''}" onclick="days=${value};draw()">Son ${value} gün</button>`).join('')}</div>
      <div class="metricgrid">${metric('Ciro', money(data.revenue), 'money')}${metric('Sipariş', data.orderCount, 'orders')}</div>${metric('Ortalama sepet', money(data.averageBasket), 'products')}
      <h2 class="section">Günlük satış</h2>${chart}<h2 class="section">En çok satan ürünler</h2>${data.topProducts.map(product => `<div class="item"><div class="grow"><div class="title">${esc(product.name)}</div><div class="small">${product.quantity} adet</div></div><b>${money(product.revenue)}</b></div>`).join('') || emptyState('Bu dönemde satılan ürün yok.')}`);
  } catch (error) { showPageError(error, generation); }
}
async function settlementPage() {
  const generation = viewGeneration;
  shell(`${pageHeader('Hakediş ve faturalar')}<div class="loading-state" role="status">Kayıtlar yükleniyor…</div>`);
  try {
    const data = await req('/settlements');
    if (!isCurrent(generation)) return;
    shell(`${pageHeader('Hakediş ve faturalar')}<div class="metricgrid">${metric('Bekleyen', money(data.pending), 'money')}${metric('Ödenen', money(data.paid), 'check')}</div>${metric('Toplam komisyon', money(data.commission), 'orders')}
      <h2 class="section">Faturalar</h2>${data.invoices.map(invoice => `<div class="item"><div class="grow"><b>${esc(invoice.id)}</b><div class="small">${esc(invoice.date)}</div></div><div>${money(invoice.net)}<div style="margin-top:5px">${status(invoice.status)}</div></div></div>`).join('') || emptyState('Fatura kaydı bulunamadı.')}`);
  } catch (error) { showPageError(error, generation); }
}
function modal(content, title = 'İşlem') {
  closeModal();
  root.insertAdjacentHTML('beforeend', `<div class="modal" id="modal" onclick="if(event.target===this)closeModal()"><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">${content}</section></div>`);
  document.body.style.overflow = 'hidden';
}
function closeModal() { $('#modal')?.remove(); document.body.style.overflow = ''; }
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
