module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 10000,
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  watchPathIgnorePatterns: ['out', 'node_modules'],
}
