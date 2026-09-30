// ===== "muéstrame cómo": secuencias de fotos paso a paso (reemplazan al video) =====
// Cada how-to es 2–5 fotos fijas con un texto corto; el visor las pasa con fundido/zoom.
// Fotos del set «estilo AC Infinity» (sept. 2026): la misma carpa detrás, luz blanca neutra, mesa
// negra y las mismas manos con manga negra; todas 9:16 con el tercio de abajo oscuro para el texto.
// Las anteriores están archivadas en app/_assets_ia_antiguas/howto-v1/.
import type { Guide, SeedType, Stage, Substrate } from './lib'
import { targetFor, fmtRange } from './mentor'
const A = (n: string) => `${import.meta.env.BASE_URL}assets/${n}.webp`

// encuadre opcional por paso: zoom (1 = la foto entera a lo alto) y el punto de la foto que
// queda fijo al acercar (x/y en %, por defecto el centro). Anclado abajo (y 100), un zoom de
// ~1.1 esconde lo que sobra arriba, bajo el título, sin tocar el archivo.
export interface HowToStep { img: string; caption: string; zoom?: number; focus?: { x: number; y: number } }
// id: la marca de "ya la vio" (howtoSeen en el store). Se guarda en el teléfono: no se renombra.
export interface HowToDef { id: string; title: string; steps: HowToStep[] }

// fotos compartidas por varias guías (el set nuevo ya viene encuadrado: sin zoom ni foco)
const AGUA_3 = { img: A('howto-agua-3') }
const REGAR_2 = { img: A('howto-regar-2') }
const VASO_PLANTULA = { img: A('howto-transplante-3') } // el vaso junto al tallo de la plántula
const APICAL_1 = { img: A('howto-apical-1') }
const APICAL_2 = { img: A('howto-apical-2') }
const APICAL_3 = { img: A('howto-apical-3') }
const DEFOL_1 = { img: A('howto-defol-1') }
const DEFOL_2 = { img: A('howto-defol-2') }
const DEFOL_3 = { img: A('howto-defol-3') }

