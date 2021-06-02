#!/bin/bash

# Go into project root directory (where there is shared and trunk)
# shellcheck disable=SC2164
cd "$1"

# Patch rights so docker user can r/w pushed files
chmod ugo+rw -R .