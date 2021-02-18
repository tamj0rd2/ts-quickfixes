#!/usr/bin/env bash
set -e

GREEN='\033[1;32m'
RED='\033[1;31m'
BLUE='\033[1;34m'

print() {
  echo -e "${2:-$BLUE}== $1 ==\033[0m"
}

function finish {
  if [ $? -ne 0 ];
  then
    print 'RELEASE FAILED' $RED
  else
    print 'RELEASE SUCCESS' $GREEN
  fi

  set +e
}
trap finish EXIT

CURRENT_VERSION_NUMBER="$(node ./scripts/get-marketplace-version.js)"
semantic-release
print 'Semantic release complete'
UPDATED_VERSION_NUMBER="$(node ./scripts/get-marketplace-version.js)"

# === Still haven't figure out how to make this work. Use publish.sh in the repo root.
# if [ "$CURRENT_VERSION_NUMBER" == "$UPDATED_VERSION_NUMBER" ]; then
#   print 'Not publishing the extension because there was no version increment'
# else
#   print "Going to publish the extension under version ${UPDATED_VERSION_NUMBER}"
#   vsce publish -p $PUBLISHER_TOKEN $UPDATED_VERSION_NUMBER
# fi
