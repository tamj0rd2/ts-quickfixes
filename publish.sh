yarn build
VERSION=$(jq -r .version packages/extension/package.json)
(cd ./packages/extension && npx vsce publish $VERSION)
