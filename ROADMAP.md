# EduDesk Roadmap

**Vizyon:** Ödev odaklı çekirdek. Yan özellikler küçültülür; ödev takibi, öğrenci sicili ve veli iletişimi derinleştirilir.

---

## Faz 1 — Çekirdek Güçlendirme (aktif)

### Tamamlanan
- [x] Ödev durum girişi (5 durum, toplu güncelleme, not)
- [x] Kümülatif ödev sicil badge (ödev detay sayfasında)
- [x] Ödev şablonları ve kopyalama
- [x] Öğrenci ödev sicil modali (StatusBoard + öğrenci yönetimi)
- [x] Veli WhatsApp bildirimi (manuel + Inngest otomatik)
- [x] Excel export

### Sıradaki
- [ ] **Ödev analitikleri** — sınıf bazlı tamamlanma trendi, en çok aksatan öğrenciler listesi
- [ ] **Ödev puanlama** — yapılan ödevlere not/puan girişi, not defteri ile entegrasyon
- [ ] **Takvim görünümü** — ödevleri haftalık/aylık takvimde görüntüle
- [ ] **Toplu WhatsApp** — belirli öğrencilere (eksik/yapılmadı) tek tıkla WA mesajı

---

## Faz 2 — Sadeleştirme

Aşağıdaki özellikler kullanım sıklığı düşük — kaldırılabilir veya opsiyonel yapılabilir:

| Özellik | Durum | Karar |
|---------|-------|-------|
| Zümre toplantıları | Aktif, az kullanılıyor | Sidebar'dan gizle, sayfayı koru |
| TYMM (müfredat takibi) | Aktif, çok az kullanılıyor | Kaldır veya arşivle |
| Öğretmen dosyası (15 madde) | Aktif | Profil sayfasına gizle |
| Ortak sınavlar | Aktif, not defteri ile örtüşüyor | Not defteri ile birleştir |
| Duyurular | Zümre başkanına özel | Koru |

---

## Faz 3 — Derinleştirme

- **Ödev geçmişi raporu** — öğretmen için PDF/Excel çıktısı (tüm dönem)
- **Veli portalı güçlendirme** — velinin kendi çocuğunun ödev sicilini görmesi
- **SMS bildirimi** — Netgsm entegrasyonu (veli_telefon alanı hazır)
- **Tekrarlayan ödevler** — haftalık/aylık otomatik oluşturma

---

## Teknik Yol Haritası

- Playwright testlerini interaktif özellikler için genişlet (modal, status update)
- Integration test kapsamını `homework_submissions` sorgularına yay
- `src/domains/homework/lib/` altını büyüt — domain logic'i service'ten ayır
