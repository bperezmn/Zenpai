// ===== "muéstrame cómo": secuencias de fotos paso a paso (reemplazan al video) =====
// Cada how-to es 2–4 fotos fijas con un texto corto; el visor las pasa con fundido/zoom.
// Por ahora reutilizan imágenes existentes como demo; se cambian por fotos dedicadas cuando se generen.
const A = (n: string) => `${import.meta.env.BASE_URL}assets/${n}.webp`

export interface HowToStep { img: string; caption: string }
export interface HowToDef { title: string; steps: HowToStep[] }

export const HOWTOS: Record<string, HowToDef> = {
  // TODO arte dedicado (howto-germ-1/2/3, mismo bloque de estilo: mano sin guantes, macro,
  // fondo oscuro). Mientras: mismo recuento de semillas en los 3 pasos — la única
  // diferencia visible entre pasos es el brote, no un nº de semillas que confunda.
  germinacion: {
    title: 'Cómo germinar en agua',
    steps: [
      { img: A('agua-3'), caption: 'Llena un vaso con agua sin cloro a temperatura ambiente (si es del grifo, déjala reposar unas horas destapada).' },
      { img: A('agua-3'), caption: 'Deja caer las semillas y pon el vaso en un sitio oscuro y templado (22–26°). No lo muevas.' },
      { img: A('agua-3-brote'), caption: 'Revisa cada día: cuando la raíz blanca mida 1–2 cm, a trasplantar. Máximo 4 días en agua: más tiempo se ahogan.' },
    ],
  },
  transplante: {
    title: 'Cómo trasplantar',
    steps: [
      { img: A('howto-transplante-1'), caption: 'Cuando la raíz blanca mida ~1–2 cm, saca la semilla del agua con mucho cuidado (tócala lo menos posible).' },
      { img: A('howto-transplante-2'), caption: 'Haz un hoyo de ~1–2 cm en el sustrato húmedo y mete la raíz hacia abajo. Cubre suave, sin apretar.' },
      { img: A('howto-transplante-3'), caption: 'Dale un primer riego ligero (un vaso) cerca del tallo. Listo: ya es una plántula.' },
    ],
  },
  riego: {
    title: 'Tu primer riego',
    steps: [
      { img: A('howto-agua-1'), caption: 'Prepara tu agua. El agua del grifo casi siempre necesita un ajuste antes de usarla.' },
      { img: A('howto-agua-2'), caption: 'Mide el pH. Las raíces solo absorben bien entre 6.2–7.0 (tierra) o 5.5–6.2 (coco/hidro).' },
      { img: A('howto-agua-3'), caption: 'Si el pH está alto, bájalo con unas gotas de «pH-» y vuelve a medir. Ajústalo antes de regar, nunca después.' },
      { img: A('howto-regar-1'), caption: 'Riega despacio, en círculo alrededor del tallo. Sin encharcar de golpe.' },
      { img: A('howto-regar-2'), caption: 'Sigue hasta que drene un 10–20 % por abajo (limpia sales). Tira ese drenaje. Listo.' },
    ],
  },
  apical: {
    title: 'Poda apical (topping)',
    steps: [
      { img: A('howto-apical-1'), caption: 'Solo en vegetativo, con al menos 4–5 pares de hojas. Localiza la punta principal y el nudo justo debajo.' },
      { img: A('howto-apical-2'), caption: 'Con tijeras limpias corta la punta por encima de ese nudo. Un corte limpio, sin rasgar el tallo.' },
      { img: A('howto-apical-3'), caption: 'En una semana salen dos puntas donde había una: la planta crece más ancha y pareja. No la riegues de más esos días.' },
    ],
  },
  defoliacion: {
    title: 'Defoliación ligera',
    steps: [
      { img: A('howto-defol-1'), caption: 'Abre la copa y mira dentro: busca las hojas grandes que tapan las ramas bajas o se tocan entre sí.' },
      { img: A('howto-defol-2'), caption: 'Corta esas hojas por el pecíolo, pegado a la rama. Máximo un 20–30 % del follaje, nunca las hojas de las puntas.' },
      { img: A('howto-defol-3'), caption: 'Deja que la planta se recupere 10–14 días antes de repetir. Aire y luz llegan ahora a toda la planta.' },
    ],
  },
}
