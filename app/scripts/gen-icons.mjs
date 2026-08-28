// Genera los íconos PNG de la PWA desde los SVG (iOS no renderiza íconos SVG).
// Uso (en contenedor Node con sharp): node gen-icons.mjs <publicDir>
import sharp from 'sharp'

const dir = process.argv[2] || '.'
async function png(svg, size, out, bg) {
  let s = sharp(`${dir}/${svg}`, { density: 384 }).resize(size, size, {
    fit: 'contain',
    background: bg || { r: 0, g: 0, b: 0, alpha: 0 },
  })
  if (bg) s = s.flatten({ background: bg })
  await s.png().toFile(`${dir}/${out}`)
  console.log('✓', out, `${size}×${size}`)
}

await png('icono-zenpai.svg', 192, 'pwa-192.png')
await png('icono-zenpai.svg', 512, 'pwa-512.png')
await png('icono-maskable.svg', 512, 'maskable-512.png')
await png('icono-zenpai.svg', 180, 'apple-touch-icon.png', '#0a1310')
