#!/bin/bash
cd "$1";
docker-compose up --detach --force-recreate || exit 1