// Catálogo de líneas de nutrientes con su tabla de dosificación oficial, en ml por litro de
// agua. Es la base del "plan de riego preciso": el usuario elige su marca/línea y la app
// convierte la dosis de cada producto a su maceta (ml/L × litros de riego) según la etapa y,
// en floración, la semana. Las líneas que no estén aquí llegarán por la lectura de la tabla
// con IA (misma estructura) y se revisan antes de publicarlas.
//
// Primera línea: Emerald Harvest · serie profesional de 2 partes (tabla FCML1903-SP,
// transcrita de la hoja oficial). Válida para tierra, coco e hidro (sistemas recirculantes o
// de drenaje).
export type EtapaDosis = 'esqueje' | 'trasplante' | 'veg' | 'flor'

export interface ProductoNutriente {
  id: string
  nombre: string
  rol: string           // qué hace, en una frase
  base?: boolean        // forma parte de la base A/B (siempre) o es suplemento
}

export interface FaseDosis {
  etapa: EtapaDosis
  nombre: string        // como lo llama el fabricante
  semanaFlor?: number   // solo en floración: semana 1..N desde el 12/12
  tardia?: boolean      // veg: 'temprana' (false) o 'tardía' (true)
  dosis: Record<string, number>  // producto id → ml por litro (los ausentes = no se usa)
}

export interface LineaNutrientes {
  id: string
  marca: string
  linea: string
  unidad: 'ml/L'
  ph: [number, number]          // rango de pH de la solución ya mezclada
  aguaC: [number, number]       // temperatura ideal del agua (°C)
  productos: ProductoNutriente[]
  fases: FaseDosis[]
  suplementos: { id: string; nombre: string; rol: string; dosis: [number, number]; cuando: string }[]
  reglas: string[]
}

