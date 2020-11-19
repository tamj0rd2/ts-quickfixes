# Contributing

## Development

### Prerequisites

1. `npm ci` - installs the required dev dependencies
2. `npx lerna bootstrap` - installs dependencies for all of the packages

### Running the tests

- Run the **plugin tests**: `npm run test:plugin`
- Run the **extension tests**: `npm run test:extension`
- Run the **e2e tests**: Open vscode debug panel, choose Extension Tests then click the green play button
- Run the **e2e tests from terminal**: `npm run test:extension` (note, you'll need to close vscode first)
- Run **all tests**: `npm run test` (note, you'll need to close vscode first)

NOTE: The extension tests can take a little while to run. At most you'll have to wait
a minute. If it takes longer than that, something is probably wrong.

## Troubleshooting

If the extension fails to activate when using the `Run Extension` launch config,
try completely exiting vscode, `cd`ing into this repo, then running `code`.
It seems to get confused about where to find project files unless I do this.

## How to add a new package to the monorepo

1. Copy paste packages/example-package and give it a new name
2. Open this repo's root tsconfig file and add a project reference to your new package
3. Open this repo's root .eslintrc.js and add the package's tsconfig path to the `projects` array
