#!/usr/bin/env bash

# TODO : JS VERSION / EVOLUTIONS ->
# TODO : DATABASES :
# TODO :    - Ask to start Maria
# TODO :    - Implement MongoDB when needed in a project ...
# TODO :    - Create a command to setup databases managers
# TODO :    - How to manage PHPMyAdmin ?
# TODO : NGINX :
# TODO :    - Switch default port for certain projects (via config ? useful ?)


# Go into server directory, relatively
cd ../../server || exit 1

bold=$(tput bold)
normal=$(tput sgr0)

echo "Started Chimera containers will be available at :"
echo "→ ${bold}https://\$CHIMERA_ID.chimera.localhost${normal}"
echo ""

if [ ! -f core/mysql/.env ]; then
  LOCAL_MARIA_PASSWORD=$(cat /dev/random | LC_CTYPE=C tr -dc "[:alpha:]" | head -c 10)
  echo "MYSQL_ROOT_PASSWORD=${LOCAL_MARIA_PASSWORD}" > core/mysql/.env

  echo "A ${bold}new password for MariaDB${normal} has been created :"
  echo "→ ${bold}${LOCAL_MARIA_PASSWORD}${normal}"
  echo "( This password is visible in ${bold}$(pwd)/core/mysql/.env${normal} anyway )"
  echo ""
  read -s -n 1 -p "Continue ..."
  echo "";echo ""
  echo "MariaDB will be started. Connection instructions :"
  echo "- host (from localhost) : 127.0.0.1"
  echo "- host (from docker): maria"
  echo "- user : root"
  echo "- password : ${LOCAL_MARIA_PASSWORD}"
  echo "- port : 3306"
  echo ""
  echo "PhpMyAdmin is available here : "
  echo "→ ${bold}https://phpmyadmin.chimera.localhost${normal}"
  echo ""
  read -s -n 1 -p "Continue ..."
  echo "";echo ""
fi


printf "Enabling configs ... "
cp core/nginx/data/config/virtual-hosts/localhost.conf.template core/nginx/data/config/virtual-hosts/localhost.conf
echo "${bold}Ok${normal}"

printf "Generating SSL certificates for *.chimera.localhost ... "
mkcert -key-file core/nginx/data/certs/localhost-key.pem -cert-file core/nginx/data/certs/localhost-cert.pem chimera.localhost *.chimera.localhost > /dev/null 2>&1
echo "${bold}Ok${normal}"

printf "Starting MariaDB container ... "
cd core/mysql || exit 1
docker-compose up -d > /dev/null 2>&1
echo "${bold}Ok${normal}"

printf "Starting Nginx container ... "
cd ../../core/nginx || exit 1
docker-compose up --build -d > /dev/null 2>&1
echo "${bold}Ok${normal}"
echo ""