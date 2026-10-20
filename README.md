# Barber Workshop

Video referansındaki BarBer tedarikçi paneli akışlarını Android uygulaması ve REST API olarak yeniden kuran demo proje.

## Ekranlar

- Tedarikçi giriş ve kayıt
- Mağaza özeti, stok uyarıları ve satış raporları
- Ürün kataloğu, arama, filtreleme, ekleme/düzenleme ve yayından alma
- Salon siparişleri, filtreler ve sipariş detayı
- Reklam kampanyası başvurusu ve kampanya listesi
- Firma bilgileri, hakediş ve örnek faturalar

## Geliştirme için çalıştırma

JDK 17+, Android SDK 36+, Gradle wrapper ve Android emulator gerekir.

Terminal 1'de REST API'yi başlat:

```sh
./gradlew :backend:bootRun
```

Terminal 2'de emulator açıkken Android uygulamasını kurup çalıştır:

```sh
./gradlew :app:installDebug
adb shell am start -n com.barberworkshop.app/.MainActivity
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

## Supabase ile giriş

Tüm hesaplar Supabase Auth üzerinden giriş yapar. Yerel demo hesabı veya alternatif bir parola deposu yoktur. Backend her özel istekte erişim tokenını yapılandırılan Supabase projesinin Auth sunucusunda doğrular ve kullanıcı verisini doğrulanmış kullanıcı ID'sine göre ayırır.

1. Bu uygulama için ayrı bir Supabase projesi oluşturun.
2. `.env.example` dosyasını `.env` olarak kopyalayın ve projenin HTTPS URL'si ile **publishable** anahtarını girin.
3. API'yi yeniden başlatın. `GET /api/auth/config` çıktısındaki `configured` değeri `true` olmalıdır.
4. Uygulamada kayıt olun; Supabase e-posta doğrulaması açıksa gelen doğrulama bağlantısını onaylayıp giriş yapın.

`.env` Git'e gönderilmez. Supabase hesabının parolası, veritabanı parolası ve `service_role`/secret anahtarı bu uygulamada kullanılmaz. Auth anahtarları yapılandırılana kadar giriş kapalı kalır.

Erişim/yenileme tokenları arayüzün belleğinde tutulur. Oturum açıkken erişim tokenı otomatik yenilenir; çıkışta Supabase oturumu kapatılıp özel ekran verileri temizlenir. Uygulama yeniden açıldığında tekrar giriş gerekir.

Yerel geliştirme için Supabase Auth **Site URL** değerini `http://localhost:8080` yapın. E-posta doğrulaması, kullanıcı daveti ve şifre sıfırlama bağlantıları bu adrese döner. Davet/sıfırlama bağlantısındaki oturum önce backend tarafından doğrulanır, tokenlar adres çubuğundan kaldırılır ve kullanıcı kendi şifresini belirler. Üretimde bu ayarı uygulamanın HTTPS adresiyle değiştirin.

## API

Spring Boot API `http://localhost:8080/api` adresinde çalışır. Aynı mobil arayüz tarayıcıda `http://localhost:8080` adresinden de açılır. Emulator uygulaması host makineye `10.0.2.2:8080` ile ulaşır. Sağlık kontrolü: `GET /api/health`.

Giriş uçları: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/refresh`, `POST /api/auth/logout`. Oturum kontrolü: `GET /api/auth/session`. Diğer API uçları Supabase Bearer oturumu ister.

Şifre kurtarma: `POST /api/auth/recover`. Doğrulanmış davet veya kurtarma oturumunda şifre belirleme: `PUT /api/auth/password`.

Doğrulama komutları:

```sh
./gradlew :backend:test :backend:bootJar :app:assembleDebug
node --test frontend-tests/*.test.cjs
```

Arayüz ve işlev kontrolü, kalan demo/eksik alanlar ve ekran görüntüleri: [kontrol raporu](docs/UI-AND-FUNCTIONAL-AUDIT.md).

## Demo kapsamı

Supabase kullanıcı hesapları kalıcıdır. Ürün, firma profili düzenlemeleri, sipariş ve kampanya verileri henüz backend belleğindeki örnek verilerdir; sunucu yeniden başladığında bu düzenlemeler sıfırlanır. Siparişler, faturalar, satışlar ve mağaza onayı videodaki akışı göstermek için üretilmiş örnek verilerdir. Reklam başvurusu ödeme almaz; hakediş/fatura ekranları gerçek finansal kayıt oluşturmaz. Bu sürüm yerel prototiptir. Üretime çıkmadan önce iş verileri için kalıcı veritabanı, HTTPS dağıtımı, oran sınırlama ve gerçek ödeme/teslimat sağlayıcıları eklenmelidir. Android manifestindeki açık HTTP izni yalnızca emulator ile yerel API geliştirmesi içindir.
