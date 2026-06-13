# Kullanıcı Davet Maili — Tasarım Spec (2026-06-13)

## Amaç

Müdür/müdür yardımcısı yeni kullanıcı oluşturduğunda sistem otomatik olarak o kullanıcıya giriş bilgilerini içeren bir e-posta gönderir. Müdür hâlâ geçici şifreyi ekranda görür (çifte güvence); mail yalnızca ek bir kolaylıktır.

## Mevcut Durum

`UserService.invite()` → `tempPassword` üretir, kullanıcıyı oluşturur, `{ success: true, tempPassword }` döner.  
`inviteUser()` action → sonucu UI'a iletir; **mail atmaz**.  
Müdür şifreyi ekrandan kopyalayıp öğretmene elle iletmek zorunda.

## Çözüm

`inviteUser()` action'ında `result.success` olunca:
1. `getCurrentProfile()` ile müdürün okul adını çek (`profile.schools?.name`)
2. `mailer.sendMail()` ile yeni kullanıcıya giriş bilgileri maili at
3. Mail başarısız olursa → `logger.error(...)` + action yine `result` döner (non-blocking)

## Değişen Dosyalar

| İşlem | Dosya |
|-------|-------|
| Değiştir | `app/actions/users.ts` |

`UserService`, `UserRepository`, `types/index.ts` — **değişmez**.

## Mail İçeriği

**Konu:** `EduDesk — Giriş Bilgileriniz`

**HTML gövde:**
```html
<h2>Hoş Geldiniz, [full_name]!</h2>
<p>[school_name] için EduDesk hesabınız oluşturuldu.</p>
<table>
  <tr><td>E-posta</td><td>[email]</td></tr>
  <tr><td>Geçici Şifre</td><td>[tempPassword]</td></tr>
</table>
<p><a href="https://myedudesk.com.tr/login">Giriş Yap</a></p>
<p style="color:#888">İlk girişten sonra şifrenizi değiştirmenizi öneririz.</p>
```
(Tüm kullanıcı verileri `esc()` ile sanitize edilir.)

## Hata Yönetimi

- Mail başarısız → `logger.error({ event: 'invite_mail_failed', email }, ...)` + action `{ success: true, tempPassword }` döner
- Okul adı bulunamazsa → `'Okulunuz'` fallback kullanılır

## Test

- Mevcut `inviteUser` action için birim test yoktu; mail gönderimini mock'layıp:
  1. Başarılı invite → `mailer.sendMail` doğru parametrelerle çağrıldı mı?
  2. Mail başarısız → action yine `success: true` döndü mü?
  3. `result.error` varsa → `mailer.sendMail` hiç çağrılmadı mı?
- 3 yeni test, mevcut 486 unit test'e eklenir
