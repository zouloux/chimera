#!/bin/bash
cd "$1";
docker-compose up --build --detach --force-recreate --remove-orphans || exit 1