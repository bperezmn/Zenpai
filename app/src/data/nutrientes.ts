// Catálogo de líneas de nutrientes con su tabla de dosificación, en ml por litro de agua.
// Es la base del plan de riego preciso: el usuario elige su marca/línea y la app convierte la
// dosis de cada producto a su riego (ml/L × litros) según la etapa y, en floración, la semana.
//
// `verificado: true` = transcrita de la hoja oficial que tenemos a la vista (Emerald Harvest,
// tabla FCML1903-SP). El resto son las dosis de etiqueta / tabla pública del fabricante tal
// como las conocemos: hay que cotejarlas con la tabla vigente de cada marca antes de darlas
// por buenas (la app lo avisa). Las líneas que no estén aquí llegarán por la lectura de la
// tabla con IA, con esta misma estructura, y se revisan antes de publicarlas.
import { flipDayOf, flowerLenOf, type Substrate, type CicloInput } from '../lib'

export type EtapaDosis = 'esqueje' | 'trasplante' | 'veg' | 'flor'

export interface ProductoNutriente {
  id: string
  nombre: string
  rol: string           // qué hace, en una frase
  base?: boolean        // forma parte de la base (siempre) o es suplemento
}

export interface FaseDosis {
  etapa: EtapaDosis
  nombre: string        // como lo llama el fabricante
  semanaFlor?: number   // solo en floración: semana 1..N desde el 12/12
  tardia?: boolean      // veg: temprana (false) o tardía (true)
  lavado?: boolean      // flor: el lavado final del fabricante (solo agua o su producto de lavado)
  dosis: Record<string, number>  // producto id → ml por litro (los ausentes = no se usa)
}

export interface LineaNutrientes {
  id: string
  marca: string
  linea: string
  sustratos: Substrate[]
  unidad: 'ml/L'
  ph: [number, number]          // rango de pH de la solución ya mezclada
  aguaC?: [number, number]      // temperatura ideal del agua (°C)
  verificado: boolean
  organico?: boolean     // abono orgánico: en tierra, el lavado final es opcional (y la EC no sirve para dosificarlo)
  tierraMax?: number     // en tierra, como mucho esta fracción de la tabla (una tabla de hidro en tierra quema)
  fuente: string
  color: string          // color de marca para el monograma (mientras no haya logo oficial)
  logo?: string          // archivo en public/assets/marcas/ (logo oficial del kit de prensa; opcional)
  web?: string
  productos: ProductoNutriente[]
  fases: FaseDosis[]
  suplementos?: { id: string; nombre: string; rol: string; dosis: [number, number]; cuando: string }[]
  reglas: string[]
}

const veg = (nombre: string, tardia: boolean, dosis: Record<string, number>): FaseDosis => ({ etapa: 'veg', nombre, tardia, dosis })
const flor = (semanaFlor: number, nombre: string, dosis: Record<string, number>): FaseDosis => ({ etapa: 'flor', nombre, semanaFlor, dosis })
// la última fila de la tabla: el lavado final (vacío = solo agua)
const lavado = (semanaFlor: number, nombre: string, dosis: Record<string, number> = {}): FaseDosis => ({ etapa: 'flor', nombre, semanaFlor, dosis, lavado: true })