export const EMERALD_HARVEST_2PART: LineaNutrientes = {
  id: 'emerald-harvest-2part',
  marca: 'Emerald Harvest',
  linea: 'Serie profesional de nutrientes de 2 partes',
  unidad: 'ml/L',
  ph: [5.8, 6.3],
  aguaC: [16, 22],
  productos: [
    { id: 'grow-a', nombre: 'Cali Pro Grow A', rol: 'Base de crecimiento, parte A', base: true },
    { id: 'grow-b', nombre: 'Cali Pro Grow B', rol: 'Base de crecimiento, parte B', base: true },
    { id: 'bloom-a', nombre: 'Cali Pro Bloom A', rol: 'Base de floración, parte A', base: true },
    { id: 'bloom-b', nombre: 'Cali Pro Bloom B', rol: 'Base de floración, parte B', base: true },
    { id: 'goddess', nombre: 'Emerald Goddess', rol: 'Tónico de plantas' },
    { id: 'kola', nombre: 'King Kola', rol: 'Acelerador de floración' },
    { id: 'honey', nombre: 'Honey Chome', rol: 'Enriquecedor de aroma y resina' },
    { id: 'root', nombre: 'Root Wizard', rol: 'Creador masivo de raíces' },
  ],
  fases: [
    { etapa: 'esqueje', nombre: 'Vástagos y esquejes', dosis: { 'grow-a': 0.5, 'grow-b': 0.5 } },
    { etapa: 'trasplante', nombre: 'Trasplantes', dosis: { 'grow-a': 0.75, 'grow-b': 0.75 } },
    { etapa: 'veg', nombre: 'Fase vegetativa temprana', tardia: false, dosis: { 'grow-a': 1, 'grow-b': 1, goddess: 1.5, honey: 1, root: 3.75 } },
    { etapa: 'veg', nombre: 'Fase vegetativa tardía', tardia: true, dosis: { 'grow-a': 1.25, 'grow-b': 1.25, goddess: 1.5, honey: 1 } },
    { etapa: 'flor', nombre: 'Transición', semanaFlor: 1, dosis: { 'grow-a': 1.25, 'grow-b': 1.25, goddess: 1.5, kola: 1, honey: 1 } },
    { etapa: 'flor', nombre: 'Floración temprana', semanaFlor: 2, dosis: { 'bloom-a': 1.25, 'bloom-b': 1.25, goddess: 2, kola: 2, honey: 2, root: 3.75 } },
    { etapa: 'flor', nombre: 'Floración temprana', semanaFlor: 3, dosis: { 'bloom-a': 1.25, 'bloom-b': 1.25, goddess: 2, kola: 2, honey: 2 } },
    { etapa: 'flor', nombre: 'Floración intermedia', semanaFlor: 4, dosis: { 'bloom-a': 1.5, 'bloom-b': 1.5, goddess: 2.5, kola: 3, honey: 2 } },
    { etapa: 'flor', nombre: 'Floración intermedia', semanaFlor: 5, dosis: { 'bloom-a': 1.5, 'bloom-b': 1.5, goddess: 2.5, kola: 3, honey: 2 } },
    { etapa: 'flor', nombre: 'Floración tardía', semanaFlor: 6, dosis: { 'bloom-a': 1.5, 'bloom-b': 1.5, goddess: 2.5, kola: 2, honey: 2 } },
    { etapa: 'flor', nombre: 'Floración tardía', semanaFlor: 7, dosis: { 'bloom-a': 1.5, 'bloom-b': 1.5, goddess: 2.5, kola: 2, honey: 2 } },
    { etapa: 'flor', nombre: 'Maduración', semanaFlor: 8, dosis: { 'bloom-a': 1.5, 'bloom-b': 1.5, goddess: 1.25, kola: 1, honey: 1.5 } },
    { etapa: 'flor', nombre: 'Brote (lavado final)', semanaFlor: 9, dosis: { 'bloom-a': 0.25, 'bloom-b': 0.25, honey: 1.5 } },
  ],
  suplementos: [
    { id: 'cal-mag', nombre: 'Cal-Mag', rol: 'Suplemento de calcio-magnesio', dosis: [0.5, 1.25], cuando: 'Cuando haga falta, de la primera fase vegetativa a la última de floración, solo en días de riego.' },
    { id: 'sturdy-stalk', nombre: 'Sturdy Stalk', rol: 'Suplemento de silicato de potasio', dosis: [0.5, 1.25], cuando: 'Cuando haga falta, de la primera fase vegetativa a la última de floración, solo en días de riego.' },
    { id: 'ph-up', nombre: 'pH Up', rol: 'Alcalinizante de pH', dosis: [0, 0], cuando: 'De a poco, midiendo el pH hasta llegar al rango deseado.' },
    { id: 'ph-down', nombre: 'pH Down', rol: 'Acidificador de pH', dosis: [0, 0], cuando: 'De a poco, midiendo el pH hasta llegar al rango deseado.' },
  ],
  reglas: [
    'No premezclar los nutrientes concentrados.',
    'Llenar el depósito con agua y después agregar los nutrientes.',
    'Mezclar siempre A con agua fresca primero y luego agregar B.',
    'Para alargar el vegetativo, repetir una o más semanas de la fase vegetativa tardía.',
    'Para alargar la floración, repetir una o más semanas de la floración intermedia.',
    'Vigilar las plantas ante cualquier señal de estrés si se sigue un programa más agresivo.',
  ],
}

export const LINEAS: LineaNutrientes[] = [EMERALD_HARVEST_2PART]

// La fase que toca según la etapa del cultivo y, en floración, la semana desde el 12/12.
// Vegetativo: 'temprana' hasta el día 30, 'tardía' después. Más allá de la última semana de
// floración de la tabla, se repite la última (el fabricante indica repetir la intermedia
// para alargar; eso lo decide el usuario).
export function faseActual(linea: LineaNutrientes, etapa: 'plantula' | 'veg' | 'flor', dia: number, semanaFlor: number | null): FaseDosis | null {
  if (etapa === 'plantula') return linea.fases.find((f) => f.etapa === 'trasplante') ?? null
  if (etapa === 'veg') return linea.fases.find((f) => f.etapa === 'veg' && f.tardia === dia > 30) ?? null
  const flores = linea.fases.filter((f) => f.etapa === 'flor')
  if (!flores.length) return null
  const w = Math.max(1, semanaFlor ?? 1)
  return flores.find((f) => f.semanaFlor === w) ?? flores[flores.length - 1]
}

// Dosis en ml de cada producto para un riego de `litros` (redondeo a 0.1 ml).
export function dosisRiego(linea: LineaNutrientes, fase: FaseDosis, litros: number): { producto: ProductoNutriente; ml: number; mlPorL: number }[] {
  return linea.productos
    .filter((p) => fase.dosis[p.id] != null)
    .map((p) => ({ producto: p, mlPorL: fase.dosis[p.id], ml: Math.round(fase.dosis[p.id] * litros * 10) / 10 }))
}
