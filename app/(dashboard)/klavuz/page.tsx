import Link from 'next/link'
import PrintButton from '@/components/PrintButton'

export const metadata = { title: 'Kullanım Kılavuzu · EduDesk' }

function Section({ id, color, icon, title, children }: {
  id: string; color: string; icon: React.ReactNode; title: string; children: React.ReactNode
}) {
  return (
    <section id={id} className="mb-10 print:mb-8 print:break-inside-avoid-page">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-5 ${color}`}>
        <div className="w-8 h-8 rounded-lg bg-white/30 flex items-center justify-center shrink-0">{icon}</div>
        <h2 className="text-base font-bold text-white">{title}</h2>
      </div>
      <div className="space-y-5 px-1">{children}</div>
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-2 flex items-center gap-2">
        <span className="w-1 h-4 bg-gray-300 dark:bg-slate-600 rounded-full" />
        {title}
      </h3>
      <div className="pl-4 space-y-1.5 text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{children}</div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
      <span className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{children}</span>
    </div>
  )
}

function Note({ color = 'amber', children }: { color?: 'amber' | 'red' | 'blue' | 'green'; children: React.ReactNode }) {
  const styles = {
    amber: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    red:   'bg-red-50   dark:bg-red-950/20   border-red-200   dark:border-red-800   text-red-800   dark:text-red-300',
    blue:  'bg-blue-50  dark:bg-blue-950/20  border-blue-200  dark:border-blue-800  text-blue-800  dark:text-blue-300',
    green: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
  }
  return (
    <div className={`border rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${styles[color]}`}>{children}</div>
  )
}

export default function KlavuzPage() {
  return (
    <>
      <style>{`
        @media print {
          aside, nav, header, .print-hide { display: none !important; }
          main { padding-top: 0 !important; padding-bottom: 0 !important; overflow: visible !important; }
          body { background: white !important; color: black !important; }
          .dark aside, .dark nav { display: none !important; }
        }
      `}</style>

      <div className="p-4 md:p-8 max-w-3xl mx-auto">

        {/* Araç çubuğu — yazdırmada gizlenir */}
        <div className="print-hide flex items-center justify-between mb-6 gap-3">
          <Link href="/anasayfa" className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">
            ← Anasayfa
          </Link>
          <div className="flex items-center gap-2">
            <PrintButton />
            <span className="text-xs text-gray-400 dark:text-slate-500">Ctrl + P → PDF olarak kaydet</span>
          </div>
        </div>

        {/* Kapak */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-7 mb-8 text-white print:bg-blue-700">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-1">EduDesk</p>
          <h1 className="text-2xl font-bold mb-1">Kullanım Kılavuzu</h1>
          <p className="text-sm text-blue-200">Öğretmenden müdüre tüm roller için kapsamlı rehber</p>
          <p className="text-xs text-blue-300 mt-3">Sürüm 1.0 · {new Date().getFullYear()}</p>
        </div>

        {/* İçindekiler */}
        <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 mb-10 print-hide">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">İçindekiler</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {[
              ['#genel',    '1. Genel Bakış'],
              ['#roller',   '2. Roller ve Yetkiler'],
              ['#ogretmen', '3. Öğretmen Kılavuzu'],
              ['#zumre',    '4. Zümre Başkanı'],
              ['#my',       '5. Müdür Yardımcısı'],
              ['#mudur',    '6. Müdür'],
              ['#faq',      '7. Sık Sorulan Sorular'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-blue-600 dark:text-blue-400 hover:underline">{label}</a>
            ))}
          </div>
        </div>

        {/* 1. Genel Bakış */}
        <Section id="genel" color="bg-gradient-to-r from-slate-600 to-slate-700"
          icon={<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          title="1. Genel Bakış"
        >
          <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
            EduDesk, MEB bağlı okullardaki öğretmenlerin günlük iş yükünü dijitalleştiren bir okul yönetim platformudur.
            Ödev takibi, yoklama, not defteri, müfettiş hazırlık dosyası ve yönetim dashboardları tek çatı altında toplanmıştır.
          </p>
          <SubSection title="Sistem Gereksinimleri">
            <p>Modern web tarayıcısı (Chrome, Edge, Safari, Firefox) · İnternet bağlantısı · PC, tablet veya akıllı telefon</p>
          </SubSection>
          <SubSection title="Adres">
            <p><strong>myedudesk.com.tr</strong> — tüm cihazlardan tarayıcı ile erişilir, uygulama yüklemesi gerekmez.</p>
          </SubSection>
        </Section>

        {/* 2. Roller */}
        <Section id="roller" color="bg-gradient-to-r from-violet-600 to-violet-700"
          icon={<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
          title="2. Roller ve Yetkiler"
        >
          {[
            { rol: 'Öğretmen',          renk: 'bg-blue-100 text-blue-700',    yetki: 'Kendi sınıfları, ödevleri, yoklama, not defteri, müfettiş dosyası' },
            { rol: 'Zümre Başkanı',     renk: 'bg-teal-100 text-teal-700',    yetki: 'Öğretmen yetkilerine ek: zümre toplantıları, ortak sınavlar, zümre bildirimi' },
            { rol: 'Müdür Yardımcısı',  renk: 'bg-indigo-100 text-indigo-700', yetki: 'Sınıf/öğrenci yönetimi, tüm öğretmen verilerini okuma, kullanıcı daveti, raporlar' },
            { rol: 'Müdür',             renk: 'bg-purple-100 text-purple-700', yetki: 'Tüm veriler, kullanıcı rol ataması, okul geneli dashboard, duyuru gönderme' },
          ].map(r => (
            <div key={r.rol} className="flex items-start gap-3">
              <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 ${r.renk}`}>{r.rol}</span>
              <p className="text-sm text-gray-600 dark:text-slate-400">{r.yetki}</p>
            </div>
          ))}
        </Section>

        {/* 3. Öğretmen */}
        <Section id="ogretmen" color="bg-gradient-to-r from-blue-600 to-blue-700"
          icon={<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
          title="3. Öğretmen Kılavuzu"
        >
          <SubSection title="3.1 Anasayfa — Dashboard">
            <p>Giriş yapıldığında açılan ekran üç ana kart gösterir: Bugünkü ödev sayısı, toplam eksik ödev, aktif risk uyarısı.</p>
            <p className="mt-1">Haftalık şeritte bu haftaki teslim ve tamamlanma oranlarına bakın. Risk Uyarıları bölümü devamsızlık veya ödev sorunlu öğrencileri otomatik listeler. Grafikler bölümünde son 8 haftalık devamsızlık trendi ve son 6 ödev tamamlanma oranı görünür.</p>
          </SubSection>

          <SubSection title="3.2 Sınıflar">
            <div className="space-y-1">
              <Step n={1}>Sol menüden <strong>Sınıflar</strong> sayfasına girin.</Step>
              <Step n={2}>İlgili sınıf kartına tıklayın, sınıf detay sayfasına ulaşın.</Step>
              <Step n={3}>Öğrenci eklemek için <strong>Öğrenci Ekle</strong> ya da <strong>Toplu Yükle</strong> (CSV) butonunu kullanın.</Step>
              <Step n={4}>Öğrenci ismine tıklayarak profil sayfasına geçin: tüm ödev geçmişi, devamsızlık çizelgesi, öğretmen notları tek ekranda.</Step>
            </div>
          </SubSection>

          <SubSection title="3.3 Ödevler">
            <div className="space-y-1">
              <Step n={1}><strong>Ödevler</strong> menüsünü açın. Aktif / Geçmiş ödevler ayrı bölümlerde listelenir.</Step>
              <Step n={2}><strong>Yeni Ödev</strong> butonuna tıklayın: başlık, ders, sınıf, son tarih doldurun.</Step>
              <Step n={3}>Ödev detay sayfasında her öğrencinin durumunu seçin: <em>Yapıldı / Eksik / Yapılmadı / Geç / Mazeretli</em>.</Step>
              <Step n={4}><strong>Toplu Güncelle</strong> seçeneği ile tüm sınıfı aynı duruma çekip sadece istisnaları tek tek düzeltin.</Step>
            </div>
            <Note color="red">Son tarihten <strong>3 gün</strong> sonra ödev kontrolü otomatik kilitlenir ve artık giriş yapılamaz. Bu süre dolmadan kontrol girişini tamamlayın.</Note>
            <Note color="amber">Kilitlenmeden önce girilmemiş ödevler "Bekleyen Kontroller" uyarı bölümünde öne çıkar; kalan gün sayısı gösterilir.</Note>
          </SubSection>

          <SubSection title="3.4 Yoklama">
            <div className="space-y-1">
              <Step n={1}><strong>Yoklama</strong> menüsünü açın, tarih ve sınıfı seçin.</Step>
              <Step n={2}>Her öğrenci için: <em>Var / Yok / Geç / Mazeretli</em> işaretleyin.</Step>
              <Step n={3}>Geçmiş tarihlere geri dönüp düzenleme yapabilirsiniz.</Step>
            </div>
            <Note color="blue">Öğrencinin yıl içi devamsızlık gün toplamı profil sayfasında MEB sınırına (20 gün) göre progress bar ile görünür; 15 günde sarı, 20 günde kırmızı uyarı verir.</Note>
          </SubSection>

          <SubSection title="3.5 Not Defteri">
            <div className="space-y-1">
              <Step n={1}><strong>Not Defteri</strong> menüsüne girin, sınıfı seçin.</Step>
              <Step n={2}>Sütun başlıklarına sınav/ödev adı yazın.</Step>
              <Step n={3}>Her öğrenci için nota tıklayarak düzenleyin; ortalamalar otomatik hesaplanır.</Step>
            </div>
          </SubSection>

          <SubSection title="3.6 Müfettiş Hazırlık Dosyası">
            <p>İki ayrı bölüm bulunur:</p>
            <div className="space-y-1 mt-2">
              <p><strong>Öğretmen Dosyası (sol menü):</strong> Denetim için bulundurulması zorunlu belge listesi. Tamamlanan belgeleri işaretleyin.</p>
              <p><strong>Profil → Dosyam:</strong> Ayrıntılı müfettiş paketi — Günlük Planlar, Yıllık Plan, Zümre Toplantı Kararları, Yazılı Sınav Kağıtları, Defter Kontrol Formu, ŞÖK Kararları. Her bölümde yeni kayıt ekleyin ve PDF olarak dışa aktarın.</p>
            </div>
            <Note color="green">Müfettiş denetimine girilmeden önce "Öğretmen Dosyası" sayfasındaki kontrol listesini tamamlayın. Eksik belge varsa uyarı görünür.</Note>
          </SubSection>
        </Section>

        {/* 4. Zümre Başkanı */}
        <Section id="zumre" color="bg-gradient-to-r from-teal-600 to-teal-700"
          icon={<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          title="4. Zümre Başkanı Kılavuzu"
        >
          <p className="text-sm text-gray-600 dark:text-slate-400">Zümre başkanı öğretmen yetkilerinin tamamına sahiptir; aşağıdakiler ek yetkilerdir.</p>

          <SubSection title="4.1 Zümre Toplantı Kararları">
            <Step n={1}><strong>Profil → Dosyam → Zümre Toplantıları</strong> bölümüne girin.</Step>
            <Step n={2}><strong>Yeni Toplantı</strong> ile toplantı tarihi, gündem ve alınan kararları kaydedin.</Step>
            <Step n={3}>PDF olarak dışa aktarın; müfettiş denetiminde sunulabilir.</Step>
          </SubSection>

          <SubSection title="4.2 Ortak Sınavlar">
            <Step n={1}><strong>Not Defteri</strong> menüsünden zümreye ait ortak sınav bölümüne girin.</Step>
            <Step n={2}>Sınıf bazlı notları girin; ortalamaları sistem hesaplar.</Step>
            <Step n={3}>Müdür dashboardunda sınav ortalamaları grafiği olarak görünür.</Step>
          </SubSection>

          <SubSection title="4.3 Zümre Bildirimi">
            <p><strong>Zümre Bildirimi</strong> menüsünden zümredeki öğretmenlere mesaj/duyuru gönderin.</p>
            <p>Alıcılar uygulamaya girdiklerinde tam ekran duyuru olarak görür ve onaylamadan geçemezler.</p>
          </SubSection>
        </Section>

        {/* 5. Müdür Yardımcısı */}
        <Section id="my" color="bg-gradient-to-r from-indigo-600 to-indigo-700"
          icon={<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          title="5. Müdür Yardımcısı Kılavuzu"
        >
          <SubSection title="5.1 Okul Kurulumu (İlk Açılış)">
            <div className="space-y-1">
              <Step n={1}>Sisteme ilk giriş yapınca Okul Kurulum ekranı açılır.</Step>
              <Step n={2}>Okul adı ve kodu girin (örn. <em>ATA2024</em>), kaydedin.</Step>
              <Step n={3}>Artık kullanıcı davet edebilir, sınıf oluşturabilirsiniz.</Step>
            </div>
          </SubSection>

          <SubSection title="5.2 Kullanıcı Yönetimi">
            <div className="space-y-1">
              <Step n={1}><strong>Kullanıcılar</strong> menüsüne girin.</Step>
              <Step n={2}><strong>Kullanıcı Davet Et</strong> ile e-posta gönderin veya davet linkini kopyalayın.</Step>
              <Step n={3}>Kayıt olan kullanıcıya rol atayın: Öğretmen / Zümre Başkanı / Müdür Yardımcısı.</Step>
            </div>
            <Note color="amber">Rol değişikliği anında geçerlidir; kullanıcının tekrar giriş yapması gerekmez.</Note>
          </SubSection>

          <SubSection title="5.3 Sınıf ve Öğrenci Yönetimi">
            <div className="space-y-1">
              <Step n={1}><strong>Sınıflar → Sınıf Ekle</strong> ile yeni sınıf oluşturun (isim + kademe).</Step>
              <Step n={2}>Sınıf sayfasından öğrenci ekleyin veya <strong>CSV Toplu Yükleme</strong> ile tüm sınıfı tek seferde aktarın.</Step>
              <Step n={3}>CSV formatı: <em>full_name, student_number, veli_email (opsiyonel)</em></Step>
            </div>
          </SubSection>

          <SubSection title="5.4 Raporlar">
            <p><strong>Raporlar</strong> menüsünden sınıf bazlı Excel dışa aktarımı yapın. Ödev durumu ve yoklama verileri dahildir.</p>
          </SubSection>
        </Section>

        {/* 6. Müdür */}
        <Section id="mudur" color="bg-gradient-to-r from-purple-600 to-purple-700"
          icon={<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
          title="6. Müdür Kılavuzu"
        >
          <SubSection title="6.1 Anasayfa — Okul Genel Bakış">
            <p>Müdür dashboardu şunları gösterir:</p>
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              <li>Günlük özet kartları: bugün devamsız öğrenci, yoklama girilen sınıf oranı, pasif öğretmen sayısı</li>
              <li>Öğretmen aktivitesi: son giriş tarihlerine göre sıralı liste, 14+ gün giriş yapmayanlara sarı/kırmızı uyarı</li>
              <li>Son duyurular</li>
              <li>Hızlı aksiyonlar: Sınıf Listeleri, Kullanıcı Yönetimi</li>
              <li>Sınav ortalamaları grafiği: okul geneli son 6 ortak sınavın bar chart'ı (70+ puan indigo, 50-70 amber, &lt;50 kırmızı)</li>
            </ul>
          </SubSection>

          <SubSection title="6.2 Okul Genel Bakış (/yonetim)">
            <p>Kademe bazlı istatistikler (ilkokul/ortaokul ayrımı), toplantı kayıtları ve tüm okul geneli veriler bu sayfadadır.</p>
          </SubSection>

          <SubSection title="6.3 Duyurular">
            <div className="space-y-1">
              <Step n={1}><strong>Duyurular</strong> menüsünden yeni duyuru oluşturun.</Step>
              <Step n={2}>Hedef kitle seçin: tüm öğretmenler veya belirli rol grubu.</Step>
              <Step n={3}>Kullanıcılar uygulamaya girince tam ekran duyuru görür ve onaylamak zorundadır.</Step>
            </div>
          </SubSection>
        </Section>

        {/* 7. SSS */}
        <Section id="faq" color="bg-gradient-to-r from-gray-600 to-gray-700"
          icon={<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          title="7. Sık Sorulan Sorular"
        >
          {[
            {
              s: 'Ödev kontrolünü neden giremiyorum?',
              c: 'Son tarihten 3 gün sonra ödev kontrolü otomatik kilitlenir. Ödev listesindeki "Bekleyen Kontroller" bölümü size kaç gün kaldığını gösterir.',
            },
            {
              s: 'Silinen sınıf veya öğrenciyi geri getirebilir miyim?',
              c: 'Evet. Yönetim → Silinen Kayıtlar sayfasından son 90 gün içindeki silinen kayıtları geri yükleyebilirsiniz.',
            },
            {
              s: 'Excel raporu nasıl alırım?',
              c: 'Sol menüden Raporlar sayfasına girin, sınıf seçin ve "Excel İndir" butonuna tıklayın. Ödev durumu ve yoklama verileri dahil edilir.',
            },
            {
              s: 'Veli portala nasıl ulaşır?',
              c: 'Öğrenci profil sayfasındaki "Veli Linkini Kopyala" butonu ile veli için özel bir link oluşturun. Bu link sadece o velinin öğrencisine aittir.',
            },
            {
              s: 'Aynı anda birden fazla cihazdan giriş yapılabilir mi?',
              c: 'Evet, sistem tüm cihazlarda eş zamanlı çalışır. Değişiklikler anlık olarak senkronize edilir.',
            },
            {
              s: 'Şifremi unuttum ne yapmalıyım?',
              c: 'Giriş sayfasındaki "Şifremi Unuttum" bağlantısına tıklayın. Kayıtlı e-posta adresinize sıfırlama linki gönderilir.',
            },
          ].map(({ s, c }) => (
            <div key={s} className="border-b border-gray-100 dark:border-slate-700 pb-4 last:border-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-1">{s}</p>
              <p className="text-sm text-gray-600 dark:text-slate-400">{c}</p>
            </div>
          ))}
        </Section>

        {/* Footer */}
        <div className="text-center pt-4 pb-8 border-t border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-400 dark:text-slate-500">EduDesk · myedudesk.com.tr</p>
          <p className="text-xs text-gray-300 dark:text-slate-600 mt-0.5">Bu kılavuz Ctrl+P ile PDF olarak kaydedilebilir.</p>
        </div>

      </div>
    </>
  )
}
