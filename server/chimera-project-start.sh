#!/bin/bash
cd "$1";
docker-compose up --detach --force-recreate --remove-orphans || exit 1