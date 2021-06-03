#!/usr/bin/env bash

# Go into server directory, relatively
cd ../../server || exit 1

bold=$(tput bold)
normal=$(tput sgr0)

printf "Stopping MariaDB container ... "
cd core/mysql || exit 1
docker-compose down > /dev/null 2>&1
echo "${bold}Ok${normal}"

printf "Stopping Nginx container ... "
cd ../../core/nginx || exit 1
docker-compose down > /dev/null 2>&1
echo "${bold}Ok${normal}"
echo ""
