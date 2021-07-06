#!/bin/bash
mkdir -p $1;
cd "$1";
/usr/local/bin/docker-compose down --remove-orphans > /dev/null 2>&1 || exit 0