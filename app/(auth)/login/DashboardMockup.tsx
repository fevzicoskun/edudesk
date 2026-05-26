const stats = [
  { label: 'Bugün Yoklama', value: '3/4', sub: 'sınıf tamamlandı', color: 'text-blue-400' },
  { label: 'Aktif Ödev',    value: '12',  sub: 'bu hafta',         color: 'text-emerald-400' },
  { label: 'Bekleyen Not',  value: '2',   sub: 'sınıf',            color: 'text-violet-400' },
]

const recentItems = [
  { text: '10-A yoklaması alındı',      time: '08:15', dot: 'bg-blue-500' },
  { text: 'Matematik ödevi eklendi',    time: '07:50', dot: 'bg-emerald-500' },
  { text: 'Zümre toplantısı planlandı', time: 'Dün',   dot: 'bg-violet-500' },
]

export default function DashboardMockup() {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl">
      {/* Tarayıcı chrome */}
      <div className="bg-slate-800 px-3 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        </div>
        <div className="flex-1 bg-slate-700 rounded px-2.5 py-1 text-[10px] text-slate-400 ml-1 truncate">
          myedudesk.com.tr/anasayfa
        </div>
      </div>

      {/* Uygulama UI */}
      <div className="flex bg-gray-50" style={{ height: 200 }}>
        {/* Sidebar */}
        <div className="w-11 bg-slate-900 flex flex-col items-center py-3 gap-2.5 shrink-0">
          <div className="w-6 h-6 rounded-md bg-blue-600" />
          <div className="w-6 h-6 rounded-md bg-slate-700" />
          <div className="w-6 h-6 rounded-md bg-slate-700" />
          <div className="w-6 h-6 rounded-md bg-slate-700" />
        </div>

        {/* İçerik */}
        <div className="flex-1 p-3 overflow-hidden">
          {/* İstatistik kartları */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            {stats.map((s) => (
              <div key={s.label} className="bg-white rounded-lg p-2">
                <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[9px] text-gray-500 leading-tight mt-0.5">{s.label}</div>
                <div className="text-[8px] text-gray-400">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Son aktivite */}
          <div className="bg-white rounded-lg p-2">
            <div className="text-[9px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Son Aktivite</div>
            <div className="space-y-1.5">
              {recentItems.map((item) => (
                <div key={item.text} className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />
                  <span className="text-[9px] text-gray-600 flex-1 truncate">{item.text}</span>
                  <span className="text-[8px] text-gray-400 shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
