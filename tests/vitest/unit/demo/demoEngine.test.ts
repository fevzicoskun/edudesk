import { describe, it, expect } from 'vitest'
import { getCursorPos, getTotalProgress, formatTime, seekToRatio } from '@/app/demo/scenes'
import type { Scene, CursorStep } from '@/app/demo/scenes'

const makeScene = (duration: number): Scene => ({
  id: 'test',
  chapter: 'Test',
  screenshot: 'test.png',
  duration,
  caption: 'test',
})

describe('getCursorPos', () => {
  it('empty path returns null', () => {
    expect(getCursorPos([], 1000)).toBeNull()
  })

  it('elapsed before first step returns null', () => {
    const path: CursorStep[] = [{ x: 50, y: 50, delay: 1000 }]
    expect(getCursorPos(path, 500)).toBeNull()
  })

  it('interpolates between two steps', () => {
    const path: CursorStep[] = [
      { x: 0, y: 0, delay: 0 },
      { x: 100, y: 100, delay: 1000 },
    ]
    const pos = getCursorPos(path, 500)
    expect(pos).not.toBeNull()
    expect(pos!.x).toBeCloseTo(50)
    expect(pos!.y).toBeCloseTo(50)
  })

  it('elapsed after last step returns last position', () => {
    const path: CursorStep[] = [
      { x: 10, y: 20, delay: 0 },
      { x: 80, y: 90, delay: 1000 },
    ]
    const pos = getCursorPos(path, 2000)
    expect(pos).toEqual({ x: 80, y: 90 })
  })
})

describe('getTotalProgress', () => {
  const sceneList = [makeScene(2000), makeScene(3000), makeScene(1000)]

  it('sceneIdx=0, elapsed=0 returns 0', () => {
    expect(getTotalProgress(sceneList, 0, 0)).toBe(0)
  })

  it('last scene complete returns 1', () => {
    expect(getTotalProgress(sceneList, 2, 1000)).toBe(1)
  })

  it('middle of middle scene returns correct ratio', () => {
    const p = getTotalProgress(sceneList, 1, 1500)
    expect(p).toBeCloseTo(3500 / 6000)
  })

  it('empty list returns 0', () => {
    expect(getTotalProgress([], 0, 0)).toBe(0)
  })
})

describe('formatTime', () => {
  it('0ms returns "0:00"', () => expect(formatTime(0)).toBe('0:00'))
  it('65000ms returns "1:05"', () => expect(formatTime(65000)).toBe('1:05'))
  it('3600000ms returns "60:00"', () => expect(formatTime(3600000)).toBe('60:00'))
})

describe('seekToRatio', () => {
  const sceneList = [makeScene(2000), makeScene(3000), makeScene(1000)]

  it('ratio=0 returns scene 0, elapsed 0', () => {
    expect(seekToRatio(sceneList, 0)).toEqual({ sceneIdx: 0, elapsed: 0 })
  })

  it('ratio=0.5 returns inside scene 1', () => {
    const r = seekToRatio(sceneList, 0.5)
    expect(r.sceneIdx).toBe(1)
    expect(r.elapsed).toBeCloseTo(1000)
  })
})
