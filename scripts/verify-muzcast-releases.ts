import {
  PRODUCTS,
  download,
  release,
  verifyApk,
} from '../src/main/muzcast-release'
async function main() {
  for (const p of ['launcher', 'muzcast'] as const) {
    const m = release(
      p,
      JSON.parse(
        (await download(PRODUCTS[p].manifest, 1024 * 1024)).toString(),
      ),
    )
    const data = await download(m.url)
    verifyApk(p, data, m)
    console.log(
      `${PRODUCTS[p].name}: version ${m.name}, ${data.length} bytes, SHA-256 et identité APK vérifiés.`,
    )
  }
}
main().catch((e) => {
  console.error(e.message)
  process.exitCode = 1
})
