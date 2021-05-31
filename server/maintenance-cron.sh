
echo "Cleaning docker container and images ..."
docker system prune -f

echo "Renewing certbot certificates ..."
cd ./core/nginx
docker-compose down
certbot renew
docker-compose up -d
cd -
