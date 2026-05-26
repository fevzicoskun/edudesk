const students = [
  { name: 'Ahmet Yılmaz', present: true },
  { name: 'Ayşe Kaya', present: true },
  { name: 'Mehmet Demir', present: false },
  { name: 'Zeynep Çelik', present: true },
  { name: 'Can Arslan', present: true },
]

export default function AppMockup() {
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
          myedudesk.com.tr/yoklama
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
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <div className="text-[11px] font-semibold text-gray-800">Yoklama — 10-A</div>
              <div className="text-[10px] text-gray-400">28 öğrenci · Bugün</div>
            </div>
            <div className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded-md font-medium shrink-0">
              Kaydet
            </div>
          </div>

          <div className="space-y-1">
            {students.map((s) => (
              <div
                key={s.name}
                className={`flex items-center gap-2 px-2 py-1 rounded-md text-[10px] ${
                  s.present ? 'bg-white' : 'bg-red-50'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded flex items-center justify-center text-white font-bold shrink-0 ${
                    s.present ? 'bg-green-500' : 'bg-red-400'
                  }`}
                  style={{ fontSize: 8 }}
                >
                  {s.present ? '✓' : '✗'}
                </div>
                <span className={s.present ? 'text-gray-700' : 'text-red-600 font-medium'}>
                  {s.name}
                </span>
                {!s.present && (
                  <span className="ml-auto text-[9px] text-red-400 shrink-0">Devamsız</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
