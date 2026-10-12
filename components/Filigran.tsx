/** Yalnız kâğıtta görünen soluk okul logosu (her sayfada tekrar eder; CSS: globals.css .filigran). */
// ponytail: tek okul var → logo sabit dosya (public/filigran.png); ikinci okul gelince schools tablosuna logo_url
export default function Filigran() {
  // eslint-disable-next-line @next/next/no-img-element -- yalnız baskıda görünür, next/image gereksiz
  return <div className="filigran" aria-hidden><img src="/filigran.png" alt="" /></div>
}
