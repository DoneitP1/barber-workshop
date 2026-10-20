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

Demo giriş bilgileri: `demo@barberworkshop.dev` / `demo123`.

## API

Spring Boot API `http://localhost:8080/api` adresinde çalışır. Emulator uygulaması host makineye `10.0.2.2:8080` ile ulaşır. Sağlık kontrolü: `GET /api/health`.

## Demo kapsamı

Backend şu an bellekte örnek veri tutar. Sunucu yeniden başladığında kayıt, ürün ve kampanya değişiklikleri sıfırlanır. Siparişler, faturalar, satışlar ve mağaza onayı videodaki akışı göstermek için üretilmiş örnek verilerdir. Reklam başvurusu ödeme almaz; hakediş/fatura ekranları gerçek finansal kayıt oluşturmaz. Bu sürüm yerel prototiptir. Üretime çıkmadan önce kalıcı veritabanı, HTTPS, oran sınırlama, oturum iptali/yenileme, şifre sıfırlama ve gerçek ödeme/teslimat sağlayıcıları eklenmelidir. Android manifestindeki açık HTTP izni yalnızca emulator ile yerel API geliştirmesi içindir.
