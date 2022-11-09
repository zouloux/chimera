#!/usr/bin/env bash

echo "Cleaning docker container and images ..."
docker container prune -f
docker image prune -a -f
docker system prune -f

# TODO : WIP
# TODO : Allow custom certbot renew script because of unability to renew automatically wildcard certs without DNS config ...
# TODO : docker-compose not found when exec from crontab !
#echo "Renewing certbot certificates ..."
#cd "`dirname $0`"/core/nginx
#docker-compose down
#certbot renew
#docker-compose up -d
#cd -