export const EMERALD_HARVEST_2PART: LineaNutrientes = {
  id: 'emerald-harvest-2part',
  color: '#1f8a3b',
  logo: 'emerald-harvest-2part',
  web: 'emeraldharvest.co',
  marca: 'Emerald Harvest',
  linea: 'Serie profesional de 2 partes',
  sustratos: ['tierra', 'coco', 'hidro'],
  unidad: 'ml/L',
  ph: [5.8, 6.3],
  aguaC: [16, 22],
  verificado: true,
  fuente: 'Tabla oficial FCML1903-SP (hoja del fabricante)',
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
    veg('Fase vegetativa temprana', false, { 'grow-a': 1, 'grow-b': 1, goddess: 1.5, honey: 1, root: 3.75 }),
    veg('Fase vegetativa tardía', true, { 'grow-a': 1.25, 'grow-b': 1.25, goddess: 1.5, honey: 1 }),
    flor(1, 'Transición', { 'grow-a': 1.25, 'grow-b': 1.25, goddess: 1.5, kola: 1, honey: 1 }),
    flor(2, 'Floración temprana', { 'bloom-a': 1.25, 'bloom-b': 1.25, goddess: 2, kola: 2, honey: 2, root: 3.75 }),
    flor(3, 'Floración temprana', { 'bloom-a': 1.25, 'bloom-b': 1.25, goddess: 2, kola: 2, honey: 2 }),
    flor(4, 'Floración intermedia', { 'bloom-a': 1.5, 'bloom-b': 1.5, goddess: 2.5, kola: 3, honey: 2 }),
    flor(5, 'Floración intermedia', { 'bloom-a': 1.5, 'bloom-b': 1.5, goddess: 2.5, kola: 3, honey: 2 }),
    flor(6, 'Floración tardía', { 'bloom-a': 1.5, 'bloom-b': 1.5, goddess: 2.5, kola: 2, honey: 2 }),
    flor(7, 'Floración tardía', { 'bloom-a': 1.5, 'bloom-b': 1.5, goddess: 2.5, kola: 2, honey: 2 }),
    flor(8, 'Maduración', { 'bloom-a': 1.5, 'bloom-b': 1.5, goddess: 1.25, kola: 1, honey: 1.5 }),
    lavado(9, 'Brote (lavado final)', { 'bloom-a': 0.25, 'bloom-b': 0.25, honey: 1.5 }),
  ],
  suplementos: [
    { id: 'cal-mag', nombre: 'Cal-Mag', rol: 'Suplemento de calcio-magnesio', dosis: [0.5, 1.25], cuando: 'Cuando haga falta, del primer vegetativo a la última floración, solo en días de riego.' },
    { id: 'sturdy-stalk', nombre: 'Sturdy Stalk', rol: 'Suplemento de silicato de potasio', dosis: [0.5, 1.25], cuando: 'Cuando haga falta, del primer vegetativo a la última floración, solo en días de riego.' },
  ],
  reglas: [
    'No premezclar los nutrientes concentrados.',
    'Llenar el depósito con agua y después agregar los nutrientes.',
    'Mezclar siempre A con agua fresca primero y luego agregar B.',
    'Para alargar el vegetativo, repetir semanas de la fase vegetativa tardía; para alargar la floración, semanas de la intermedia.',
  ],
}

// General Hydroponics · Flora Series (3 partes). Receta clásica de la etiqueta en cucharaditas
// por galón (3-2-1 / 2-2-2 / 1-2-3), pasada a ml/L (1 tsp/gal ≈ 1.32 ml/L).
export const GH_FLORA: LineaNutrientes = {
  id: 'gh-flora',
  color: '#1e7f45',
  logo: 'gh-flora',
  web: 'generalhydroponics.com',
  marca: 'General Hydroponics',
  linea: 'Flora Series (Gro · Micro · Bloom)',
  sustratos: ['hidro', 'coco', 'tierra'],
  unidad: 'ml/L',
  ph: [5.5, 6.5],
  verificado: false,
  // su tabla es de hidro; en tierra la propia marca pide la mitad (la 3-2-1 entera da EC ~1.8–2.1)
  tierraMax: 0.5,
  fuente: 'Receta de etiqueta (tsp/gal) convertida a ml/L',
  productos: [
    { id: 'gro', nombre: 'FloraGro', rol: 'Crecimiento estructural', base: true },
    { id: 'micro', nombre: 'FloraMicro', rol: 'Micronutrientes y base', base: true },
    { id: 'bloom', nombre: 'FloraBloom', rol: 'Floración y fruto', base: true },
  ],
  fases: [
    { etapa: 'esqueje', nombre: 'Esquejes y plántulas (media dosis)', dosis: { gro: 0.65, micro: 0.65, bloom: 0.65 } },
    { etapa: 'trasplante', nombre: 'Plántula establecida', dosis: { gro: 1.3, micro: 1.3, bloom: 1.3 } },
    veg('Crecimiento vegetativo (3-2-1)', false, { gro: 4, micro: 2.6, bloom: 1.3 }),
    veg('Crecimiento vegetativo (3-2-1)', true, { gro: 4, micro: 2.6, bloom: 1.3 }),
    flor(1, 'Transición (2-2-2)', { gro: 2.6, micro: 2.6, bloom: 2.6 }),
    flor(2, 'Transición (2-2-2)', { gro: 2.6, micro: 2.6, bloom: 2.6 }),
    flor(3, 'Floración (1-2-3)', { gro: 1.3, micro: 2.6, bloom: 4 }),
    flor(4, 'Floración (1-2-3)', { gro: 1.3, micro: 2.6, bloom: 4 }),
    flor(5, 'Floración (1-2-3)', { gro: 1.3, micro: 2.6, bloom: 4 }),
    flor(6, 'Floración (1-2-3)', { gro: 1.3, micro: 2.6, bloom: 4 }),
    flor(7, 'Floración (1-2-3)', { gro: 1.3, micro: 2.6, bloom: 4 }),
    flor(8, 'Maduración (0-1-2)', { micro: 1.3, bloom: 2.6 }),
    lavado(9, 'Lavado final: solo agua'),
  ],
  reglas: [
    'Agregar siempre FloraMicro al agua primero y mezclar bien antes del siguiente producto.',
    'En tierra, usar la mitad de la dosis las primeras semanas y observar la planta.',
  ],
}

