# EduDesk Roadmap

**Vizyon:** Ödev odaklı çekirdek. Ödev takibi, sınıf analitikleri ve veli iletişimi derinleştirilir.

---

## Faz 1 — Çekirdek (tamamlandı)

- [x] Ödev durum girişi (5 durum, per-öğrenci anlık güncelleme, toplu güncelleme)
- [x] Tamamlanma özet barı + segmentli görsel (yapıldı/eksik/geç/yapılmadı/girilmedi)
- [x] Per-öğrenci pending state — diğer öğrenciler bloklanmaz
- [x] Not kayıt feedback ("✓ Kaydedildi" 2 sn)
- [x] Öğrenci arama (StatusBoard içi, anlık filtre)
- [x] Ödev şablonları ve kopyalama
- [x] Çoklu sınıfa tek seferde ödev atama (toggle chip seçim)
- [x] Urgency badge: "Bugün!" / "Yarın" / "X gün" / "Aktif"
- [x] "✓ Tümü girildi" tamamlanma badge
- [x] **Sınıf Ödev Matrisi** — öğrenci × ödev görünümü, satır/sütun tamamlanma %
- [x] Kümülatif ödev sicil badge (ödev detay sayfasında)
- [x] Öğrenci ödev sicil modali
- [x] Veli WhatsApp bildirimi (manuel + Inngest otomatik)
- [x] Excel export

---

## Faz 2 — Derinleştirme (sıradaki)

- [ ] **Yoklama sağlamlaştırma** — mevcut ödev güçlendirmesiyle paralel
- [ ] **Ödev puanlama** — yapılan ödevlere puan/not girişi
- [ ] **Takvim görünümü** — ödevleri haftalık takvimde görüntüle
- [ ] **Sınıf matrisi: öğrenci filtresi** — matris sayfasında arama ve sıralama
- [ ] **Tekrarlayan ödevler** — haftalık/aylık otomatik oluşturma
- [ ] **Ödev geçmişi raporu** — dönem sonu PDF/Excel çıktısı

---

## Faz 3 — Genişleme

- [ ] **SMS bildirimi** — Netgsm entegrasyonu (`veli_telefon` alanı hazır)
- [ ] **Veli portalı** — velinin çocuğunun ödev sicilini görmesi
- [ ] **Toplu WhatsApp** — belirli statüdeki tüm velilere tek tıkla mesaj
- [ ] **Yoklama SMS** — devamsızlık bildirimi

---

## Teknik

- Playwright E2E kapsamını genişlet (modal, status update, matrix)
- Integration test kapsamını `homework_submissions` sorgularına yay
