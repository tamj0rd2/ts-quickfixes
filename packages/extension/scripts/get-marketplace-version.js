const { readFileSync } = require('fs')
const { resolve } = require('path')

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))
const versionRegex = /(\d+.\d+.\d+)(?:-.*\.(\d+))?/
const [, versionNo, preReleaseVersionNo] = packageJson.version.match(versionRegex)

console.log(preReleaseVersionNo ? `${versionNo}.${preReleaseVersionNo}` : versionNo)