// Canna · Terra (tierra). Esquema medio de la tabla de cultivo: Vega/Flores de 2 a 4 ml/L,
// Rhizotonic al inicio, Cannazym semanal, PK 13/14 una semana a mitad de floración, Boost al final.
export const CANNA_TERRA: LineaNutrientes = {
  id: 'canna-terra',
  color: '#e2231a',
  logo: 'canna-terra',
  web: 'canna.es',
  marca: 'Canna',
  linea: 'Terra (Vega · Flores)',
  sustratos: ['tierra'],
  unidad: 'ml/L',
  ph: [5.8, 6.2],
  verificado: false,
  fuente: 'Tabla de cultivo Canna Terra, esquema de alimentación medio',
  productos: [
    { id: 'vega', nombre: 'Terra Vega', rol: 'Base de crecimiento', base: true },
    { id: 'flores', nombre: 'Terra Flores', rol: 'Base de floración', base: true },
    { id: 'rhizo', nombre: 'Rhizotonic', rol: 'Estimulador de raíces' },
    { id: 'zym', nombre: 'Cannazym', rol: 'Enzimas (raíces muertas → nutrientes)' },
    { id: 'pk', nombre: 'PK 13/14', rol: 'Fósforo-potasio, una semana' },
    { id: 'boost', nombre: 'Cannaboost', rol: 'Acelerador de floración' },
  ],
  fases: [
    { etapa: 'trasplante', nombre: 'Plántula', dosis: { vega: 2, rhizo: 4 } },
    veg('Crecimiento (inicio)', false, { vega: 2.5, rhizo: 4, zym: 2.5 }),
    veg('Crecimiento (avanzado)', true, { vega: 3.5, zym: 2.5 }),
    flor(1, 'Inicio de floración', { flores: 2, zym: 2.5 }),
    flor(2, 'Inicio de floración', { flores: 2.5, zym: 2.5 }),
    flor(3, 'Floración', { flores: 3, boost: 2, zym: 2.5 }),
    flor(4, 'Floración', { flores: 3.5, boost: 2, zym: 2.5 }),
    flor(5, 'Floración + PK', { flores: 3.5, pk: 1.5, boost: 3, zym: 2.5 }),
    flor(6, 'Floración plena', { flores: 4, boost: 4, zym: 2.5 }),
    flor(7, 'Floración plena', { flores: 4, boost: 4, zym: 2.5 }),
    flor(8, 'Final', { flores: 3, boost: 4, zym: 2.5 }),
    lavado(9, 'Lavado final: solo agua'),
  ],
  reglas: [
    'El PK 13/14 se usa UNA semana (la 4ª–5ª de floración); no repetirlo.',
    'Cannazym cada riego o al menos una vez por semana.',
  ],
}

