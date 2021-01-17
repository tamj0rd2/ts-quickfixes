import { readFileSync, copySync, writeFileSync } from 'fs-extra'
import { spawn } from 'child_process'

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

  const child = spawn('git', ['add', '*.md', '*.gif'], { stdio: 'inherit' })
  child.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error('Installing docs failed')
      process.exit(1)
    }

    console.log('Installed docs')
    process.exit(0)
  })
})()
