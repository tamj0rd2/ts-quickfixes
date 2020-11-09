const { readFileSync } = require('fs')
const { resolve } = require('path')

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))
const versionRegex = /(\d+).(\d+).(\d+)(?:-.*\.(\d+))?/
const [matchedArea, major, minor, patch, preReleaseVersionNo] = packageJson.version.match(versionRegex)

if (preReleaseVersionNo) {
  // this is really horrible but vsce just doesn't support semantic versioning
  console.log(`${major}.${minor}.${patch + 1}000${preReleaseVersionNo}`)
} else {
  console.log(matchedArea)
}
