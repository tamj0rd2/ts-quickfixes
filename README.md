# Typescript QuickFixes

The purpose of Typescript QuickFixes is to add some additional quickfixes and
refactors to vscode.

## vscode plugin

Check out the [README](./packages/extension/README.md)

## Typescript language server plugin

Check out the [README](./packages/plugin/README.md)


## Development

### Prerequisites

1. `npm ci` - installs the required dev dependencies
2. `npx lerna bootstrap` - installs dependencies for all of the packages

### Running the tests

- Run all of the tests: `npx lerna test --stream`
- Run plugin tests in watch mode: `npx lerna exec --scope ts-quickfixes-plugin npm run test -- --watch`
- Run extension tests: In vscode, open the debug panel. Choose `Extension Tests` 
  from the dropdown then click the green play button

NOTE: The extension tests can take a little while to run. At most you'll have to wait
a minute. If it takes longer than that, something is probably wrong.
