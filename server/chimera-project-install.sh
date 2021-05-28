#!/bin/bash
PATH=$PATH:/usr/local/bin/
cd "$1"
mv chimera-docker-compose.yaml docker-compose.yaml > /dev/null 2>&1
# FIXME : Do this only not already existing in file
echo "" >> .env
echo "CHIMERA_HOST_NAME=$2.chimera" >> .env
echo "CHIMERA_HOST_PREFIX=$2." >> .env