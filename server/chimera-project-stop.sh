#!/bin/bash
mkdir -p $1;
cd "$1";
/usr/local/bin/docker-compose down > /dev/null 2>&1 || exit 0