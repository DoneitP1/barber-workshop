const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(request = async () => ({})) {
  const elements = new Map();
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, {innerHTML:'',style:{},remove(){},classList:{toggle(){}}});
    return elements.get(selector);
  };
  const context = vm.createContext({location:{hostname:'localhost'},document:{querySelector:get,body:{style:{}},addEventListener(){}}, req:request, console});
  vm.runInContext('let sessionEpoch=1; function auth(){};',context);
  vm.runInContext(fs.readFileSync('app/src/main/assets/icons.js','utf8'),context);
  vm.runInContext(fs.readFileSync('app/src/main/assets/app.js','utf8'),context);
  vm.runInContext("token='fixture';",context);
  return {context,elements,get};
}
test('navigation has separate icon and complete label containers in every state',()=>{
  const {context}=setup();
  for(const name of ['Özet','Ürünler','Siparişler','Reklam','Hesabım']) {
    const html=vm.runInContext(`tab=${JSON.stringify(name)};nav()`,context);
    assert.equal((html.match(/class="nav-label"/g)||[]).length,5);
    assert.match(html,/<span class="nav-icon"><svg/);
    assert.ok(html.includes(`class="nav-label">${name}</span>`));
  }
});
test('search remains active when product filter changes and prices retain cents',()=>{
  const {context,get}=setup();
  vm.runInContext("products=[{id:'p1',name:'Wax',category:'Bakım',sku:'WX',stock:5,price:12.5,active:true}];searchText.products='Wax';setProductFilter('Düşük stok');",context);
  assert.match(get('#root').innerHTML,/value="Wax"/);
  assert.match(get('#productList').innerHTML,/Wax/);
  assert.match(vm.runInContext('money(12.5)',context),/12,50/);
});
test('ad preview uses the selected product and escapes the saved note',()=>{
  const {context,get}=setup();
  get('#adForm').elements={productId:{value:'p2'},scope:{value:'Tek ürün'},title:{value:''},note:{value:'<script>example</script>'}};
  vm.runInContext("products=[{id:'p1',name:'First product',price:10},{id:'p2',name:'Chosen product',price:4900}];updateAdPreview();",context);
  assert.match(get('#adPreview').innerHTML,/Chosen product/);
  assert.doesNotMatch(get('#adPreview').innerHTML,/First product/);
  assert.match(get('#adPreview').innerHTML,/&lt;script&gt;/);
});
test('late dashboard responses cannot replace a newly selected screen',async()=>{
  let resolve;
  const {context,get}=setup(()=>new Promise(done=>{resolve=done}));
  const pending=vm.runInContext('dashboard()',context);
  vm.runInContext("go('Ürünler')",context);
  resolve({storeName:'Old response',latestOrders:[]});
  await pending;
  assert.match(get('#root').innerHTML,/Ürünlerim/);
  assert.doesNotMatch(get('#root').innerHTML,/Old response/);
});
test('settlement request failures provide a retry screen',async()=>{
  const {context,get}=setup(async()=>{throw Error('Connection unavailable')});
  await vm.runInContext('settlementPage()',context);
  assert.match(get('#root').innerHTML,/Connection unavailable/);
  assert.match(get('#root').innerHTML,/Tekrar dene/);
});
