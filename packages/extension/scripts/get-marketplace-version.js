const { readFileSync } = require('fs')
const { resolve } = require('path')

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))
const versionRegex = /(\d+).(\d+).(\d+)(?:-(.*)\.(\d+))?/
const [matchedArea, major, minor, patch, stream, preReleaseVersionNo] = packageJson.version.match(
  versionRegex,
)

if (preReleaseVersionNo) {
  // this is a necessary evil. I promise
  const codifiedReleaseStream = [...stream].map((char) => Math.abs(97 - char.charCodeAt(0))).join('')
  console.log(`${major}.${minor}.${parseInt(patch) + 1}${codifiedReleaseStream}${preReleaseVersionNo}`)
} else {
  console.log(matchedArea)
}
