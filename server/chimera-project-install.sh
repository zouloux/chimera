#!/bin/bash
cd "$1"
mv $2 docker-compose.yaml > /dev/null 2>&1
# TODO : Better
echo "" >> .env
echo "CHIMERA_ID=$3" >> .env