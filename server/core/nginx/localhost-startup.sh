
echo "Chimera local proxy"
echo ""
echo "Started Chimera containers will be available at :"
echo " https://\$CHIMERA_ID.chimera.localhost"
echo ""

echo "Enabled Nginx localhost config ..."
cp data/config/virtual-hosts/localhost.conf.template data/config/virtual-hosts/localhost.conf

echo "Generating *.chimera.localhost SSL certificates ..."
mkcert -key-file data/certs/localhost-key.pem -cert-file data/certs/localhost-cert.pem chimera.localhost *.chimera.localhost > /dev/null 2>&1

echo "Starting up Chimera Proxy ..."
docker-compose up