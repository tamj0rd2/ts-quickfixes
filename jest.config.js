const commonSettings = {
  preset: 'ts-jest',
  testEnvironment: 'node',
}

const extensionUnitTests = {
  ...commonSettings,
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['.*.e2e.spec.ts'],
}

const extensionE2eTests = {
  ...commonSettings,
  testMatch: ['<rootDir>/src/**/*.e2e.spec.ts'],
  testTimeout: 20000,
}

switch (process.env.TEST_MODE) {
  case 'unit':
    module.exports = extensionUnitTests
    break
  case 'e2e':
    module.exports = extensionE2eTests
    break
  default:
    module.exports = { ...commonSettings, projects: [extensionUnitTests, extensionE2eTests] }
}
