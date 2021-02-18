#!/usr/bin/env bash
set -e

# npm run clean
# npm ci
# npm run build

CURRENT_PLUGIN_VERSION="$(jq '.dependencies["ts-quickfixes-plugin"].version' ./package-lock.json -r)"
npm i ts-quickfixes-plugin@latest --save
UPDATED_PLUGIN_VERSION="$(jq '.dependencies["ts-quickfixes-plugin"].version' ./package-lock.json -r)"

if [ "$CURRENT_PLUGIN_VERSION" == "$UPDATED_PLUGIN_VERSION" ];
then
  echo "No new version of the plugin to update to"
  exit 0
fi

echo "Going to release extension using updated plugin version $UPDATED_PLUGIN_VERSION"
git add package.json package-lock.json

echo "would commit at this point, then do a dry run"
HUSKY=0 git commit -m "feat(deps): update to latest plugin version $UPDATED_PLUGIN_VERSION"

semantic-release --no-ci

npx lerna run --scope ts-quickfixes-extension --stream vsce:package
npx lerna run --scope ts-quickfixes-extension --stream vsce:publish