// Canna · Coco (A + B). Misma lógica que Terra con la base A/B de 2 a 4 ml/L, siempre en partes iguales.
export const CANNA_COCO: LineaNutrientes = {
  id: 'canna-coco',
  color: '#e2231a',
  logo: 'canna-coco',
  web: 'canna.es',
  marca: 'Canna',
  linea: 'Coco A + B',
  sustratos: ['coco'],
  unidad: 'ml/L',
  ph: [5.5, 6.2],
  verificado: false,
  fuente: 'Tabla de cultivo Canna Coco, esquema de alimentación medio',
  productos: [
    { id: 'a', nombre: 'Coco A', rol: 'Base, parte A (crecimiento y floración)', base: true },
    { id: 'b', nombre: 'Coco B', rol: 'Base, parte B', base: true },
    { id: 'rhizo', nombre: 'Rhizotonic', rol: 'Estimulador de raíces' },
    { id: 'zym', nombre: 'Cannazym', rol: 'Enzimas' },
    { id: 'pk', nombre: 'PK 13/14', rol: 'Fósforo-potasio, una semana' },
    { id: 'boost', nombre: 'Cannaboost', rol: 'Acelerador de floración' },
  ],
  fases: [
    { etapa: 'trasplante', nombre: 'Plántula', dosis: { a: 2, b: 2, rhizo: 4 } },
    veg('Crecimiento (inicio)', false, { a: 2.5, b: 2.5, rhizo: 4, zym: 2.5 }),
    veg('Crecimiento (avanzado)', true, { a: 3, b: 3, zym: 2.5 }),
    flor(1, 'Inicio de floración', { a: 3, b: 3, zym: 2.5 }),
    flor(2, 'Inicio de floración', { a: 3.5, b: 3.5, zym: 2.5 }),
    flor(3, 'Floración', { a: 3.5, b: 3.5, boost: 2, zym: 2.5 }),
    flor(4, 'Floración', { a: 4, b: 4, boost: 2, zym: 2.5 }),
    flor(5, 'Floración + PK', { a: 4, b: 4, pk: 1.5, boost: 3, zym: 2.5 }),
    flor(6, 'Floración plena', { a: 4, b: 4, boost: 4, zym: 2.5 }),
    flor(7, 'Floración plena', { a: 4, b: 4, boost: 4, zym: 2.5 }),
    flor(8, 'Final', { a: 3, b: 3, boost: 4, zym: 2.5 }),
    lavado(9, 'Lavado final: solo agua'),
  ],
  reglas: [
    'A y B siempre en la misma cantidad y nunca mezclados concentrados.',
    'En coco, regar a diario con drenaje del 10–20 %.',
  ],
}

// Advanced Nutrients · pH Perfect Sensi Grow / Sensi Bloom (A + B). Base a 4 ml/L; suplementos a 2 ml/L.
export const AN_SENSI: LineaNutrientes = {
  id: 'an-sensi',
  color: '#111111',
  logo: 'an-sensi',
  web: 'advancednutrients.com',
  marca: 'Advanced Nutrients',
  linea: 'pH Perfect Sensi Grow / Bloom A+B',
  sustratos: ['tierra', 'coco', 'hidro'],
  unidad: 'ml/L',
  ph: [5.5, 6.3],
  verificado: false,
  fuente: 'Dosis de etiqueta (base 4 ml/L, suplementos 2 ml/L) y calendario público del fabricante',
  productos: [
    { id: 'grow-a', nombre: 'Sensi Grow A', rol: 'Base de crecimiento, parte A', base: true },
    { id: 'grow-b', nombre: 'Sensi Grow B', rol: 'Base de crecimiento, parte B', base: true },
    { id: 'bloom-a', nombre: 'Sensi Bloom A', rol: 'Base de floración, parte A', base: true },
    { id: 'bloom-b', nombre: 'Sensi Bloom B', rol: 'Base de floración, parte B', base: true },
    { id: 'voodoo', nombre: 'Voodoo Juice', rol: 'Microbios para raíces' },
    { id: 'b52', nombre: 'B-52', rol: 'Vitaminas y vigor' },
    { id: 'bigbud', nombre: 'Big Bud', rol: 'Engorde de cogollos' },
    { id: 'candy', nombre: 'Bud Candy', rol: 'Carbohidratos y sabor' },
    { id: 'overdrive', nombre: 'Overdrive', rol: 'Empuje final' },
    { id: 'finish', nombre: 'Flawless Finish', rol: 'Lavado final' },
  ],
  fases: [
    { etapa: 'trasplante', nombre: 'Plántula (1/4 de dosis)', dosis: { 'grow-a': 1, 'grow-b': 1 } },
    veg('Vegetativo (semanas 1–2)', false, { 'grow-a': 4, 'grow-b': 4, voodoo: 2, b52: 2 }),
    veg('Vegetativo (semanas 3+)', true, { 'grow-a': 4, 'grow-b': 4, b52: 2 }),
    flor(1, 'Floración semana 1', { 'bloom-a': 4, 'bloom-b': 4, voodoo: 2, b52: 2, candy: 2 }),
    flor(2, 'Floración semana 2', { 'bloom-a': 4, 'bloom-b': 4, voodoo: 2, b52: 2, bigbud: 2, candy: 2 }),
    flor(3, 'Floración semana 3', { 'bloom-a': 4, 'bloom-b': 4, bigbud: 2, candy: 2 }),
    flor(4, 'Floración semana 4', { 'bloom-a': 4, 'bloom-b': 4, bigbud: 2, candy: 2 }),
    flor(5, 'Floración semana 5', { 'bloom-a': 4, 'bloom-b': 4, overdrive: 2, candy: 2 }),
    flor(6, 'Floración semana 6', { 'bloom-a': 4, 'bloom-b': 4, overdrive: 2, candy: 2 }),
    flor(7, 'Floración semana 7', { 'bloom-a': 4, 'bloom-b': 4, overdrive: 2, candy: 2 }),
    lavado(8, 'Lavado (Flawless Finish)', { finish: 2 }),
  ],
  reglas: [
    'Con pH Perfect no hace falta ajustar el pH si el agua de partida está entre 5.5 y 7.5.',
    'Big Bud en las semanas 2–4 de floración; Overdrive en las 5–7. Nunca los dos a la vez.',
  ],
}

