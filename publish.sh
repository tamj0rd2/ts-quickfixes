yarn build
npx lerna run --scope ts-quickfixes-extension --stream vsce:package
npx lerna run --scope ts-quickfixes-extension --stream vsce:publish
