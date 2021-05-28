
# --------------------------------------------------------------------------------------- INIT

# Highlt inspired from : https://github.com/glats/alpine-lamp/

# We use alpine base, lighter than Ubuntu
FROM alpine:3.12

# Configure timezone
ENV TIMEZONE Europe/Paris

# Upgrade packages
RUN apk update && apk upgrade

# --------------------------------------------------------------------------------------- INSTALL

# Install base tools
RUN apk add --no-cache bash curl wget tzdata openssl git ca-certificates xz

# Install nginx
RUN apk add --no-cache nginx

# --------------------------------------------------------------------------------------- CONFIG

# Configure timezone
RUN cp /usr/share/zoneinfo/${TIMEZONE} /etc/localtime && echo "${TIMEZONE}" > /etc/timezone

# Create run directory for nginx - https://github.com/gliderlabs/docker-alpine/issues/185
RUN mkdir -p /run/nginx

# --------------------------------------------------------------------------------------- ENTRY

# Copy entry point
COPY entry.sh /entry.sh
RUN chmod u+x /entry.sh

# Set default workdir to home
WORKDIR /root

# Expose nginx ports
EXPOSE 80 443


STOPSIGNAL SIGTERM


# Execute entry point
ENTRYPOINT ["/entry.sh"]
#CMD ["nginx", "-g", "daemon off;"]
