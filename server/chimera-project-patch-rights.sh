#!/bin/bash

# Go into project directory
# shellcheck disable=SC2164
cd "$1"

# Patch rights so docker user can r/w pushed files
chmod ugo+rw -R .