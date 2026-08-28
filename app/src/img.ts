// Compresión de fotos para la bitácora. El re-encode vía canvas tiene un efecto
// deliberado de privacidad: ELIMINA todos los metadatos EXIF (GPS incluido) —
// nunca guardamos la foto original.
export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('imagen ilegible'))
      i.src = url
    })
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    cv.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/jpeg', quality))
    if (!blob) throw new Error('no se pudo comprimir')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
