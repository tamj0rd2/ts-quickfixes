#!/usr/bin/env bash
set -e

if [[ -z "${GITHUB_TOKEN}" ]]; then
  echo "You need to set the GITHUB_TOKEN environment variable"
  exit 1
fi

export HUSKY=0

CURRENT_PLUGIN_VERSION="$(jq '.dependencies["ts-quickfixes-plugin"].version' ./package-lock.json -r)"
npm i ts-quickfixes-plugin@latest --save
UPDATED_PLUGIN_VERSION="$(jq '.dependencies["ts-quickfixes-plugin"].version' ./package-lock.json -r)"

if [ "$CURRENT_PLUGIN_VERSION" == "$UPDATED_PLUGIN_VERSION" ];
then
  echo "No new version of the plugin to update to"
  exit 0
fi

echo "Going to release extension using updated plugin version $UPDATED_PLUGIN_VERSION"
git config user.email "tam@example.com"
git config user.name "CI"

git add package.json package-lock.json
git commit -m "feat(deps): update to latest plugin version $UPDATED_PLUGIN_VERSION"

# this script needs testing beyond this point. it failed locally last time - angry about ci.yml changing
semantic-release --no-ci

npx lerna run --scope ts-quickfixes-extension --stream vsce:package
npx lerna run --scope ts-quickfixes-extension --stream vsce:publish
