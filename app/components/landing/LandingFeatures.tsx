const FEATURES = [
  {
    icon: '✅',
    title: 'Yoklama Takibi',
    desc: 'Günlük yoklama, devamsızlık trendi ve otomatik veli bildirimi tek yerden.',
  },
  {
    icon: '📚',
    title: 'Ödev Yönetimi',
    desc: 'Teslim takibi, tamamlanma oranı ve gecikme uyarıları anlık görünür.',
  },
  {
    icon: '👨‍👩‍👧',
    title: 'Veli Portalı',
    desc: 'QR bağlantı ile anında erişim; veliler çocuğunun durumunu her an görür.',
  },
  {
    icon: '📊',
    title: 'Analitik Dashboard',
    desc: 'Risk analizi, sınıf karşılaştırması ve trend grafikleriyle hızlı karar alın.',
  },
  {
    icon: '⚙️',
    title: 'Okul Yönetimi',
    desc: 'Öğretmen rolleri, okul ayarları ve sistem kontrolü tek panelde.',
  },
] as const

export default function LandingFeatures() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-4 text-center text-3xl font-bold text-stone-900">
          Her şey burada
        </h2>
        <p className="mb-12 text-center text-stone-500">
          Okulunuzun ihtiyaç duyduğu tüm araçlar tek bir platformda
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-3 text-3xl" aria-hidden="true">{f.icon}</div>
              <h3 className="mb-2 text-lg font-semibold text-stone-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-stone-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