// BioBizz (orgánico, tierra y coco). Bio-Grow sigue en floración como fuente de azúcares.
export const BIOBIZZ: LineaNutrientes = {
  id: 'biobizz',
  color: '#5aa02c',
  logo: 'biobizz',
  web: 'biobizz.com',
  marca: 'BioBizz',
  linea: 'Bio-Grow · Bio-Bloom · Top-Max',
  sustratos: ['tierra', 'coco'],
  unidad: 'ml/L',
  ph: [6.2, 6.8],
  verificado: false,
  organico: true,
  fuente: 'Tabla de cultivo BioBizz (resumen)',
  productos: [
    { id: 'root', nombre: 'Root-Juice', rol: 'Raíces (primeras semanas)' },
    { id: 'grow', nombre: 'Bio-Grow', rol: 'Crecimiento', base: true },
    { id: 'bloom', nombre: 'Bio-Bloom', rol: 'Floración', base: true },
    { id: 'topmax', nombre: 'Top-Max', rol: 'Estimulador de floración' },
    { id: 'heaven', nombre: 'Bio-Heaven', rol: 'Vigor y recuperación' },
  ],
  fases: [
    { etapa: 'trasplante', nombre: 'Plántula', dosis: { root: 4 } },
    veg('Crecimiento (inicio)', false, { root: 4, grow: 2, heaven: 2 }),
    veg('Crecimiento (avanzado)', true, { grow: 2, heaven: 2 }),
    flor(1, 'Floración semana 1', { grow: 2, bloom: 2, topmax: 1, heaven: 2 }),
    flor(2, 'Floración semana 2', { grow: 2, bloom: 2, topmax: 1, heaven: 2 }),
    flor(3, 'Floración semana 3', { grow: 3, bloom: 3, topmax: 2, heaven: 3 }),
    flor(4, 'Floración semana 4', { grow: 3, bloom: 3, topmax: 3, heaven: 3 }),
    flor(5, 'Floración semana 5', { grow: 4, bloom: 4, topmax: 4, heaven: 4 }),
    flor(6, 'Floración semana 6', { grow: 4, bloom: 4, topmax: 4, heaven: 4 }),
    flor(7, 'Floración semana 7', { grow: 4, bloom: 4, topmax: 4, heaven: 4 }),
    flor(8, 'Floración semana 8', { grow: 4, bloom: 4, topmax: 4 }),
    lavado(9, 'Lavado final: solo agua'),
  ],
  reglas: [
    'Orgánico: no hace falta medir EC; agitar bien las botellas antes de usar.',
    'Con agua muy blanda, añadir Cal-Mag orgánico (Calmag) 1 ml/L.',
  ],
}

