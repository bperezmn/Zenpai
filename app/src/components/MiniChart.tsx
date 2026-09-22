// Gráfica mínima de una serie de lecturas: línea blanca, banda azul del objetivo,
// puntos fuera de rango en ámbar y la última lectura destacada. Sin ejes: es para leer la tendencia.
export default function MiniChart({ points, band, width, height, unit }: {
  points: { ts: number; value: number }[]
  band?: [number, number]      // rango objetivo (lo, hi)
  width: number
  height: number
  unit?: string
}) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center text-center text-[.76rem] leading-snug px-4" style={{ minHeight: height, color: 'var(--faint)' }}>
        Anota al menos dos lecturas para ver la gráfica.
      </div>
    )
  }
  const pad = 5
  const vals = points.map((p) => p.value)
  let lo = Math.min(...vals, ...(band ?? []))
  let hi = Math.max(...vals, ...(band ?? []))
  const span = hi - lo || Math.abs(hi) * 0.1 || 1
  lo -= span * 0.12
  hi += span * 0.12
  const t0 = points[0].ts
  const t1 = points[points.length - 1].ts
  const x = (ts: number, i: number) => pad + (t1 > t0 ? (ts - t0) / (t1 - t0) : i / (points.length - 1)) * (width - 2 * pad)
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height - 2 * pad)
  const out = (v: number) => !!band && (v < band[0] || v > band[1])
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.ts, i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const lx = x(last.ts, points.length - 1)
  const ly = y(last.value)
  const u = unit ? ` ${unit}` : ''
  const n = (v: number) => String(+v.toFixed(2))
  const label = `${points.length} lecturas. La última, ${n(last.value)}${u}${band ? `. Objetivo ${n(band[0])}–${n(band[1])}${u}` : ''}.`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={label} style={{ display: 'block', height: 'auto' }}>
      {band && <rect x={0} y={y(band[1])} width={width} height={Math.max(0, y(band[0]) - y(band[1]))} style={{ fill: 'rgba(31,115,183,.16)' }} />}
      <path d={path} fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.slice(0, -1).map((p, i) => out(p.value)
        ? <circle key={i} cx={x(p.ts, i)} cy={y(p.value)} r={2.6} style={{ fill: 'var(--warn)' }} />
        : null)}
      <circle cx={lx} cy={ly} r={3.2} style={{ fill: out(last.value) ? 'var(--warn)' : '#fff', stroke: out(last.value) ? '#fff' : 'none', strokeWidth: 1.2 }} />
    </svg>
  )
}
