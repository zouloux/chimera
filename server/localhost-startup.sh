#!/usr/bin/env bash

bold=$(tput bold)
normal=$(tput sgr0)

echo ""
echo "${bold}Chimera local proxy${normal}"
echo ""
echo "Started Chimera containers will be available at :"
echo "  ${bold}https://\$CHIMERA_ID.chimera.localhost${normal}"
echo ""
echo "A MariaDB service is started. To connect :"
echo "  host : 127.0.0.1"
echo "  user : root"
echo "  port : 3306"
echo ""
echo "PhpMyAdmin is available here : "
echo "  ${bold}https://phpmyadmin.chimera.localhost${normal}"
echo ""

if [ ! -f core/mysql/.env ]; then
    LOCAL_MARIA_PASSWORD=$(cat /dev/random | LC_CTYPE=C tr -dc "[:alpha:]" | head -c 8)
    echo "MYSQL_ROOT_PASSWORD=${LOCAL_MARIA_PASSWORD}" > core/mysql/.env

    echo "A ${bold}new password for MariaDB${normal} has be created."
    echo "Please write it down : ${bold}${LOCAL_MARIA_PASSWORD}${normal}"
    echo "( This password is available in ${bold}core/mysql/.env${normal} anyway )"
    echo ""
    read -s -n 1 -p "Press any key to continue . . ."
fi

echo "Enabling Nginx and MariaDB configs ..."
cp core/nginx/data/config/virtual-hosts/localhost.conf.template core/nginx/data/config/virtual-hosts/localhost.conf

echo "Generating SSL certificates for *.chimera.localhost ..."
mkcert -key-file core/nginx/data/certs/localhost-key.pem -cert-file core/nginx/data/certs/localhost-cert.pem chimera.localhost *.chimera.localhost > /dev/null 2>&1

echo ""
echo "Starting up MariaDB ..."
cd core/mysql || exit 1
docker-compose up -d > /dev/null 2>&1

cd ../../core/nginx || exit 1
echo "Building Nginx proxy ..."
docker-compose build > /dev/null 2>&1
echo "Starting up Nginx proxy ... (ctrl + c to stop servers gracefully)"
docker-compose up

echo "Stopping MariaDB ..."
cd ../../core/mysql || exit 1
docker-compose down > /dev/null 2>&1