// Plagron · Terra (tierra). Etiqueta: 3–5 ml/L; Power Roots y Green Sensation 1 ml/L.
export const PLAGRON_TERRA: LineaNutrientes = {
  id: 'plagron-terra',
  color: '#0b5fa5',
  logo: 'plagron-terra',
  web: 'plagron.com',
  marca: 'Plagron',
  linea: 'Terra Grow · Terra Bloom',
  sustratos: ['tierra'],
  unidad: 'ml/L',
  ph: [5.5, 6.5],
  verificado: false,
  fuente: 'Dosis de etiqueta y tabla Plagron Terra',
  productos: [
    { id: 'grow', nombre: 'Terra Grow', rol: 'Base de crecimiento', base: true },
    { id: 'bloom', nombre: 'Terra Bloom', rol: 'Base de floración', base: true },
    { id: 'roots', nombre: 'Power Roots', rol: 'Estimulador de raíces' },
    { id: 'green', nombre: 'Green Sensation', rol: 'Potenciador de floración (últimas 4 semanas)' },
  ],
  fases: [
    { etapa: 'trasplante', nombre: 'Plántula', dosis: { grow: 2, roots: 1 } },
    veg('Crecimiento (inicio)', false, { grow: 3, roots: 1 }),
    veg('Crecimiento (avanzado)', true, { grow: 4 }),
    flor(1, 'Floración semana 1', { bloom: 3 }),
    flor(2, 'Floración semana 2', { bloom: 3 }),
    flor(3, 'Floración semana 3', { bloom: 4 }),
    flor(4, 'Floración semana 4', { bloom: 4 }),
    flor(5, 'Floración semana 5', { bloom: 5, green: 1 }),
    flor(6, 'Floración semana 6', { bloom: 5, green: 1 }),
    flor(7, 'Floración semana 7', { bloom: 5, green: 1 }),
    flor(8, 'Floración semana 8', { bloom: 4, green: 1 }),
    lavado(9, 'Lavado final: solo agua'),
  ],
  reglas: ['Green Sensation solo en las últimas 4 semanas de floración.'],
}

// Hesi (tierra). Etiqueta: TNT Complex y Bloom Complex a 5 ml/L; Root 1–2 ml/L; PK 13/14 1.5 ml/L.
export const HESI_TIERRA: LineaNutrientes = {
  id: 'hesi-tierra',
  color: '#c8102e',
  logo: 'hesi-tierra',
  web: 'hesi.nl',
  marca: 'Hesi',
  linea: 'TNT Complex · Bloom Complex (tierra)',
  sustratos: ['tierra'],
  unidad: 'ml/L',
  ph: [5.8, 6.5],
  verificado: false,
  fuente: 'Dosis de etiqueta y tabla Hesi para tierra',
  productos: [
    { id: 'tnt', nombre: 'TNT Complex', rol: 'Base de crecimiento', base: true },
    { id: 'bloom', nombre: 'Bloom Complex', rol: 'Base de floración', base: true },
    { id: 'root', nombre: 'Hesi Root', rol: 'Raíces' },
    { id: 'pk', nombre: 'Hesi PK 13/14', rol: 'Fósforo-potasio (2ª mitad de floración)' },
    { id: 'boost', nombre: 'Boost', rol: 'Estimulador de floración' },
  ],
  fases: [
    { etapa: 'trasplante', nombre: 'Plántula', dosis: { tnt: 2.5, root: 2 } },
    veg('Crecimiento', false, { tnt: 5, root: 1 }),
    veg('Crecimiento', true, { tnt: 5 }),
    flor(1, 'Floración semana 1', { bloom: 5 }),
    flor(2, 'Floración semana 2', { bloom: 5, boost: 2 }),
    flor(3, 'Floración semana 3', { bloom: 5, boost: 2 }),
    flor(4, 'Floración semana 4', { bloom: 5, pk: 1.5, boost: 2 }),
    flor(5, 'Floración semana 5', { bloom: 5, pk: 1.5, boost: 2 }),
    flor(6, 'Floración semana 6', { bloom: 5, pk: 1.5, boost: 2 }),
    flor(7, 'Floración semana 7', { bloom: 5, pk: 1.5 }),
    lavado(8, 'Lavado final: solo agua'),
  ],
  reglas: ['Hesi está pensado para no tener que medir EC; con macetas pequeñas, bajar a la mitad.'],
}

