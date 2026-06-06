# Handoff

## State
Homework modülü tamamlandı: `sendHomeworkReminderEmails` action (`app/actions/veli-bildirim.ts`) + TDD testleri (`tests/vitest/unit/homework/veli-bildirim.test.ts`) yazıldı, commit `7393b8a`. Toplam 170 unit test, 11 dosya — hepsi yeşil. `tsc --noEmit` temiz. Branch `main`, origin'den 11 commit ileride (push yapılmadı).

## Next
1. **Müdür Komuta Merkezi** — `/yonetim` sayfası yeniden tasarımı; plan `project_mudur_komuta_merkezi.md`'de mevcut, hiç kod yazılmadı.
2. **git push origin main** — 11 commit birikmiş, kullanıcıdan onay al (feedback_git_push.md: onay sor, direkt push et).
3. **Market Research karar** — `project_market_research.md`'deki #2 (SaaS+komisyon) vs #4 (yıllık lisans) seçimi hâlâ açık.

## Context
- `OGRETMEN_PERMS` `homework:update` scope `own` içeriyor — `school` scope gereken testlerde `SCHOOL_HW_PERMS` kullan (factories.ts'e eklenmedi, test içinde tanımlandı).
- Yoklama SMS/WhatsApp ertelendi; `veli_telefon` alanı DB'de hazır.
