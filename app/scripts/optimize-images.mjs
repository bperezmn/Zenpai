// Optimiza las imágenes IA: JPG enormes → WebP responsivo (solo reduce, nunca agranda).
// Uso (en contenedor Node con sharp): node optimize-images.mjs <dir>
import sharp from 'sharp'
import { readdirSync, statSync, renameSync } from 'fs'

const dir = process.argv[2] || '.'
const files = readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort()
let before = 0, after = 0

for (const f of files) {
  const src = `${dir}/${f}`
  const out = `${dir}/${f.replace(/\.jpg$/, '.webp')}`
  const b = statSync(src).size
  before += b
  await sharp(src)
    .resize({ width: 1024, height: 1792, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(out + '.tmp')
  renameSync(out + '.tmp', out)
  const a = statSync(out).size
  after += a
  console.log(`${f.padEnd(24)} ${(b / 1048576).toFixed(1)}MB → ${(a / 1024 | 0)}KB`)
}
console.log(`\nTOTAL  ${(before / 1048576 | 0)}MB → ${((after / 1048576) * 10 | 0) / 10}MB  (${files.length} imágenes)`)
