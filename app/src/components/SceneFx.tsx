import { useEffect, useRef } from 'react'
import type { SceneState } from '../lib'

// Vida dentro de la carpa, dibujada en tiempo real sobre la foto (como el hero de AC Infinity,
// que tampoco es un vídeo): vapor que sube hacia el filtro, aspas del ventilador girando y el
// halo de la LED. Todo reacciona a los datos: ventilador/extractor encendidos, luz, humedad.
//
// Las posiciones son fracciones de la foto (999×1792, la misma carpa en todas las fotos) y se
// proyectan al contenedor con la misma regla que `object-fit: cover`, así siguen alineadas en
// cualquier tamaño de pantalla.
const IMG_W = 999, IMG_H = 1792
const FAN = { x: 0.27, y: 0.48, r: 0.072 }         // ventilador clip (radio = fracción del ancho)
const LED = { x0: 0.24, x1: 0.72, y: 0.335 }       // barra LED
const INTAKE = { x: 0.40, y: 0.23 }                // boca del filtro de carbón: hacia ahí tira el vapor
const DOOR: [number, number][] = [[0.13, 0.06], [0.66, 0.06], [0.72, 0.075], [0.76, 0.13], [0.76, 0.93], [0.13, 0.93]]

type Particle = { x: number; y: number; vx: number; vy: number; r: number; peak: number; life: number; max: number; phase: number }

type Props = {
  active: boolean
  fan: boolean
  exhaust: boolean
  light: boolean
  state: SceneState
  humidity: number | null
}

export default function SceneFx({ active, fan, exhaust, light, state, humidity }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const props = useRef({ active, fan, exhaust, light, state, humidity })
  props.current = { active, fan, exhaust, light, state, humidity }

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // sprite de vapor: un disco difuso pre-dibujado (dibujar gradientes por partícula sería caro)
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 128
    const sc = sprite.getContext('2d')!
    const g = sc.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    sc.fillStyle = g; sc.fillRect(0, 0, 128, 128)

    let W = 0, H = 0, dpr = 1
    let dw = 0, dh = 0, ox = 0, oy = 0 // la foto dibujada con object-fit: cover
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      W = r.width; H = r.height
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const s = Math.max(W / IMG_W, H / IMG_H)
      dw = IMG_W * s; dh = IMG_H * s; ox = (W - dw) / 2; oy = (H - dh) / 2
    }
    const px = (fx: number) => ox + fx * dw
    const py = (fy: number) => oy + fy * dh
    resize()
    const ro = new ResizeObserver(resize); ro.observe(canvas)

    const parts: Particle[] = []
    let angle = 0, spin = 0, t = 0, flicker = 0.08, raf = 0
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    const spawn = (): Particle => ({
      x: px(rnd(0.2, 0.72)), y: py(rnd(0.78, 0.9)), vx: 0, vy: 0,
      r: rnd(0.018, 0.04) * dh, peak: rnd(0.07, 0.14), life: 0, max: rnd(170, 280), phase: rnd(0, Math.PI * 2),
    })

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const p = props.current
      t++
      ctx.clearRect(0, 0, W, H)
      if (!p.active || document.hidden) return
      const night = !p.light || p.state === 'noche'

      ctx.save()
      ctx.beginPath()
      DOOR.forEach(([fx, fy], i) => (i ? ctx.lineTo(px(fx), py(fy)) : ctx.moveTo(px(fx), py(fy))))
      ctx.closePath(); ctx.clip()

      // --- halo de la LED (titileo casi imperceptible) ---
      if (!night) {
        if (t % 6 === 0) flicker = 0.07 + Math.random() * 0.025
        const cx = px((LED.x0 + LED.x1) / 2), cy = py(LED.y + 0.015)
        const rx = (LED.x1 - LED.x0) * 0.62 * dw, ry = 0.07 * dh
        const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx)
        hg.addColorStop(0, `rgba(255,244,214,${flicker})`); hg.addColorStop(1, 'rgba(255,244,214,0)')
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy)
        ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = hg
        ctx.beginPath(); ctx.arc(cx, cy, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      }

      // --- vapor: sube, ondula y, con el extractor encendido, tira hacia el filtro ---
      const hr = p.humidity ?? 55
      const target = (p.fan || p.exhaust ? 22 : 12) + (hr > 70 ? 22 : hr > 60 ? 12 : 0)
      if (parts.length < target && t % 4 === 0) parts.push(spawn())
      const speed = (p.fan ? 1.5 : 1) * (dh / IMG_H) * 0.62
      const tx = px(INTAKE.x), ty = py(INTAKE.y)
      ctx.globalCompositeOperation = 'screen'
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i]
        q.life++
        q.vy += -0.012 * speed
        q.vy = Math.max(q.vy, -1.1 * speed)
        if (p.exhaust) { q.vx += (tx - q.x) * 0.00035; q.vy += (ty - q.y) * 0.00012 }
        q.x += q.vx + Math.sin(t * 0.02 + q.phase) * 0.35
        q.y += q.vy
        q.r += 0.06
        const k = q.life / q.max
        const env = k < 0.2 ? k / 0.2 : k > 0.7 ? (1 - k) / 0.3 : 1
        const a = q.peak * env * (night ? 0.55 : 1)
        if (q.life >= q.max || q.y < ty - 0.03 * dh || parts.length > target + 10) { parts.splice(i, 1); continue }
        ctx.globalAlpha = a
        if (night) ctx.filter = 'hue-rotate(200deg) saturate(.6)'
        ctx.drawImage(sprite, q.x - q.r, q.y - q.r, q.r * 2, q.r * 2)
        ctx.filter = 'none'
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      // --- ventilador: aspas girando bajo la rejilla de la foto ---
      spin += ((p.fan ? 0.42 : 0) - spin) * 0.06
      angle += spin
      const fx = px(FAN.x), fy = py(FAN.y), fr = FAN.r * dw
      ctx.save(); ctx.translate(fx, fy)
      ctx.globalCompositeOperation = 'multiply'
      const copies = spin > 0.05 ? 3 : 1
      for (let c = 0; c < copies; c++) {
        ctx.save(); ctx.rotate(angle - c * spin * 0.6)
        ctx.globalAlpha = copies === 1 ? 0.28 : 0.13
        ctx.fillStyle = '#0a0b0d'
        for (let b = 0; b < 5; b++) {
          ctx.rotate((Math.PI * 2) / 5)
          ctx.beginPath(); ctx.moveTo(0, 0)
          ctx.quadraticCurveTo(fr * 0.55, -fr * 0.42, fr * 0.92, -fr * 0.12)
          ctx.quadraticCurveTo(fr * 0.6, fr * 0.1, 0, 0); ctx.fill()
        }
        ctx.restore()
      }
      ctx.restore()
      ctx.restore()
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />
}
