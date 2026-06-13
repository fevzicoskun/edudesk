const PERSONAS = [
  {
    emoji: '🏫',
    title: 'Okul Müdürü',
    desc: 'Okul geneli görünüm, öğretmen aktivitesi, anlık raporlar ve sistem yönetimi.',
  },
  {
    emoji: '👩‍🏫',
    title: 'Öğretmen',
    desc: 'Yoklama, ödev takibi ve not defteri — tüm sınıf yönetimi tek ekranda.',
  },
  {
    emoji: '👨‍👩‍👧',
    title: 'Veli',
    desc: 'Çocuğunuzun devamsızlık ve ödev durumunu her an, her yerden görün.',
  },
] as const

export default function LandingForWhom() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-12 text-center text-3xl font-bold text-stone-900">
          Kimler için?
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {PERSONAS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-orange-100 bg-orange-50 p-6"
            >
              <div className="mb-3 text-4xl" aria-hidden="true">{p.emoji}</div>
              <h3 className="mb-2 text-lg font-semibold text-stone-900">{p.title}</h3>
              <p className="text-sm leading-relaxed text-stone-600">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
