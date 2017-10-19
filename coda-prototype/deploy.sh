#!/bin/bash
set -e

# Revert version.json on exit.
function finish {
    echo "{\"hash\": \"develop\", \"date\": \"\"}" >version.json
}
trap finish EXIT

# If the current directory does not match the HEAD commit, emit a warning,
# otherwise export the hash and date of HEAD to version.json
changes=$(git status --porcelain) # Machine readable list of changes; empty if there no changes.
if [ ! -z "${changes}" ]; then
    echo "Warning: File system is different to HEAD, so the zipped project will not
         include a version identifier."
else
    # Get the commit hash and time-stamp
    hash=$(git rev-parse HEAD)
    date=$(git show -s --format=%ci HEAD)

    # Write the hash and time-stamp to a file
    echo "{\"hash\": \"$hash\", \"date\": \"$date\"}" >version.json
fi

# Delete the previously deployed version, if it exists, so that it is not included in the next zip file.
[ -e coda.zip ] && rm coda.zip

# Zip this directory into coda.zip
zip -r -qq coda.zip .
