#!/usr/bin/env bash

bold=$(tput bold)
normal=$(tput sgr0)

if [ ! -f .env ]; then
  LOCAL_MARIA_PASSWORD=$(cat /dev/random | LC_CTYPE=C tr -dc "[:alpha:]" | head -c 10)
  echo "MYSQL_ROOT_PASSWORD=${LOCAL_MARIA_PASSWORD}" > .env

  echo "${bold}MariaDB setup${normal}"
  echo ""
  echo "A ${bold}new password for MariaDB${normal} has been created :"
  echo "→ ${bold}${LOCAL_MARIA_PASSWORD}${normal}"
  echo "( This password is visible in ${bold}$(pwd)/.env${normal} anyway )"
  echo ""
  echo "Press any key to continue ..."
  read -s -n 1
  echo "${bold}Connection instructions :${normal}"
  echo "- host (from localhost) : 127.0.0.1"
  echo "- host (from docker): maria"
  echo "- user : root"
  echo "- password : ${LOCAL_MARIA_PASSWORD}"
  echo "- port : 3306"
  echo ""
  echo "Press any key to continue ..."
  read -s -n 1
fi

echo "PhpMyAdmin will be available here : "
echo "→ ${bold}https://phpmyadmin.chimera.localhost${normal}"
echo ""
