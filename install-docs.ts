import { readFileSync, copySync, writeFileSync } from 'fs-extra'

// TODO: revisit this. Copy pasting the gif feels really wrong
;(function installDocs() {
  const rootDir = process.cwd()

  const readmeContent = readFileSync(`${rootDir}/README.md`, { encoding: 'utf-8' }).toString()

  const publicPackages = ['extension', 'plugin']
  publicPackages.forEach((packageName) => {
    const packageReadme = readmeContent.replace(
      `https://github.com/tamj0rd2/ts-quickfixes/blob/master/packages/${packageName}/`,
      './',
    )

    const packageRoot = `${rootDir}/packages/${packageName}`
    writeFileSync(`${packageRoot}/README.md`, packageReadme, { encoding: 'utf-8' })
    copySync(`${rootDir}/gifs`, `${packageRoot}/gifs`, { overwrite: true, recursive: true })
  })

  console.log('Installed docs')
})()
