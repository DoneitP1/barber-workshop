const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(fetch) {
  const context = vm.createContext({ fetch, console, setTimeout: () => 1, clearTimeout: () => {}, document: {}, URLSearchParams,
    location: {hash:'',pathname:'/',search:''}, history: {replaceState: () => {}} });
  vm.runInContext(`let token='old-access', products=[{private:true}], orders=[{private:true}], ads=[], profile={private:true}, tab='Özet', page='';
    const API='/api'; let draws=0; function draw(){draws++};`, context);
  const source = fs.readFileSync('app/src/main/assets/auth.js', 'utf8').replace(/\nboot\(\);\s*$/, '\n');
  vm.runInContext(source, context);
  vm.runInContext("refreshToken='old-refresh'; tokenExpiresAt=Date.now()+3600000;", context);
  return context;
}
function response(status, data) { return { ok: status < 400, status, json: async () => data }; }

test('concurrent unauthorized requests share a single Supabase refresh and retry with the new token', async () => {
  let refreshes = 0;
  const context = setup(async (path, options) => {
    if (path === '/api/auth/refresh') {
      refreshes++;
      assert.equal(JSON.parse(options.body).refreshToken, 'old-refresh');
      await new Promise(setImmediate);
      return response(200, { token: 'new-access', refreshToken: 'new-refresh', expiresIn: 3600 });
    }
    if (options.headers.Authorization === 'Bearer old-access') return response(401, { message: 'expired' });
    assert.equal(options.headers.Authorization, 'Bearer new-access');
    return response(200, { protected: true });
  });
  const results = await vm.runInContext("Promise.all([req('/products'),req('/orders')])", context);
  assert.equal(refreshes, 1);
  assert.equal(results[0].protected, true);
  assert.equal(vm.runInContext('refreshToken', context), 'new-refresh');
});

test('a rejected refresh clears private screen data and requires a fresh login', async () => {
  const context = setup(async () => response(401, { message: 'revoked' }));
  await assert.rejects(vm.runInContext("req('/products')", context), /revoked/);
  assert.equal(vm.runInContext('token', context), '');
  assert.equal(vm.runInContext('refreshToken', context), '');
  assert.equal(vm.runInContext('products.length+orders.length', context), 0);
  assert.equal(vm.runInContext('Object.keys(profile).length', context), 0);
  assert.equal(vm.runInContext('draws', context), 1);
});

test('logout clears private local state even when the network is unavailable', async () => {
  const context = setup(async () => { throw new Error('offline'); });
  await vm.runInContext('logout()', context);
  assert.equal(vm.runInContext('token+refreshToken', context), '');
  assert.equal(vm.runInContext('products.length', context), 0);
});

test('an unverified email callback token cannot open the panel', async () => {
  const context = setup(async path => path === '/api/auth/config'
    ? response(200, {provider:'supabase',configured:true}) : response(401, {message:'bad token'}));
  vm.runInContext("location.hash='#access_token=forged&refresh_token=forged&type=signup';", context);
  await vm.runInContext('boot()', context);
  assert.equal(vm.runInContext('token', context), '');
  assert.equal(vm.runInContext('refreshToken', context), '');
});
