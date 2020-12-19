import { runCLI } from '@jest/core'
import type { Config } from '@jest/types'
import { E2E_ROOT_DIR } from '../paths'
import stripAnsi from 'strip-ansi'

export async function run(): Promise<void> {
  const config: Config.Argv = {
    $0: '',
    _: [],
    runInBand: true,
    setupFiles: [`${E2E_ROOT_DIR}/out/vscode-framework-setup.js`],
    testEnvironment: `${E2E_ROOT_DIR}/out/vscode-test-environment.js`,
    preset: 'ts-jest',
    testMatch: ['<rootDir>/src/tests/**/*.spec.ts'],
    testTimeout: 20000,
  }

  const { results } = await runCLI(config, [`${E2E_ROOT_DIR}/jest.config.js`])

  const formattedResults = results.testResults.map((testResult) => {
    const intro = testResult.skipped
      ? 'Skipped'
      : testResult.numFailingTests > 0 || testResult.failureMessage
      ? 'Failed'
      : 'Passed'
    const failureMessage = testResult.failureMessage ? `\n${stripAnsi(testResult.failureMessage)}` : ''

    return {
      formattedMessage: `[${intro.toUpperCase()}] ${testResult.testFilePath}${failureMessage}`,
      didFail: intro === 'Failed',
    }
  })

  formattedResults.forEach((result) => console.log(result.formattedMessage))

  if (formattedResults.some((result) => result.didFail === true)) {
    throw new Error('Some tests failed')
  }
}
