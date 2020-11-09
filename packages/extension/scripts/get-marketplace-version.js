const { readFileSync } = require('fs')
const { resolve } = require('path')

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))
const versionRegex = /(\d+.\d+.\d+)(?:-.*\.(\d+))?/
const [, versionNo, preReleaseVersionNo] = packageJson.version.match(versionRegex)

// the 000 thing is gross, but vsce just doesn't fully support semantic versioning
console.log(preReleaseVersionNo ? `${versionNo}.000${preReleaseVersionNo}` : versionNo)
