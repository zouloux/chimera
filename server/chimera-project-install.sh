#!/bin/bash

# Go into project directory
# shellcheck disable=SC2164
cd "$1"

# Rename docker-compose.yaml and do not crash if same name
mv $3 docker-compose.yaml > /dev/null 2>&1

# Inject chimera id into dot env
echo "" >> .env
echo "CHIMERA_ID=$4" >> .env

# Go back and create shared directory
cd -
mkdir -p "$2"