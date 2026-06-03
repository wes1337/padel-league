import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'public')

const sourceSvg = await readFile(join(publicDir, 'icon-512.svg'))

const outputs = [
  { file: 'icon-180.png', size: 180, purpose: 'iOS apple-touch-icon' },
  { file: 'icon-192.png', size: 192, purpose: 'PWA any (Android home screen)' },
  { file: 'icon-512.png', size: 512, purpose: 'PWA any / store listings' },
  { file: 'favicon-32.png', size: 32, purpose: 'browser tab favicon' },
]

for (const { file, size, purpose } of outputs) {
  await sharp(sourceSvg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } })
    .png()
    .toFile(join(publicDir, file))
  console.log(`✓ ${file} (${size}x${size}) — ${purpose}`)
}

// Maskable icon: scale content to ~80% inside a dark safe-zone background.
// Android masks the corners into a circle; content outside the inner 80% can be cropped.
const maskableSize = 512
const innerSize = Math.round(maskableSize * 0.8)
const innerBuffer = await sharp(sourceSvg, { density: 384 })
  .resize(innerSize, innerSize)
  .png()
  .toBuffer()

await sharp({
  create: {
    width: maskableSize,
    height: maskableSize,
    channels: 4,
    background: { r: 10, g: 10, b: 10, alpha: 1 },
  },
})
  .composite([{ input: innerBuffer, gravity: 'center' }])
  .png()
  .toFile(join(publicDir, 'icon-512-maskable.png'))
console.log('✓ icon-512-maskable.png (512x512) — PWA maskable (Android adaptive)')

console.log('\nAll icons written to public/.')
