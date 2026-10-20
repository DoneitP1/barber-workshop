package com.barberworkshop.api;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController @RequestMapping("/api") @CrossOrigin(origins = "https://appassets.androidplatform.net")
public class ApiController {
  private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();
  private final Map<String,User> users = new ConcurrentHashMap<>();
  private final Map<String,Session> sessions = new ConcurrentHashMap<>();
  private final Map<String,Shop> shops = new ConcurrentHashMap<>();
  public ApiController() { User u=new User(UUID.randomUUID().toString(),bcrypt.encode("demo123")); users.put("demo@barberworkshop.dev",u); Shop s=seed("Demo Barber Shop"); shops.put(u.id,s); }
  @PostMapping("/auth/login") public Map<String,Object> login(@RequestBody Map<String,String> body) {
    String email=body.getOrDefault("email","").trim().toLowerCase(Locale.ROOT); User u=users.get(email);
    if(u==null||!bcrypt.matches(body.getOrDefault("password",""),u.hash)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"E-posta veya şifre hatalı.");
    return issue(u,email);
  }
  @PostMapping("/auth/register") public Map<String,Object> register(@RequestBody Map<String,String> b) {
    for(String k:List.of("companyName","contactPerson","phone","email","password","taxOffice","taxNumber")) if(b.getOrDefault(k,"").isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Tüm alanları doldurun.");
    String email=b.get("email").trim().toLowerCase(Locale.ROOT); if(!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"E-posta adresi geçersiz.");
    if(b.get("password").length()<8||b.get("password").length()>72) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Şifre en az 8 karakter olmalı.");
    if(users.containsKey(email)) throw new ResponseStatusException(HttpStatus.CONFLICT,"E-posta zaten kayıtlı.");
    User u=new User(UUID.randomUUID().toString(),bcrypt.encode(b.get("password"))); users.put(email,u); Shop s=seed(b.get("companyName"));
    for(String k:List.of("companyName","contactPerson","phone","taxOffice","taxNumber")) s.profile.put(k,b.get(k));
    s.profile.put("email",email); shops.put(u.id,s); return issue(u,email);
  }
  @PostMapping("/auth/logout") public Map<String,Boolean> logout(@RequestHeader(value="Authorization",required=false) String h){if(h!=null)sessions.remove(h.replace("Bearer ",""));return Map.of("ok",true);}
  @GetMapping("/health") public Map<String,String> health(){return Map.of("status","ok","mode","demo-in-memory");}
  @GetMapping("/dashboard") public Map<String,Object> dashboard(@RequestHeader("Authorization") String h){Shop s=shop(h);double sales=s.orders.stream().mapToDouble(o->o.total).sum();return Map.of("storeName",s.profile.get("companyName"),"published",true,"productCount",s.products.size(),"orderCount",s.orders.size(),"lowStockCount",s.products.stream().filter(p->p.stock<10).count(),"totalSales",sales,"latestOrders",s.orders.subList(0,Math.min(3,s.orders.size())));}
  @GetMapping("/products") public List<Product> products(@RequestHeader("Authorization") String h){return shop(h).products;}
  @PostMapping("/products") public Product addProduct(@RequestHeader("Authorization") String h,@RequestBody Map<String,Object>b){Shop s=shop(h);Product p=product(UUID.randomUUID().toString(),b,true);s.products.add(0,p);return p;}
  @PutMapping("/products/{id}") public Product editProduct(@RequestHeader("Authorization") String h,@PathVariable String id,@RequestBody Map<String,Object>b){Shop s=shop(h);int i=index(s.products,id);Product old=s.products.get(i),p=product(id,b,old.active);s.products.set(i,p);return p;}
  @PatchMapping("/products/{id}/active") public Product active(@RequestHeader("Authorization") String h,@PathVariable String id,@RequestBody Map<String,Boolean>b){Shop s=shop(h);int i=index(s.products,id);Product x=s.products.get(i);Product p=new Product(x.id,x.name,x.category,x.sku,x.price,x.stock,x.description,b.getOrDefault("active",false));s.products.set(i,p);return p;}
  @GetMapping("/orders") public List<Order> orders(@RequestHeader("Authorization") String h){return shop(h).orders;}
  @GetMapping("/orders/{id}") public Order order(@RequestHeader("Authorization") String h,@PathVariable String id){return shop(h).orders.stream().filter(o->o.id.equals(id)).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));}
  @GetMapping("/ads") public List<Ad> ads(@RequestHeader("Authorization") String h){return shop(h).ads;}
  @PostMapping("/ads") public Ad addAd(@RequestHeader("Authorization") String h,@RequestBody Map<String,Object>b){Shop s=shop(h);String pid=String.valueOf(b.get("productId"));Product p=s.products.stream().filter(x->x.id.equals(pid)).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Ürün bulunamadı."));Ad a=new Ad(UUID.randomUUID().toString(),String.valueOf(b.get("title")),p.name,pid,String.valueOf(b.get("scope")),number(b.get("budget")),"İncelemede");s.ads.add(0,a);return a;}
  @GetMapping("/profile") public Map<String,String> profile(@RequestHeader("Authorization") String h){return shop(h).profile;}
  @PutMapping("/profile") public Map<String,String> editProfile(@RequestHeader("Authorization") String h,@RequestBody Map<String,String>b){Shop s=shop(h);for(String k:List.of("companyName","contactPerson","phone","taxOffice","taxNumber","city","address"))if(b.containsKey(k))s.profile.put(k,b.get(k));return s.profile;}
  @GetMapping("/settlements") public Map<String,Object> settlements(@RequestHeader("Authorization") String h){double gross=shop(h).orders.stream().mapToDouble(o->o.total).sum();return Map.of("pending",gross*.86,"paid",3819,"commission",gross*.14,"invoices",List.of(Map.of("id","INV-2026-102","date","10.10.2026","net",gross*.86,"status","Bekliyor"),Map.of("id","INV-2026-095","date","05.10.2026","net",3819,"status","Ödendi")));}
  @GetMapping("/reports") public Map<String,Object> reports(@RequestHeader("Authorization") String h,@RequestParam(defaultValue="30") int days){Shop s=shop(h);double total=s.orders.stream().mapToDouble(o->o.total).sum();return Map.of("days",days,"revenue",total,"orderCount",s.orders.size(),"averageBasket",total/Math.max(1,s.orders.size()),"dailySales",List.of(Map.of("label","Pzt","value",total*.28),Map.of("label","Sal","value",total*.52),Map.of("label","Çar","value",total*.35),Map.of("label","Per","value",total*.8),Map.of("label","Cum","value",total*.62)),"topProducts",s.products.subList(0,Math.min(3,s.products.size())));}
  private Map<String,Object> issue(User u,String email){String t=UUID.randomUUID()+UUID.randomUUID().toString().replace("-","");sessions.put(t,new Session(u.id,Instant.now().plusSeconds(604800)));return Map.of("token",t,"email",email);}
  private Shop shop(String h){if(h==null||!h.startsWith("Bearer "))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);Session x=sessions.get(h.substring(7));if(x==null||x.expires.isBefore(Instant.now()))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);return Optional.ofNullable(shops.get(x.userId)).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED));}
  private int index(List<Product> ps,String id){for(int i=0;i<ps.size();i++)if(ps.get(i).id.equals(id))return i;throw new ResponseStatusException(HttpStatus.NOT_FOUND);}
  private Product product(String id,Map<String,Object>b,boolean active){String n=String.valueOf(b.getOrDefault("name","")),c=String.valueOf(b.getOrDefault("category","")),sku=String.valueOf(b.getOrDefault("sku",""));double price=number(b.get("price"));int stock=(int)number(b.get("stock"));if(n.isBlank()||c.isBlank()||sku.isBlank()||price<0||stock<0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Ürün bilgilerini kontrol edin.");return new Product(id,n,c,sku,price,stock,String.valueOf(b.getOrDefault("description","")),active);}
  private double number(Object v){try{return Double.parseDouble(String.valueOf(v));}catch(Exception e){return 0;}}
  private Shop seed(String name){Shop s=new Shop();s.profile.putAll(Map.of("companyName",name,"contactPerson","Demo Kullanıcı","phone","0555 000 00 00","email","demo@barberworkshop.dev","taxOffice","Kadıköy","taxNumber","0000000000","city","İstanbul","address","Örnek adres"));s.products.addAll(List.of(new Product("p1","Profesyonel Berber Kesim Makası 6.0\"","Makas","MAK-060",1850,4,"Paslanmaz çelik makas.",true),new Product("p2","Kablosuz Ense & Sakal Kesme Makinesi","Makine","BYN-05",4900,3,"Güçlü motor, uzun pil ömrü.",true),new Product("p3","Matte Clay Güçlü Tutuş Wax 150ml","Bakım","WAX-150",310,5,"Mat görünüm, güçlü tutuş.",true),new Product("p4","Berber Boyun Bandı (5 Rulo Paket)","Sarf Malzeme","BYN-05B",320,82,"Tek kullanımlık boyun bandı.",true),new Product("p5","Tıraş Sonrası Kolonya No:4 400ml","Bakım","KOL-400",195,28,"Ferahlık veren kolonya.",true),new Product("p6","Geleneksel Tıraş Bıçağı (100 Adet)","Sarf Malzeme","BIC-100",410,3,"Paslanmaz jilet.",true),new Product("p7","Berber Boyun Bandı (5 Rulo Paket)","Sarf Malzeme","BYN-05C",320,82,"Yumuşak ve dayanıklı.",true)));s.orders.add(new Order("BT-20261008-01","08.10.2026 19:09","Kadıköy Kuaför & Barber","0532 555 10 20","Caferağa Mah. Moda Cad. No:44","Bekliyor",3700,List.of(new Line("Profesyonel Berber Kesim Makası 6.0\"",2,1850)),"Acele teslim edilirse seviniriz."));s.orders.add(new Order("BT-20261008-02","08.10.2026 16:34","Stil Berber Nişantaşı","0532 111 22 33","Teşvikiye, İstanbul","Hazırlanıyor",3330,List.of(new Line("Kablosuz Ense & Sakal Kesme Makinesi",1,3330)),""));s.orders.add(new Order("BT-20261007-03","07.10.2026 12:10","Centilmen Erkek Kuaförü","0532 111 44 55","Beşiktaş, İstanbul","Teslim edildi",1240,List.of(new Line("Matte Clay Güçlü Tutuş Wax 150ml",4,310)),""));s.ads.add(new Ad("ad1","Ense Makinesi Öne Çıkarma","Kablosuz Ense & Sakal Kesme Makinesi","p2","Tek ürün",150,"Yayında"));return s;}
  private record User(String id,String hash){} private record Session(String userId,Instant expires){}
  private static class Shop {final Map<String,String> profile=new ConcurrentHashMap<>();final List<Product> products=new java.util.concurrent.CopyOnWriteArrayList<>();final List<Order> orders=new java.util.concurrent.CopyOnWriteArrayList<>();final List<Ad> ads=new java.util.concurrent.CopyOnWriteArrayList<>();}
  public record Product(String id,String name,String category,String sku,double price,int stock,String description,boolean active){}
  public record Line(String name,int quantity,double unitPrice){} public record Order(String id,String date,String salon,String phone,String address,String status,double total,List<Line> lines,String note){}
  public record Ad(String id,String title,String productName,String productId,String scope,double budget,String status){}
}
