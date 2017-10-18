#!/bin/bash

# Delete last attempt if it exists
rm -rf coda;

# Create a temporary directory to export to
mkdir coda;

# Check out HEAD to the temporary directory.
# Export via git archive, which exports as a zip which have to unzip.
git archive HEAD --output=coda/export.zip;
unzip -qq coda/export.zip -d coda/;
rm coda/export.zip;

        #git checkout-index -af --prefix=coda-prototype/export/

# Build project
# Note: will need to run npm install here in future.
tsc;

# Get the commit hash and time-stamp
hash=$(git rev-parse HEAD);
date=$(git show -s --format=%ci HEAD)

# Write the hash and time-stamp to a file
echo "{\"hash\": \"$hash\", \"date\": \"$date\"}" >coda/version.json;

# Zip up the output
zip -r -qq coda.zip coda/;

# Clean-up the temporary export directory.
rm -rf coda;
