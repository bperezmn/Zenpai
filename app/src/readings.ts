// ===== historial de lecturas: la serie de una métrica a partir de la bitácora =====
import type { GrowEvent, MetricKey } from './lib'
import { metricDef } from './mentor'

export interface ReadingPoint { ts: number; day: number; value: number }

// Los eventos 'medicion' nuevos traen metric/value; los viejos solo el texto
// ("pH 6.5 · en rango", "Temp 25 °C · en rango", "HR 48% · al límite"): se leen por la etiqueta.
export function readingSeries(events: GrowEvent[], key: MetricKey, fromTs?: number): ReadingPoint[] {
  const label = metricDef(key).label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const legacy = new RegExp(`^${label}\\s+(-?\\d+(?:[.,]\\d+)?)`)
  const out: ReadingPoint[] = []
  for (const ev of events) {
    if (ev.type !== 'medicion') continue
    if (fromTs != null && ev.ts < fromTs) continue
    let value: number | null = null
    if (ev.metric != null) {
      if (ev.metric === key && typeof ev.value === 'number' && Number.isFinite(ev.value)) value = ev.value
    } else {
      const m = legacy.exec(ev.note ?? '')
      if (m) value = parseFloat(m[1].replace(',', '.'))
    }
    if (value !== null && Number.isFinite(value)) out.push({ ts: ev.ts, day: ev.day, value })
  }
  return out.sort((a, b) => a.ts - b.ts)
}
