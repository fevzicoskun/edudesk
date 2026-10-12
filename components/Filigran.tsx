/** Yalnız kâğıtta görünen çapraz okul adı (her sayfada tekrar eder; CSS: globals.css .filigran). */
export default function Filigran({ metin }: { metin: string | null | undefined }) {
  if (!metin) return null
  return <div className="filigran" aria-hidden>{metin}</div>
}
