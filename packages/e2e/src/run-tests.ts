import { resolve } from 'path'
import { runTests } from 'vscode-test'
import { E2E_ROOT_DIR, EXTENSION_ROOT_DIR, TEST_ENV_DIR } from './paths'

async function main(): Promise<void> {
  try {
    // Download VS Code, unzip it and run the integration test
    await runTests({
      launchArgs: [TEST_ENV_DIR, '--disable-extensions'],
      // The folder containing the Extension Manifest package.json
      extensionDevelopmentPath: EXTENSION_ROOT_DIR,
      // The path to test runner
      extensionTestsPath: resolve(E2E_ROOT_DIR, 'out/tests/index'),
    })
  } catch (err) {
    console.error('Failed to run tests')
    process.exit(1)
  }
}

console.dir({ TEST_ENV_DIR, EXTENSION_ROOT_DIR, E2E_ROOT_DIR })

void main()
