# Packages coda into a distributable zip file.
# Automatically updates dependencies and re-compiles TypeScript, and outputs to coda.zip.
# If the current file tree matches HEAD, the commit hash of HEAD will be included in the built project
# and in the zip filename.
#
# Note: This script MUST be run from its parent directory in order to work correctly.

#!/bin/bash
set -e

# Revert version.json on exit.
function finish {
    echo $'{\n  "hash": "develop",\n  "date": ""\n}' >version.json
}
trap finish EXIT

# Ensure dependencies are up to date, and recompile typescript
npm install
tsc

# If the current directory does not match the HEAD commit, emit a warning,
# otherwise export the hash and date of HEAD to version.json
changes=$(git status --porcelain) # Machine readable list of changes; empty if there no changes.
if [ ! -z "${changes}" ]; then
    echo "Warning: File system is different to HEAD, so the zipped project will not
         include a version identifier."

    # Zip this directory into a zip file.
     zip -r -qq coda.zip . -x coda*.zip
else
    # Get the commit hash and time-stamp
    hash=$(git rev-parse HEAD)
    date=$(git show -s --format=%ci HEAD)

    # Write the hash and time-stamp to a file
    echo "{\"hash\": \"$hash\", \"date\": \"$date\"}" >version.json

    # Zip this directory into a zip file, appending the first 7 digits of the hash to the filename.
    shortHash="$(echo ${hash} | cut -c1-7)"
    zip -r -qq  "coda-v${shortHash}.zip" . -x coda*.zip
fi
