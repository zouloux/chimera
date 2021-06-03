#!/usr/bin/env bash

bold=$(tput bold)
normal=$(tput sgr0)

echo ""
echo "${bold}Chimera local proxy${normal}"
echo ""

echo "Stopping MariaDB ..."
cd core/mysql || exit 1
docker-compose down > /dev/null 2>&1
echo "Done"
echo ""

echo "Stopping Nginx proxy"
cd ../../core/nginx || exit 1
docker-compose down > /dev/null 2>&1
echo "Done"
