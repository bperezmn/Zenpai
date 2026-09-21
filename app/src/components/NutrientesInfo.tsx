import type { LineaNutrientes } from '../data/nutrientes'
import { useBackClose } from '../useBackClose'
import BrandMark from './BrandMark'

// Ficha de una línea de nutrientes: su tabla de dosis completa (fases × productos, en ml/L),
// pH y agua, suplementos y reglas del fabricante. Se abre desde el selector y desde la ficha de riego.
export default function NutrientesInfo({ linea, onClose }: { linea: LineaNutrientes; onClose: () => void }) {
  useBackClose(true, onClose)
  const cols = linea.productos
  const semana = (f: LineaNutrientes['fases'][number]) => f.etapa === 'flor' ? `S${f.semanaFlor}` : f.etapa === 'veg' ? (f.tardia ? 'Veg+' : 'Veg') : f.etapa === 'trasplante' ? 'Plánt.' : 'Esq.'
  return (
    <div className="absolute inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7 max-h-[88%] flex flex-col"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full flex-none" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex items-center gap-3 mb-1 flex-none">
          <BrandMark linea={linea} size={44} />
          <div className="min-w-0 flex-1">
            <div className="display font-semibold text-[1.05rem] leading-tight">{linea.marca}</div>
            <div className="label truncate" style={{ fontSize: '.58rem' }}>{linea.linea}</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center flex-none" style={{ border: '1px solid rgba(255,255,255,.28)', borderRadius: 5, color: '#fff', background: 'transparent' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 flex-none">
          <span className="label" style={{ fontSize: '.56rem' }}>{linea.sustratos.join(' · ')}</span>
          <span className="label" style={{ fontSize: '.56rem' }}>pH {linea.ph[0]}–{linea.ph[1]}</span>
          {linea.aguaC && <span className="label" style={{ fontSize: '.56rem' }}>agua {linea.aguaC[0]}–{linea.aguaC[1]} °C</span>}
          <span className="label" style={{ fontSize: '.56rem', color: linea.verificado ? 'var(--blue)' : 'var(--warn)' }}>{linea.verificado ? 'tabla oficial verificada' : 'dosis de etiqueta · compara con tu botella'}</span>
        </div>

        <div className="overflow-y-auto -mx-1 px-1" style={{ minHeight: 0 }}>
          <div className="label mb-1.5">Tabla · ml por litro</div>
          <div className="overflow-x-auto" style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 5 }}>
            <table className="mono" style={{ borderCollapse: 'collapse', fontSize: '.66rem', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: '#0b0c0f', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,.14)', color: 'var(--faint)', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', fontSize: '.52rem', whiteSpace: 'nowrap' }}>Fase</th>
                  {cols.map((p) => (
                    <th key={p.id} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,.14)', color: 'var(--muted)', fontWeight: 500, fontSize: '.52rem', letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{p.nombre.replace(/^Cali Pro |^Terra |^Sensi |^Bio-|^Top /, '')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linea.fases.map((f, i) => (
                  <tr key={i}>
                    <td style={{ position: 'sticky', left: 0, background: '#0b0c0f', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,.08)', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#fff' }}>{semana(f)}</span> <span style={{ color: 'var(--faint)', fontSize: '.56rem' }}>{f.nombre}</span>
                    </td>
                    {cols.map((p) => (
                      <td key={p.id} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,.08)', textAlign: 'center', color: f.dosis[p.id] != null ? '#fff' : 'rgba(255,255,255,.25)' }}>{f.dosis[p.id] ?? '–'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="label mt-4 mb-1.5">Productos</div>
          <div className="space-y-1.5">
            {cols.map((p) => (
              <div key={p.id} className="flex items-baseline justify-between gap-3 text-[.78rem]">
                <span className="font-medium">{p.nombre}{p.base ? <span className="label ml-2" style={{ fontSize: '.5rem' }}>base</span> : null}</span>
                <span style={{ color: 'var(--muted)', textAlign: 'right' }}>{p.rol}</span>
              </div>
            ))}
          </div>

          {linea.suplementos && linea.suplementos.length > 0 && (
            <>
              <div className="label mt-4 mb-1.5">Suplementos</div>
              <div className="space-y-1.5">
                {linea.suplementos.map((sp) => (
                  <div key={sp.id} className="text-[.78rem]">
                    <span className="font-medium">{sp.nombre}</span> <span className="mono" style={{ color: 'var(--muted)' }}>{sp.dosis[0] === sp.dosis[1] && sp.dosis[0] === 0 ? '' : `${sp.dosis[0]}–${sp.dosis[1]} ml/L`}</span>
                    <div style={{ color: 'var(--faint)', fontSize: '.7rem' }}>{sp.rol}. {sp.cuando}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="label mt-4 mb-1.5">Reglas del fabricante</div>
          <ul className="space-y-1 text-[.76rem] pl-4" style={{ color: 'var(--muted)', listStyle: 'disc' }}>
            {linea.reglas.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <p className="text-[.62rem] mt-4" style={{ color: 'var(--faint)' }}>
            Fuente: {linea.fuente}.{linea.web ? ` Más en ${linea.web}.` : ''} Las marcas y logos pertenecen a sus dueños; se muestran solo para identificar tus productos.
          </p>
        </div>
        <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      </div>
    </div>
  )
}
