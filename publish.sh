#!/usr/bin/env bash
set -e

export HUSKY=0

npm run clean
npm run setup
npm run build

npx lerna exec --stream --scope ts-quickfixes-extension -- ./shipit.sh
