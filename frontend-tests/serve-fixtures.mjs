// Loopback-only visual test fixture. This server is never packaged in the Android app or backend.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

const assets=resolve('app/src/main/assets');
const products=[
  {id:'p1',name:'Profesyonel Berber Kesim Makası 6.0',category:'Makas',sku:'MAK-060',price:1850,stock:4,description:'Arayüz testi örnek ürünü.',active:true},
  {id:'p2',name:'Kablosuz Ense & Sakal Kesme Makinesi',category:'Makine',sku:'MAK-020',price:4900,stock:3,description:'Arayüz testi örnek ürünü.',active:true},
  {id:'p3',name:'Matte Clay Güçlü Tutuş Wax 150ml',category:'Bakım',sku:'WAX-150',price:310,stock:12,description:'Arayüz testi örnek ürünü.',active:true}
];
const orders=[
  {id:'BT-QA-001',date:'20.10.2026 12:00',salon:'Örnek Salon Kadıköy',phone:'000 000 00 00',address:'Test adresi',status:'Bekliyor',total:3700,lines:[{name:products[0].name,quantity:2,unitPrice:1850}],note:'Arayüz test verisi'},
  {id:'BT-QA-002',date:'19.10.2026 12:00',salon:'Örnek Salon Nişantaşı',phone:'000 000 00 00',address:'Test adresi',status:'Hazırlanıyor',total:4900,lines:[{name:products[1].name,quantity:1,unitPrice:4900}],note:''},
  {id:'BT-QA-003',date:'08.10.2026 12:00',salon:'Örnek Salon Beşiktaş',phone:'000 000 00 00',address:'Test adresi',status:'Teslim edildi',total:1240,lines:[{name:products[2].name,quantity:4,unitPrice:310}],note:''}
];
const ads=[{id:'ad1',title:'Örnek kampanya',productName:products[1].name,productId:'p2',scope:'Tek ürün',budget:150,status:'İncelemede',note:'Yalnızca arayüz testi.'}];
const profile={companyName:'Arayüz kontrolü (test verisi)',email:'ui-test@example.invalid',contactPerson:'Test kullanıcısı',phone:'',taxOffice:'',taxNumber:'',city:'',address:''};
const session={token:'ui-fixture-access',refreshToken:'ui-fixture-refresh',expiresIn:3600,verificationRequired:false};
function report(days){
  const today=new Date('2026-10-20T12:00:00Z');
  const daily=Array.from({length:days},(_,i)=>{const d=new Date(today);d.setUTCDate(d.getUTCDate()-(days-i-1));return {date:d.toISOString().slice(0,10),label:d.toISOString().slice(5,10).split('-').reverse().join('.'),value:0};});
  const selected=orders.filter(order=>{const [d,m,y]=order.date.slice(0,10).split('.');const row=daily.find(r=>r.date===`${y}-${m}-${d}`);if(row)row.value+=order.total;return !!row;});
  const revenue=selected.reduce((s,o)=>s+o.total,0);
  const top=new Map();
  for(const order of selected)for(const line of order.lines){const p=top.get(line.name)||{name:line.name,quantity:0,revenue:0};p.quantity+=line.quantity;p.revenue+=line.quantity*line.unitPrice;top.set(line.name,p);}
  return {days,revenue,orderCount:selected.length,averageBasket:selected.length?revenue/selected.length:0,dailySales:daily,topProducts:[...top.values()].sort((a,b)=>b.revenue-a.revenue)};
}
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  if(!url.pathname.startsWith('/api/')){
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(!['index.html','styles.css','icons.js','app.js','auth.js'].includes(name)){res.writeHead(404);res.end();return;}
    const ext=name.split('.').pop();res.writeHead(200,{'Content-Type':({html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript'})[ext],'Cache-Control':'no-store'});res.end(await readFile(resolve(assets,name)));return;
  }
  let text='';for await(const chunk of req)text+=chunk;
  let body={};try{body=text?JSON.parse(text):{};}catch{return send(400,{message:'Invalid fixture JSON'});}
  const path=url.pathname.slice(4),method=req.method;
  if(path==='/auth/config')return send(200,{provider:'supabase',configured:true,testFixture:true});
  if(path==='/auth/login')return body.email==='ui-test@example.invalid'&&body.password==='ui-fixture-pass'?send(200,session):send(401,{message:'Use the documented visual-fixture login.'});
  if(path==='/auth/refresh')return send(200,session);
  if(req.headers.authorization!=='Bearer '+session.token)return send(401,{message:'Fixture authentication required'});
  if(path==='/auth/logout')return send(200,{ok:true});
  if(path==='/auth/session')return send(200,{id:'ui-fixture-user',email:profile.email});
  if(path==='/dashboard')return send(200,{storeName:profile.companyName,published:true,productCount:products.length,orderCount:orders.length,lowStockCount:products.filter(p=>p.stock<10).length,totalSales:orders.reduce((s,o)=>s+o.total,0),latestOrders:orders});
  if(path==='/products'&&method==='GET')return send(200,products);
  if(path==='/products'&&method==='POST'){const p={...body,id:randomUUID(),active:true};products.unshift(p);return send(200,p);}
  if(path.startsWith('/products/')){const p=products.find(p=>p.id===path.split('/')[2]);if(!p)return send(404,{});Object.assign(p,body);return send(200,p);}
  if(path==='/orders')return send(200,orders);
  if(path==='/ads'&&method==='GET')return send(200,ads);
  if(path==='/ads'&&method==='POST'){const p=products.find(p=>p.id===body.productId);const ad={...body,id:randomUUID(),productName:p.name,status:'İncelemede'};ads.unshift(ad);return send(200,ad);}
  if(path==='/profile'){if(method==='PUT')Object.assign(profile,body);return send(200,profile);}
  if(path==='/reports')return send(200,report(Number(url.searchParams.get('days'))||30));
  if(path==='/settlements')return send(200,{pending:8462.4,paid:0,commission:1377.6,invoices:[{id:'QA-INVOICE',date:'20.10.2026',net:8462.4,status:'Bekliyor'}]});
  return send(404,{message:'No fixture for this route'});
}).listen(8081,'127.0.0.1',()=>console.log('UI fixture: http://localhost:8081 · ui-test@example.invalid / ui-fixture-pass · test data only'));
