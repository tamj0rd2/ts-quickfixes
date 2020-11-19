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

tsc -b ./tsconfig.json
print 'Built code'

semantic-release
print 'Semantic release complete'

print 'Publishing to vsce is currently disabled. Do it manually' $RED