// Top Crop (tierra y coco), muy extendido en Latinoamérica. Rangos de etiqueta 2–4 ml/L.
export const TOP_CROP: LineaNutrientes = {
  id: 'top-crop',
  color: '#2e7d32',
  logo: 'top-crop',
  web: 'top-crop.eu',
  marca: 'Top Crop',
  linea: 'Top Veg · Top Bloom · Big One',
  sustratos: ['tierra', 'coco'],
  unidad: 'ml/L',
  ph: [6.0, 6.5],
  verificado: false,
  fuente: 'Dosis de etiqueta y tabla Top Crop (resumen)',
  productos: [
    { id: 'deeper', nombre: 'Deeper Underground', rol: 'Estimulador de raíces' },
    { id: 'veg', nombre: 'Top Veg', rol: 'Base de crecimiento', base: true },
    { id: 'bloom', nombre: 'Top Bloom', rol: 'Base de floración', base: true },
    { id: 'candy', nombre: 'Top Candy', rol: 'Azúcares y sabor' },
    { id: 'bigone', nombre: 'Big One', rol: 'Engorde de cogollos' },
    { id: 'bud', nombre: 'Top Bud', rol: 'PK final' },
  ],
  fases: [
    { etapa: 'trasplante', nombre: 'Plántula', dosis: { deeper: 2, veg: 1 } },
    veg('Crecimiento (inicio)', false, { deeper: 2, veg: 2 }),
    veg('Crecimiento (avanzado)', true, { veg: 3 }),
    flor(1, 'Transición', { veg: 2, bloom: 2, deeper: 2 }),
    flor(2, 'Floración semana 2', { bloom: 3 }),
    flor(3, 'Floración semana 3', { bloom: 3, candy: 2 }),
    flor(4, 'Floración semana 4', { bloom: 4, candy: 2, bigone: 2 }),
    flor(5, 'Floración semana 5', { bloom: 4, candy: 2, bigone: 3, bud: 1 }),
    flor(6, 'Floración semana 6', { bloom: 4, candy: 2, bigone: 4, bud: 2 }),
    flor(7, 'Floración semana 7', { bloom: 4, candy: 2, bigone: 4, bud: 2 }),
    flor(8, 'Floración semana 8', { bloom: 3, candy: 2 }),
    lavado(9, 'Lavado final: solo agua'),
  ],
  reglas: ['Empezar por la dosis baja del rango y subir si la planta lo pide.'],
}

export const LINEAS: LineaNutrientes[] = [EMERALD_HARVEST_2PART, GH_FLORA, CANNA_TERRA, CANNA_COCO, AN_SENSI, BIOBIZZ, PLAGRON_TERRA, HESI_TIERRA, TOP_CROP]
export const lineaPorId = (id: string | null | undefined): LineaNutrientes | null => LINEAS.find((l) => l.id === id) ?? null

// "Otra marca": abona con su propio producto, sin tabla; la app lo guía por la EC de la etapa.
// (nutrientesId null = solo agua, que solo vale en tierra)
export const OTRA_MARCA = 'otra'
// La elección de abono que vale para ese sustrato: en coco e hidro no se cultiva solo con agua (el
// sustrato no trae comida: la planta pasa hambre en 1–2 semanas) y una línea que no es para ese
// sustrato (o que ya no está en el catálogo) pasa a "otra marca": sigue teniendo su botella.
export function nutrientesPara(id: string | null | undefined, sub: Substrate): string | null {
  if (id == null) return sub === 'tierra' ? null : OTRA_MARCA
  if (id === OTRA_MARCA) return id
  const l = lineaPorId(id)
  return l && l.sustratos.includes(sub) ? id : OTRA_MARCA
}

