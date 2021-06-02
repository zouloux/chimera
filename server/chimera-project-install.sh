#!/bin/bash

# Go into project directory
# shellcheck disable=SC2164
cd "$1"

# Rename docker-compose.yaml and do not crash if same name
mv $2 docker-compose.yaml > /dev/null 2>&1

# Inject chimera id into dot env
echo "" >> .env
echo "CHIMERA_ID=$3" >> .env