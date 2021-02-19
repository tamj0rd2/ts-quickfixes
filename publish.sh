#!/usr/bin/env bash
set -e

npm run clean
npm ci
npm run build

if [[ -z "${GITHUB_TOKEN}" ]]; then
  echo "If you're running this locally, you need to set the GITHUB_TOKEN environment variable"
  exit 1
fi

export HUSKY=0

npx lerna run --stream --scope ts-quickfixes-extension shipit