// ===== lavado final =====
// Empieza 10 días antes de la cosecha estimada (harvestEta) y dura como mucho eso: nunca se alarga
// con semanas de solo agua de más. Los días cuentan desde que empezó la flor (flipDayOf) sobre la
// floración de SU variedad (flowerLenOf), la misma cuenta que la fecha de cosecha.
export const LAVADO_DIAS = 10
type FaseInput = CicloInput
// días de floración con abono antes del lavado (al menos una semana, por si la flor es muy corta)
const diasConAbono = (c: FaseInput) => Math.max(7, flowerLenOf(c) - LAVADO_DIAS)
export function enLavado(c: FaseInput): boolean {
  return c.stage === 'flor' && c.day - flipDayOf(c) >= diasConAbono(c)
}
// el lavado lo marca la tabla (su última fila); una tabla sin él (o una fila vacía) = solo agua
const esLavado = (f: FaseDosis) => !!f.lavado || Object.keys(f.dosis).length === 0
const LAVADO_SOLO_AGUA: FaseDosis = { etapa: 'flor', nombre: 'Lavado final: solo agua', dosis: {}, lavado: true }

// una fila con PK 13/14 (Canna, Hesi) no se estira: la marca la quiere una semana, y más días de
// fósforo-potasio pueden bloquear otros nutrientes
const SEMANA_FIJA = 7
const esSemanaFija = (f: FaseDosis) => f.dosis.pk != null

// La fase de la tabla que toca hoy según la etapa del cultivo.
// Plántula: la fase de trasplante (o de esqueje). Vegetativo: 'temprana' hasta el día 30,
// 'tardía' después. Floración: las semanas con abono de la tabla se reparten en proporción sobre
// las semanas REALES de la variedad (una de 7 semanas las recorre más rápido; una de 12, más
// despacio), sin semanas de solo agua de más; los últimos 10 días, el lavado de la tabla. Si al
// estirar una fila pasaría de 7 días, las de PK se quedan en 7 y el resto se reparte entre las demás.
// Antes iba por semana absoluta: una variedad de 7 semanas nunca llegaba al lavado y una de 12
// recibía 2–4 semanas de solo agua justo cuando engordan los cogollos.
export function faseActual(linea: LineaNutrientes, c: FaseInput): FaseDosis | null {
  if (c.stage === 'plantula' || c.stage === 'germinacion') return linea.fases.find((f) => f.etapa === 'trasplante') ?? linea.fases.find((f) => f.etapa === 'esqueje') ?? null
  if (c.stage === 'veg') return linea.fases.find((f) => f.etapa === 'veg' && f.tardia === c.day > 30) ?? linea.fases.find((f) => f.etapa === 'veg') ?? null
  if (c.stage !== 'flor') return null
  const flores = linea.fases.filter((f) => f.etapa === 'flor')
  if (!flores.length) return null
  const conAbono = flores.filter((f) => !esLavado(f)).sort((a, b) => (a.semanaFlor ?? 0) - (b.semanaFlor ?? 0))
  const final = flores.find(esLavado) ?? LAVADO_SOLO_AGUA
  if (!conAbono.length || enLavado(c)) return final
  const d = Math.max(0, c.day - flipDayOf(c))
  const total = diasConAbono(c)
  const n = conAbono.length
  const fijas = conAbono.filter(esSemanaFija).length
  const igual = total / n
  const largo = (f: FaseDosis) => (igual <= SEMANA_FIJA || fijas === n ? igual
    : esSemanaFija(f) ? SEMANA_FIJA : (total - SEMANA_FIJA * fijas) / (n - fijas))
  let fin = 0
  for (const f of conAbono) { fin += largo(f); if (d < fin) return f }
  return conAbono[n - 1]
}
// semanas de floración de la variedad sobre las que se reparte la tabla (medias semanas: "8.5")
export const semanasFlorDe = (c: FaseInput) => Math.round((flowerLenOf(c) / 7) * 2) / 2

// Dosis en ml de cada producto para un riego de `litros` (redondeo a 0.1 ml). factor = la fuerza
// del abono (abonoDe: el nivel y, en tierra, el tope de la marca; 0.5 = media dosis de la tabla);
// por defecto, la tabla tal cual.
export function dosisRiego(linea: LineaNutrientes, fase: FaseDosis, litros: number, factor = 1): { producto: ProductoNutriente; ml: number; mlPorL: number }[] {
  return linea.productos
    .filter((p) => fase.dosis[p.id] != null)
    .map((p) => {
      const mlPorL = fase.dosis[p.id] * factor
      return { producto: p, mlPorL: Math.round(mlPorL * 100) / 100, ml: Math.round(mlPorL * litros * 10) / 10 }
    })
}
