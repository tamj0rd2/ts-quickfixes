import { resolve } from 'path'

// not using process.cwd because it uses a weird vscode path
const REPO_ROOT_DIR = resolve(__dirname, '../../../')

export const E2E_ROOT_DIR = resolve(REPO_ROOT_DIR, 'packages/e2e')
export const EXTENSION_ROOT_DIR = resolve(REPO_ROOT_DIR, 'packages/extension')
export const TEST_ENV_DIR = resolve(REPO_ROOT_DIR, 'test-environment')
