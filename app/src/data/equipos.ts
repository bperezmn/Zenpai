// Catálogo corto de equipo popular para carpas. Solo modelos reales y datos que conocemos
// seguro; lo que no está aquí se escribe a mano («Otro») y se guarda como texto libre.
// watts = consumo real de la luz (para los W/m²); controlaLuz = puede encender y apagar la luz.

export type EquipoCat = 'luz' | 'aire' | 'ctrl' | 'vent'

export interface Equipo {
  id: string
  cat: EquipoCat
  marca: string
  modelo: string
  watts?: number
  controlaLuz?: boolean
  nota?: string
}

export const CATEGORIAS: { id: EquipoCat; label: string }[] = [
  { id: 'luz', label: 'Luz' },
  { id: 'aire', label: 'Extracción' },
  { id: 'ctrl', label: 'Controlador' },
  { id: 'vent', label: 'Ventilador' },
]

export const EQUIPOS: Equipo[] = [
  // luces LED
  { id: 'sf-1000', cat: 'luz', marca: 'Spider Farmer', modelo: 'SF-1000', watts: 100 },
  { id: 'sf-2000', cat: 'luz', marca: 'Spider Farmer', modelo: 'SF-2000', watts: 200 },
  { id: 'sf-4000', cat: 'luz', marca: 'Spider Farmer', modelo: 'SF-4000', watts: 450 },
  { id: 'mh-ts1000', cat: 'luz', marca: 'Mars Hydro', modelo: 'TS 1000', watts: 150 },
  { id: 'mh-ts3000', cat: 'luz', marca: 'Mars Hydro', modelo: 'TS 3000', watts: 450 },
  { id: 'vv-vs1000', cat: 'luz', marca: 'Vivosun', modelo: 'VS1000', watts: 100 },
  { id: 'vv-vs2000', cat: 'luz', marca: 'Vivosun', modelo: 'VS2000', watts: 200 },
  { id: 'aci-s22', cat: 'luz', marca: 'AC Infinity', modelo: 'IONBOARD S22', watts: 100 },
  { id: 'aci-s24', cat: 'luz', marca: 'AC Infinity', modelo: 'IONBOARD S24', watts: 200 },
  // extracción
  { id: 'aci-t4', cat: 'aire', marca: 'AC Infinity', modelo: 'CLOUDLINE T4' },
  { id: 'aci-t6', cat: 'aire', marca: 'AC Infinity', modelo: 'CLOUDLINE T6' },
  { id: 'aci-s4', cat: 'aire', marca: 'AC Infinity', modelo: 'CLOUDLINE S4' },
  { id: 'aci-s6', cat: 'aire', marca: 'AC Infinity', modelo: 'CLOUDLINE S6' },
  // controladores: el 69 PRO gobierna luces con puerto UIS (las de AC Infinity); con otra luz, depende
  { id: 'aci-c69pro', cat: 'ctrl', marca: 'AC Infinity', modelo: 'CONTROLLER 69 PRO', nota: 'Si enciende tu luz, márcalo en el horario de luz.' },
  { id: 'temporizador', cat: 'ctrl', marca: '', modelo: 'Temporizador enchufable', controlaLuz: true },
  // ventiladores de pinza
  { id: 'aci-cloudray-s6', cat: 'vent', marca: 'AC Infinity', modelo: 'CLOUDRAY S6' },
  { id: 'sj-monkey', cat: 'vent', marca: 'Secret Jardin', modelo: 'Monkey Fan' },
]

export function equipoPorId(id?: string | null): Equipo | null {
  if (!id) return null
  return EQUIPOS.find((e) => e.id === id) ?? null
}

export function porCategoria(cat: EquipoCat): Equipo[] {
  return EQUIPOS.filter((e) => e.cat === cat)
}

// nombre para mostrar: el del catálogo o el texto libre tal cual lo escribió el usuario
export function nombreEquipo(v?: string | null): string | null {
  if (!v) return null
  const e = equipoPorId(v)
  if (!e) return v
  return e.marca ? `${e.marca} ${e.modelo}` : e.modelo
}
