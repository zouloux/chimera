#!/usr/bin/env bash

echo "Cleaning docker container and images ..."
docker image prune -a -f
docker container prune -f
docker system prune -f

echo "Renewing certbot certificates ..."
cd "`dirname $0`"/core/nginx
docker-compose down
certbot renew
docker-compose up -d
cd -
