import { readFile } from 'node:fs/promises'
import { localClients } from './local.mjs'
const { service } = localClients()
const image = await readFile(new URL('../../tests/fixtures/face-portrait.jpg', import.meta.url))
for (const suffix of ['000000000001', '000000000002']) {
  const path = `00000000-0000-4000-8000-${suffix}/photo.jpg`
  const { error } = await service.storage.from('member-photos').upload(path, image, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`Não foi possível preparar foto sintética: ${error.message}`)
}
console.log('Fotos sintéticas preparadas no Storage privado local. Nenhum serviço externo foi usado.')
