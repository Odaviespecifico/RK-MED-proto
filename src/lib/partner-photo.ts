export async function preparePartnerPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) throw new Error('Escolha uma imagem de até 10 MB.')
  const image = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale)
    const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível preparar a foto.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a foto.')), 'image/jpeg', 0.86))
  } finally { image.close() }
}

