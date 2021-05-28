#!/bin/bash
PATH=$PATH:/usr/local/bin/
cd "$1";
docker-compose up --detach --force-recreate --remove-orphans || exit 1