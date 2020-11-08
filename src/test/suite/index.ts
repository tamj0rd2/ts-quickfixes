import { runCLI } from '@jest/core'
import type { Config } from '@jest/types'
import { ROOT_DIR } from '../test_constants'
import stripAnsi from 'strip-ansi'

// eslint-disable-next-line @typescript-eslint/require-await
export async function run(): Promise<void> {
  console.log(ROOT_DIR)

  const config: Config.Argv = {
    $0: '',
    _: [],
    runInBand: true,
    setupFiles: [`${ROOT_DIR}/out/test/vscode-framework-setup.js`],
    testEnvironment: `${ROOT_DIR}/out/test/vscode-test-environment.js`,
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { results } = await runCLI(config, [`${ROOT_DIR}/jest.config.js`])

  results.testResults.forEach((testResult) => {
    const intro = testResult.skipped
      ? 'Skipped'
      : testResult.numFailingTests > 0 || testResult.failureMessage
      ? 'Failed'
      : 'Passed'
    const failureMessage = testResult.failureMessage ? `\n${stripAnsi(testResult.failureMessage)}` : ''
    console.log(`[${intro.toUpperCase()}] ${testResult.testFilePath}${failureMessage}`)
  })
}
