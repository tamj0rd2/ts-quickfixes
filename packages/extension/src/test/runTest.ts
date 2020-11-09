import * as path from 'path'
import { runTests } from 'vscode-test'
import { TEST_ENV_FOLDER } from './test_constants'

async function main(): Promise<void> {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../')

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index')

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [TEST_ENV_FOLDER, '--disable-extensions'],
    })
  } catch (err) {
    console.error('Failed to run tests')
    process.exit(1)
  }
}

void main()
