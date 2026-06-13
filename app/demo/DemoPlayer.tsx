'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  scenes,
  getCursorPos,
  getTotalProgress,
  getTotalDuration,
  formatTime,
  seekToRatio,
} from './scenes'

const TICK_MS = 16

export default function DemoPlayer() {
  const [sceneIdx, setSceneIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [imgError, setImgError] = useState(false)
  const [activeClicks, setActiveClicks] = useState<{ id: number; x: number; y: number }[]>([])
  const clickIdRef = useRef(0)
  const prevClicksRef = useRef<Set<number>>(new Set())

  const scene = scenes[sceneIdx]
  const progress = getTotalProgress(scenes, sceneIdx, elapsed)
  const totalMs = getTotalDuration(scenes)
  const doneMs = scenes.slice(0, sceneIdx).reduce((s, sc) => s + sc.duration, 0)
  const isFinished = sceneIdx === scenes.length - 1 && elapsed >= scene.duration

  useEffect(() => {
    setImgError(false)
  }, [sceneIdx])

  useEffect(() => {
    if (!playing || isFinished) return
    const id = setInterval(() => {
      setElapsed(e => {
        const next = e + TICK_MS
        if (next >= scenes[sceneIdx].duration) {
          if (sceneIdx < scenes.length - 1) {
            setSceneIdx(i => i + 1)
            prevClicksRef.current = new Set()
            return 0
          }
          setPlaying(false)
          return scenes[sceneIdx].duration
        }
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [playing, sceneIdx, isFinished])

  useEffect(() => {
    if (!scene.clicks) return
    scene.clicks.forEach((click, i) => {
      const key = sceneIdx * 1000 + i
      if (elapsed >= click.delay && elapsed < click.delay + TICK_MS * 2 && !prevClicksRef.current.has(key)) {
        prevClicksRef.current.add(key)
        const clickId = ++clickIdRef.current
        setActiveClicks(cs => [...cs, { id: clickId, x: click.x, y: click.y }])
        setTimeout(() => setActiveClicks(cs => cs.filter(c => c.id !== clickId)), 600)
      }
    })
  }, [elapsed, sceneIdx, scene.clicks])

  const seek = useCallback((ratio: number) => {
    const r = seekToRatio(scenes, ratio)
    setSceneIdx(r.sceneIdx)
    setElapsed(r.elapsed)
    prevClicksRef.current = new Set()
  }, [])

  const jumpToChapter = useCallback((chapterName: string) => {
    const idx = scenes.findIndex(s => s.chapter === chapterName)
    if (idx === -1) return
    setSceneIdx(idx)
    setElapsed(0)
    prevClicksRef.current = new Set()
    setPlaying(true)
  }, [])

  const restart = useCallback(() => {
    setSceneIdx(0)
    setElapsed(0)
    prevClicksRef.current = new Set()
    setPlaying(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying(p => !p)
      }
      if (e.code === 'ArrowRight') seek(Math.min(1, progress + 0.05))
      if (e.code === 'ArrowLeft') seek(Math.max(0, progress - 0.05))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seek, progress])

  const chapters = Array.from(new Set(scenes.map(s => s.chapter)))
  const cursorPos = scene.cursorPath ? getCursorPos(scene.cursorPath, elapsed) : null

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-xl">EduDesk</span>
          <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">Demo</span>
        </div>
        <a
          href="/login"
          className="bg-white text-slate-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          Giris Yap -&gt;
        </a>
      </header>

      <div className="flex gap-2 px-6 py-3 border-b border-slate-800 overflow-x-auto">
        {chapters.map(ch => {
          const active = scene.chapter === ch
          return (
            <button
              key={ch}
              onClick={() => jumpToChapter(ch)}
              className={`whitespace-nowrap text-sm px-3 py-1.5 rounded-full transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {ch}
            </button>
          )
        })}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-4">
        <div
          className="relative w-full max-w-4xl bg-slate-900 rounded-xl overflow-hidden shadow-2xl"
          style={{ aspectRatio: '16/9' }}
        >
          {!imgError && (
            <img
              key={scene.screenshot}
              src={`/demo/${scene.screenshot}`}
              alt={scene.chapter}
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
          {imgError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-400 text-2xl font-medium">
              {scene.chapter}
            </div>
          )}

          {scene.highlights?.map((h, i) => {
            const show = elapsed >= (h.delay ?? 0)
            return (
              <div
                key={i}
                className="absolute border-2 border-yellow-400 rounded pointer-events-none transition-opacity duration-300"
                style={{
                  left: `${h.x}%`,
                  top: `${h.y}%`,
                  width: `${h.width}%`,
                  height: `${h.height}%`,
                  opacity: show ? 1 : 0,
                }}
              >
                {h.label && (
                  <span className="absolute -top-6 left-0 bg-yellow-400 text-yellow-900 text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap">
                    {h.label}
                  </span>
                )}
              </div>
            )
          })}

          {cursorPos && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: `${cursorPos.x}%`,
                top: `${cursorPos.y}%`,
                transform: 'translate(-4px, -4px)',
                transition: 'left 80ms linear, top 80ms linear',
              }}
            >
              <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                <path
                  d="M2 2L18 12L10 13L6 22L2 2Z"
                  fill="black"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}

          {activeClicks.map(click => (
            <div
              key={click.id}
              className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${click.x}%`, top: `${click.y}%` }}
            >
              <div className="w-8 h-8 rounded-full border-2 border-blue-400 animate-ping" />
            </div>
          ))}

          {isFinished && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-4">
              <p className="text-white text-xl font-medium">Demo tamamlandi</p>
              <button
                onClick={restart}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-500 transition-colors"
              >
                Yeniden Baslat
              </button>
              <a
                href="/login"
                className="text-slate-300 hover:text-white underline text-sm transition-colors"
              >
                EduDesk'e Basla -&gt;
              </a>
            </div>
          )}
        </div>

        <div className="w-full max-w-4xl space-y-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={e => seek(Number(e.target.value))}
            className="w-full h-1.5 accent-blue-500 cursor-pointer"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => isFinished ? restart() : setPlaying(p => !p)}
              className="text-white bg-slate-700 hover:bg-slate-600 w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
              aria-label={playing ? 'Duraklat' : 'Oynat'}
            >
              {playing && !isFinished ? (
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 14 14">
                  <rect x="2" y="1" width="4" height="12" rx="1" />
                  <rect x="8" y="1" width="4" height="12" rx="1" />
                </svg>
              ) : (
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 14 14">
                  <path d="M3 2L12 7L3 12V2Z" />
                </svg>
              )}
            </button>

            <span className="text-slate-400 text-sm tabular-nums flex-shrink-0">
              {formatTime(doneMs + elapsed)} / {formatTime(totalMs)}
            </span>

            <p className="text-slate-300 text-sm truncate">
              {scene.caption}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