export const HOWTOS = {
  germinacion: {
    id: 'germinacion',
    title: 'Cómo germinar en agua',
    steps: [
      { img: A('howto-germ-1'), caption: 'Llena un vaso con agua sin cloro a temperatura ambiente. Si es de la llave, déjala reposar unas horas destapada.' },
      { img: A('howto-germ-2'), caption: 'Deja caer las semillas y pon el vaso en un lugar oscuro y tibio, a 22–26 °C. No lo muevas.' },
      { img: A('howto-germ-3'), caption: 'Revisa cada día: en 1–2 días se abren y asoma la raíz blanca; en cuanto la veas, a trasplantar. Máximo 2 días en agua: las que no se abran, pásalas a servilleta húmeda o directo a la tierra, a 1 cm.' },
    ],
  },
  transplante: {
    id: 'transplante',
    title: 'Cómo trasplantar',
    steps: [
      { img: A('howto-transplante-1'), caption: 'En cuanto asome la raíz blanca (de medio a 2 cm), saca la semilla del agua con mucho cuidado. Tócala lo menos posible.' },
      { img: A('howto-transplante-2'), caption: 'Haz un hoyo de unos 1–2 cm en el sustrato húmedo y mete la raíz hacia abajo. Cubre suave, sin apretar.' },
      { img: A('howto-transplante-3'), caption: 'Dale un primer riego ligero (un vaso) cerca del tallo. Listo: ya es una plántula.' },
    ],
  },
  // hidro: la semilla va al taco de la cestita, sin hoyo en la tierra ni vaso de riego: el taco
  // se moja con un chorrito y el nivel del depósito toca la cestita mientras las raíces no llegan
  // al agua (ver mentor). Mismas fotos hasta que haya de hidro.
  transplanteHidro: {
    id: 'transplanteHidro',
    title: 'Cómo trasplantar',
    steps: [
      { img: A('howto-transplante-1'), caption: 'En cuanto asome la raíz blanca (de medio a 2 cm), saca la semilla del agua con mucho cuidado. Tócala lo menos posible.' },
      { img: A('howto-transplante-2'), caption: 'Mete la semilla en el taco de la cestita, a unos 1–2 cm y con la raíz hacia abajo. Cubre suave, sin apretar.' },
      { ...VASO_PLANTULA, caption: 'Moja el taco con un chorrito de agua de pH ajustado y llena el depósito hasta que toque la base de la cestita. Listo: ya es una plántula.' },
    ],
  },
  // «nudo» se explica en el primer paso: es la primera vez que la guía lo nombra
  apical: {
    id: 'apical',
    title: 'Poda apical',
    steps: [
      { ...APICAL_1, caption: 'Solo en vegetativo, con al menos 4–5 nudos (un nudo es donde nacen las hojas del tallo). Localiza la punta principal y el nudo justo debajo.' },
      { ...APICAL_2, caption: 'Con tijeras limpias corta la punta por encima de ese nudo. Un corte limpio, sin rasgar el tallo.' },
      { ...APICAL_3, caption: 'En una semana salen dos puntas donde había una: la planta crece más ancha y pareja. No la riegues de más esos días.' },
    ],
  },
  defoliacion: {
    id: 'defoliacion',
    title: 'Defoliación ligera',
    steps: [
      { ...DEFOL_1, caption: 'Abre la copa y mira dentro: busca las hojas grandes que tapan las ramas bajas o se tocan entre sí.' },
      { ...DEFOL_2, caption: 'Corta esas hojas por el pecíolo (el tallito de la hoja), pegado a la rama. Máximo un 20–30 % del follaje, nunca las hojas de las puntas.' },
      { ...DEFOL_3, caption: 'Deja que la planta se recupere 10–14 días antes de repetir. Aire y luz llegan ahora a toda la planta.' },
    ],
  },
  // autoflorecientes: viven 8–11 semanas y no recuperan lo que pierden por un corte.
  // Mismas fotos; cambia lo que se permite cortar.
  apicalAuto: {
    id: 'apicalAuto',
    title: 'Poda apical',
    steps: [
      { ...APICAL_1, caption: 'En una autofloreciente, solo con 4–5 nudos (donde nacen las hojas del tallo), en los días que te damos en Hoy y con la planta sana. Localiza la punta y el nudo justo debajo.' },
      { ...APICAL_2, caption: 'Con tijeras limpias corta la punta por encima de ese nudo. Un corte limpio, sin rasgar el tallo.' },
      { ...APICAL_3, caption: 'En una semana salen dos puntas donde había una. No repitas el corte: no le daría tiempo a recuperarse. No la riegues de más esos días.' },
    ],
  },
  defoliacionAuto: {
    id: 'defoliacionAuto',
    title: 'Defoliación ligera',
    steps: [
      { ...DEFOL_1, caption: 'Abre la copa y mira dentro: busca solo las hojas grandes que tapan las ramas bajas.' },
      { ...DEFOL_2, caption: 'Corta esas hojas por el pecíolo (el tallito de la hoja), pegado a la rama. En una autofloreciente, pocas: se recupera poco. Nunca las hojas de las puntas.' },
      { ...DEFOL_3, caption: 'No repitas en 10–14 días. Aire y luz llegan ahora a las ramas de abajo.' },
    ],
  },
} satisfies Record<string, HowToDef>

// cualquier guía que un consejo pueda abrir con «Ver cómo» (las de riego se arman por etapa)
export type HowToId = keyof typeof HOWTOS | 'riego' | 'riegoPlantula'

// el trasplante que toca según el sustrato (en hidro no hay hoyo en la tierra ni vaso de riego)
export const transplanteHowTo = (sub: Substrate): HowToDef =>
  sub === 'hidro' ? HOWTOS.transplanteHidro : HOWTOS.transplante

// el paso del pH con el rango de SU sustrato: la app ya lo sabe, no hace falta escribir los dos.
// Sin cultivo (la lista de Mis cultivos) no se sabe: van los de tierra y coco
const pasoPh = (stage: Stage, sub: Substrate | null): HowToStep => ({
  img: A('howto-agua-2'),
  caption: sub
    ? `Mide el pH. En ${sub}, las raíces solo absorben bien con pH ${fmtRange(targetFor('ph', stage, sub), 1)}.`
    : `Mide el pH. Las raíces solo absorben bien con pH ${fmtRange(targetFor('ph', stage, 'tierra'), 1)} en tierra y ${fmtRange(targetFor('ph', stage, 'coco'), 1)} en coco.`,
})

