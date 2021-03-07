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

## Monitoring the ts-server logs

In vscode, you can see some communications with the ts-server by looking at the Typescript output channel.

Here's a nice little script you can use to monitor the typescript server logs:

```bash
export TSS_LOG="-logToFile true -file <someFolderPath>/ts-logs.txt -level verbose"
tail -f ../ts-logs.txt | grep --line-buffered --color=always ts-quickfixes-plugin
```

If you're able to see `Hello world!` in the output, the monitoring is working

## Releasing

The release of the plugin happens automatically via the CI pipeline. The extension
should be updated/released manually for now.

1. Run `npm run setup` to trigger any new dependencies to be installed
2. Run `npm i --prefix ./packages/extension/ ts-quickfixes-plugin` (If the plugin
  has had a recent release, the package-lock.json for the extension should have
  pending changes in git. If not, something went wrong,)
3. Commit the `package-lock.json` as a feat (so that a new extension version can be released)
4. Push the changes
5. Run `./publish.sh` to publish a new version of the extension

## Troubleshooting

**I've made changes but when I run the `Run Extension` task they don't seem to be working**

Try putting some logs into your code and running `npm run logs`. If you don't see your log,
maybe the symlinking for the packages is broken. It can be fixed by running `npm run setup`

## Helpful tools

- This file in the Typescript repo. You might need to clone and build to get access to it: src/compiler/diagnosticInformationMap.generated.ts
- [AST-Viewer](https://ts-ast-viewer.com/#)
