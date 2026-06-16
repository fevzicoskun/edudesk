const STEPS = [
  {
    num: '1',
    title: 'Okulunuzu kurun',
    desc: '10 dakikada okul profilinizi ve sınıflarınızı oluşturun.',
  },
  {
    num: '2',
    title: 'Öğretmenlerinizi davet edin',
    desc: 'Davet bağlantısıyla öğretmenleriniz hemen sisteme katılır.',
  },
  {
    num: '3',
    title: 'Takibe başlayın',
    desc: 'Yoklama, ödev ve veli iletişiminiz tek panelde hazır.',
  },
] as const

export default function LandingHowItWorks() {
  return (
    <section className="bg-stone-50 px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-12 text-center text-3xl font-bold text-stone-900">
          Nasıl çalışır?
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.num} className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">
                {s.num}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-stone-900">{s.title}</h3>
              <p className="text-sm leading-relaxed text-stone-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