// riego desde vegetativo: la cantidad de la ficha, que sube por semanas; con la cantidad
// completa, hasta que drene un poco (limpia sales). Antes, sin drenaje (ver mentor rampaRiego).
const riego = (stage: Stage, sub: Substrate | null): HowToDef => ({
  id: 'riego',
  title: 'Cómo regar',
  steps: [
    { img: A('howto-agua-1'), caption: 'Prepara tu agua. El agua de la llave casi siempre necesita un ajuste antes de usarla.' },
    pasoPh(stage, sub),
    { ...AGUA_3, caption: 'Si el pH está alto, bájalo con unas gotas de «pH-» y vuelve a medir. Ajústalo antes de regar, nunca después.' },
    { img: A('howto-regar-1'), caption: 'Riega despacio, en círculo alrededor del tallo. Sin encharcar de golpe.' },
    { ...REGAR_2, caption: 'Riega los litros de la ficha. Si la ficha lo pide, sigue hasta que drene un 10–20 % por abajo (limpia sales) y tira ese drenaje.' },
  ],
})
// riego de la plántula: un vaso junto al tallo y SIN drenaje. En una maceta de 11–19 L, regar
// hasta que drene son litros sobre una planta de días (exceso de riego desde el primer toque).
// Las fotos del agua y el mismo nº de pasos que `riego` (la del drenaje no: enseñaría justo lo
// que no hay que hacer): si la etapa cambia con el visor abierto, el paso actual sigue existiendo.
const riegoPlantula = (stage: Stage, sub: Substrate | null): HowToDef => ({
  id: 'riegoPlantula',
  title: 'Cómo regar la plántula',
  steps: [
    { img: A('howto-agua-1'), caption: 'Prepara un vaso de agua (unos 0.2 L). El agua de la llave casi siempre necesita un ajuste antes de usarla.' },
    pasoPh(stage, sub),
    { ...AGUA_3, caption: 'Si el pH está alto, bájalo con unas gotas de «pH-» y vuelve a medir. Ajústalo antes de regar, nunca después.' },
    { ...VASO_PLANTULA, caption: 'Vierte el vaso despacio, en círculo cerca del tallo, sin que salga agua por abajo. Sus raíces aún son pequeñas: el agua de más las ahoga.' },
    { img: A('howto-plantula-dedo'), caption: 'Solo se moja alrededor del tallo, y así debe ser. Riega otra vez solo cuando los primeros 2 cm estén secos: mete el dedo a unos 3 cm del tallo para comprobarlo.' },
  ],
})

// el "cómo regar" que toca según la etapa: todo lo que abre el how-to de riego pasa por aquí
// (germinación solo aparece en datos viejos y es aún más joven que la plántula). Se guarda
// una por combinación: el visor recibe siempre el mismo objeto mientras no cambie nada.
const riegoCache = new Map<string, HowToDef>()
export const riegoHowTo = (stage: Stage, sub: Substrate | null): HowToDef => {
  const plantula = stage === 'plantula' || stage === 'germinacion'
  const key = `${plantula ? 'p' : 'v'}-${sub ?? 'todos'}`
  let def = riegoCache.get(key)
  if (!def) { def = plantula ? riegoPlantula(stage, sub) : riego(stage, sub); riegoCache.set(key, def) }
  return def
}

