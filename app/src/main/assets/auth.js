// Supabase sessions stay in memory. No password, access token or refresh token is written to Web Storage.
let registering = false;
let authConfigured = false;
let authNotice = '';
let refreshToken = '';
let tokenExpiresAt = 0;
let refreshTimer;
let refreshPending;
let sessionEpoch = 0;
let callbackSession;

async function rawRequest(path, method = 'GET', body) {
  const response = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'İstek tamamlanamadı (' + response.status + ').');
    error.status = response.status;
    throw error;
  }
  return data;
}

async function req(path, method = 'GET', body) {
  const needsAuth = !path.startsWith('/auth/') && path !== '/health';
  if (needsAuth && token && Date.now() >= tokenExpiresAt - 30000) await renewSession();
  try { return await rawRequest(path, method, body); }
  catch (error) {
    if (error.status === 401 && needsAuth && refreshToken) {
      await renewSession();
      try { return await rawRequest(path, method, body); }
      catch (retryError) {
        if (retryError.status === 401) clearSession('Oturumunuz sona erdi. Tekrar giriş yapın.');
        throw retryError;
      }
    }
    if (error.status === 401 && needsAuth) clearSession('Devam etmek için tekrar giriş yapın.');
    throw error;
  }
}

function adoptSession(session) {
  if (typeof session.token !== 'string' || !session.token || !session.refreshToken || !Number.isFinite(session.expiresIn) || !(session.expiresIn > 0))
    throw new Error('Geçerli bir Supabase oturumu alınamadı.');
  token = session.token;
  refreshToken = session.refreshToken;
  tokenExpiresAt = Date.now() + session.expiresIn * 1000;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => renewSession().catch(() => {}), Math.max(1000, session.expiresIn * 1000 - 60000));
}

async function renewSession() {
  if (refreshPending) return refreshPending;
  if (!refreshToken) throw new Error('Tekrar giriş yapın.');
  const epoch = sessionEpoch;
  refreshPending = rawRequest('/auth/refresh', 'POST', { refreshToken })
    .then(data => { if (epoch === sessionEpoch) adoptSession(data); })
    .catch(error => {
      if (epoch === sessionEpoch) clearSession('Oturumunuz yenilenemedi. Tekrar giriş yapın.');
      throw error;
    })
    .finally(() => { refreshPending = undefined; });
  return refreshPending;
}

function auth() {
  root.innerHTML = `<main class="wrap"><section class="brand"><div class="logo">B</div>
    <h1>Tedarikçi paneli</h1><p>Ürünlerinizi yayınlayın, salon siparişlerini yönetin ve reklamlarla öne çıkın.</p>
    </section><div class="pad"><div class="tabswitch">
    <button id="loginTab" class="sel" onclick="authMode(false)">↪ Giriş yap</button>
    <button id="regTab" onclick="authMode(true)">Kayıt ol</button></div>
    <form id="authForm" class="card"><h2 id="authTitle" style="margin:2px 0 10px">Tekrar hoş geldiniz</h2>
    <div id="regFields" class="hide">
      ${input('Firma unvanı', 'companyName')}${input('Yetkili kişi', 'contactPerson')}${input('Telefon', 'phone', 'tel')}
      <div class="grid2">${input('Vergi dairesi', 'taxOffice')}${input('Vergi numarası', 'taxNumber')}</div>
    </div>
    ${input('E-posta', 'email', 'email', '', 'autocomplete="username" required maxlength="254"')}
    ${input('Şifre', 'password', 'password', '', 'autocomplete="current-password" required maxlength="128"')}
    <div id="agreeRow" class="hide"><label class="small"><input type="checkbox" name="agree">
      Kullanım koşullarını ve tedarikçi sözleşmesini kabul ediyorum.</label></div>
    <div id="authInfo" class="small" role="status" style="line-height:1.6;color:var(--green)">${esc(authNotice)}</div>
    <div id="authError" class="error" role="alert"></div>
    <button class="btn full" id="authSubmit" ${authConfigured ? '' : 'disabled'}>Giriş yap</button>
    <button type="button" class="btn outline full" onclick="recoverPassword()" ${authConfigured ? '' : 'disabled'}>Şifremi unuttum</button>
    </form><p class="tiny">${authConfigured ? 'Güvenli hesap ve oturum yönetimi.' : 'Giriş sistemi kurulumu tamamlandığında hesabınızla giriş yapabilirsiniz.'}</p>
    </div></main>`;
  registering = false;
  $('#authForm').onsubmit = doAuth;
}

