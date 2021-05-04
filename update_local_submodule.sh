#!/bin/bash

# This script changes the commit hash of the function-schemata submodule.
# If you want to update the commit hash (e.g., in order to incorporate changes
# to function-schemata into this repository), this script automates that process.

if [ -z $1 ]; then
    echo "Usage: update_local_submodule.sh <commit hash>"
    exit 1
fi
COMMITHASH=$1

# Removes function-schemata submodule.
rm .gitmodules
rm -rf function-schemata
git add .gitmodules
git submodule deinit -f function-schemata
git rm --cached function-schemata
rm -rf .git/modules/function-schemata
git commit -m "Removed previous version of submodule."

# Adds function-schemata at the desired commit.
git submodule add https://gerrit.wikimedia.org/r/mediawiki/services/function-schemata
git update-index --cacheinfo 160000,${COMMITHASH},function-schemata
