#!/bin/sh

# Copy default configs to external config folder
if [ ! -f /root/config/nginx.conf ]; then
  mkdir -p /root/config/
  cp -R /etc/nginx/. /root/config/
  echo "Original nginx config copied to /root/config shared folder."
  echo "Please setup your config files and restart container."
  exit 1
fi

# Link config from shared folder
echo "Link nginx config from shared folder ..."
rm -rf /etc/nginx
ln -s /root/config /etc/nginx
echo "Done"

# Start nginx in process mode
nginx -g 'daemon off;'
