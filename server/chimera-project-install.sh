#!/bin/bash
cd "$1"
mv $2 docker-compose.yaml > /dev/null 2>&1
echo "" >> .env
echo "CHIMERA_HOST_PREFIX=$3" >> .env