function authMode(value) {
  registering = value;
  $('#loginTab').classList.toggle('sel', !value);
  $('#regTab').classList.toggle('sel', value);
  $('#regFields').classList.toggle('hide', !value);
  $('#agreeRow').classList.toggle('hide', !value);
  $('#regFields').querySelectorAll('input').forEach(field => { field.required = value; });
  $('#authForm').elements.password.autocomplete = value ? 'new-password' : 'current-password';
  $('#authForm').elements.password.minLength = value ? 8 : 1;
  $('#authTitle').textContent = value ? 'Firma bilgileri' : 'Tekrar hoş geldiniz';
  $('#authSubmit').textContent = value ? 'Hesap oluştur ve başvur' : 'Giriş yap';
  $('#authError').textContent = '';
}

async function doAuth(event) {
  event.preventDefault();
  if (!authConfigured) return;
  const values = Object.fromEntries(new FormData(event.target));
  if (registering && !values.agree) { $('#authError').textContent = 'Devam etmek için sözleşmeyi kabul edin.'; return; }
  delete values.agree;
  const button = $('#authSubmit');
  button.disabled = true;
  button.textContent = 'Bağlanıyor…';
  $('#authError').textContent = '';
  try {
    const data = await rawRequest(registering ? '/auth/register' : '/auth/login', 'POST', values);
    if (data.verificationRequired) {
      authMode(false);
      $('#authInfo').textContent = data.message;
      return;
    }
    sessionEpoch++;
    adoptSession(data);
    authNotice = '';
    await loadAll();
    go('Özet');
  } catch (error) {
    if ($('#authError')) $('#authError').textContent = error.message || 'Bağlantı kurulamadı.';
  } finally {
    if ($('#authSubmit')) {
      $('#authSubmit').disabled = !authConfigured;
      $('#authSubmit').textContent = registering ? 'Hesap oluştur ve başvur' : 'Giriş yap';
    }
  }
}

function clearSession(message = '') {
  sessionEpoch++;
  clearTimeout(refreshTimer);
  token = ''; refreshToken = ''; tokenExpiresAt = 0;
  callbackSession = undefined;
  tab = 'Özet'; page = ''; products = []; orders = []; ads = []; profile = {};
  if (typeof searchText !== 'undefined') searchText = { products: '', orders: '' };
  authNotice = message;
  draw();
}

async function logout() {
  const request = token ? rawRequest('/auth/logout', 'POST') : Promise.resolve();
  clearSession();
  await request.catch(() => {});
}

async function recoverPassword() {
  const field = $('#authForm').elements.email;
  if (!field.value || !field.checkValidity()) { field.reportValidity(); return; }
  try {
    const result = await rawRequest('/auth/recover', 'POST', { email: field.value });
    $('#authInfo').textContent = result.message;
  } catch (error) { $('#authError').textContent = error.message; }
}

function passwordSetup(email) {
  root.innerHTML = `<main class="wrap"><div class="pad"><div class="brand"><div class="logo">B</div>
    <h1>Şifrenizi belirleyin</h1><p>${esc(email)}</p></div><form class="card" id="passwordForm">
    ${input('Yeni şifre', 'password', 'password', '', 'autocomplete="new-password" minlength="8" maxlength="128" required')}
    ${input('Şifre tekrar', 'confirmation', 'password', '', 'autocomplete="new-password" minlength="8" maxlength="128" required')}
    <div id="passwordError" class="error" role="alert"></div><button class="btn full">Şifreyi kaydet</button>
    </form></div></main>`;
  $('#passwordForm').onsubmit = async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    if (values.password !== values.confirmation) { $('#passwordError').textContent = 'Şifreler eşleşmiyor.'; return; }
    const button = event.target.querySelector('button'); button.disabled = true;
    try {
      // The callback access token was authenticated by the backend before showing this form.
      await rawRequest('/auth/password', 'PUT', { password: values.password });
      adoptSession(callbackSession); callbackSession = undefined;
      await loadAll(); go('Özet');
    } catch (error) { $('#passwordError').textContent = error.message; button.disabled = false; }
  };
}

async function boot() {
  const callback = new URLSearchParams(location.hash.substring(1));
  // Remove bearer credentials from the address bar before loading anything else.
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  try {
    const configuration = await rawRequest('/auth/config');
    authConfigured = configuration.provider === 'supabase' && configuration.configured === true;
    if (authConfigured && callback.get('access_token') && callback.get('refresh_token')) {
      token = callback.get('access_token');
      const user = await rawRequest('/auth/session');
      const session = { token, refreshToken: callback.get('refresh_token'), expiresIn: Number(callback.get('expires_in')) || 3600 };
      sessionEpoch++;
      if (['invite', 'recovery'].includes(callback.get('type'))) {
        callbackSession = session; passwordSetup(user.email); return;
      }
      adoptSession(session); await loadAll(); go('Özet'); return;
    }
  } catch (error) {
    token = ''; refreshToken = ''; callbackSession = undefined;
    authNotice = callback.get('access_token') ? 'Doğrulama bağlantısı geçersiz veya süresi dolmuş. Tekrar giriş yapın.' : 'Giriş servisine ulaşılamadı. Tekrar deneyin.';
  }
  draw();
}
boot();