// ===== el catálogo: la pestaña Guías (Hoy › Guías y Mis cultivos) y qué guía se abre sola =====
export interface Guia {
  id: HowToId
  titulo: string
  resumen: string               // una línea para la lista
  etapas: Stage[]               // cuándo toca; la primera la agrupa en la lista
  nivel: Guide                  // desde qué nivel se enseña
  semilla?: SeedType            // solo autoflorecientes o solo fotoperiódicas
  sustratos?: Substrate[]       // solo en esos sustratos (en hidro no se riega)
  variante?: string             // etiqueta de la versión, para la lista sin cultivo (salen todas)
  seguridad?: boolean           // evita un daño serio: en nivel medio también se abre sola
  portada?: string              // la foto de la lista, si la del paso 1 se parece a las de otras guías
  def: (sub: Substrate | null) => HowToDef   // sin cultivo, sub = null
}
const TIERRA_COCO: Substrate[] = ['tierra', 'coco']
// una entrada por guía (el tipo obliga a que estén todas), en el orden del ciclo
const CATALOGO: Record<HowToId, Omit<Guia, 'id'>> = {
  germinacion: { titulo: HOWTOS.germinacion.title, resumen: 'Las semillas en un vaso de agua hasta que asome la raíz.',
    etapas: ['remojo'], nivel: 'novato', portada: A('howto-germ-3'), def: () => HOWTOS.germinacion },
  transplante: { titulo: HOWTOS.transplante.title, resumen: 'Pasa la semilla con raíz a la maceta sin lastimarla.',
    etapas: ['remojo'], nivel: 'novato', sustratos: TIERRA_COCO, variante: 'Tierra y coco', portada: A('howto-transplante-2'), def: () => HOWTOS.transplante },
  transplanteHidro: { titulo: HOWTOS.transplanteHidro.title, resumen: 'Pasa la semilla con raíz al taco de la cestita.',
    etapas: ['remojo'], nivel: 'novato', sustratos: ['hidro'], variante: 'Hidro', portada: A('howto-transplante-1'), def: () => HOWTOS.transplanteHidro },
  riegoPlantula: { titulo: 'Cómo regar la plántula', resumen: 'Un vaso junto al tallo, sin que salga agua por abajo.',
    etapas: ['plantula', 'germinacion'], nivel: 'novato', sustratos: TIERRA_COCO, portada: A('howto-plantula-dedo'), def: (sub) => riegoHowTo('plantula', sub) },
  riego: { titulo: 'Cómo regar', resumen: 'El pH ajustado antes de regar y, cuando la ficha lo pida, hasta que drene.',
    etapas: ['veg', 'flor', 'cosecha'], nivel: 'novato', sustratos: TIERRA_COCO, seguridad: true, portada: A('howto-regar-1'), def: (sub) => riegoHowTo('veg', sub) },
  apical: { titulo: HOWTOS.apical.title, resumen: 'Corta la punta principal para que salgan dos.',
    etapas: ['veg'], nivel: 'medio', semilla: 'foto', variante: 'Fotoperiódicas', portada: A('howto-apical-2'), def: () => HOWTOS.apical },
  apicalAuto: { titulo: HOWTOS.apicalAuto.title, resumen: 'Un solo corte y a tiempo: una autofloreciente se recupera poco.',
    etapas: ['veg'], nivel: 'avanzado', semilla: 'auto', variante: 'Autoflorecientes', portada: A('howto-apical-3'), def: () => HOWTOS.apicalAuto },
  defoliacion: { titulo: HOWTOS.defoliacion.title, resumen: 'Quita las hojas grandes que tapan las ramas de abajo.',
    etapas: ['flor', 'veg'], nivel: 'medio', semilla: 'foto', variante: 'Fotoperiódicas', portada: A('howto-defol-2'), def: () => HOWTOS.defoliacion },
  defoliacionAuto: { titulo: HOWTOS.defoliacionAuto.title, resumen: 'Pocas hojas y solo las que tapan: se recupera poco.',
    etapas: ['flor', 'veg'], nivel: 'medio', semilla: 'auto', variante: 'Autoflorecientes', portada: A('howto-defol-1'), def: () => HOWTOS.defoliacionAuto },
}
export const GUIAS: Guia[] = (Object.keys(CATALOGO) as HowToId[]).map((id) => ({ id, ...CATALOGO[id] }))
// la guía con el texto de SU sustrato (sin cultivo, null)
export const guiaDef = (id: HowToId, sub: Substrate | null): HowToDef => CATALOGO[id].def(sub)

const RANGO: Record<Guide, number> = { novato: 0, medio: 1, avanzado: 2 }
// las guías de tu nivel; con cultivo, solo las de su semilla y su sustrato (sin cultivo, todas las
// versiones). Ninguna se bloquea por etapa: lo que viene también se puede leer
export function guiasPara(guide: Guide, c: { seedType: SeedType; substrate: Substrate } | null): Guia[] {
  return GUIAS.filter((g) => RANGO[guide] >= RANGO[g.nivel]
    && (!c || ((!g.semilla || g.semilla === c.seedType) && (!g.sustratos || g.sustratos.includes(c.substrate)))))
}

// ¿se abre sola? La única regla de la app (el momento lo decide cada pantalla):
// novato: los momentos clave, como mucho una guía por sesión; medio: solo las de seguridad;
// avanzado: nunca (le quedan «Ver cómo» y Hoy › Guías). Una guía ya vista no se abre sola. Las
// de seguridad no cuentan para el tope. Al decir que sí, la guía se queda con el lugar de la
// sesión: si la misma se vuelve a pedir (StrictMode) sigue valiendo. Si la cerró antes del
// final (cerroSola), no vuelve a salir sola en esta sesión: el siguiente toque sigue de largo.
let abiertaSola: string | null = null   // la que se abrió sola en esta sesión (se borra al recargar)
const cerradas = new Set<string>()      // las que se abrieron solas y cerró antes del final
export function cerroSola(id: string) { cerradas.add(id) }
export function abreSola(id: string, guide: Guide, seen: Record<string, number>): boolean {
  if (seen[id] || cerradas.has(id) || guide === 'avanzado') return false
  if (GUIAS.some((g) => g.id === id && g.seguridad)) return true
  if (guide !== 'novato' || (abiertaSola !== null && abiertaSola !== id)) return false
  abiertaSola = id
  return true
}
