# Chimera local proxy

Chimera local proxy is an Nginx proxy which enable SSL access on your locally
started chimera projects.
It also support a pre-configured MariaDB with persistent data.

For now, only this method is available. But a built-in npm module is planned.

### Requirements

- Linux based host or Mac
- [mkcert](https://github.com/FiloSottile/mkcert)
- [Docker](https://docs.docker.com/get-docker/)

### Setup

##### Install chimera source code somewhere on your computer.
- `git clone git@github.com:zouloux/chimera.git chimera-trunk`

##### Link chimera-proxy executable 
- `cd chimera-trunk`
- `ln -sf "$(pwd)/src/local-proxy/chimera-proxy.sh" /usr/local/bin/chimera-proxy`

### Start proxy

- `chimera-proxy start`

Then in your browser, open your started chimera project with :
- `https://$CHIMERA_ID.chimera.localhost`

### Stop proxy

- `chimera-proxy stop`
  
### Connect to MariaDB

At first start, a MariaDB password will be created, keep connection instructions
somewhere.

- user : root
- password : Your generated password
- port : 3306

From localhost :
- host : localhost

From docker :
- host : maria

Also, `https://phpmyadmin.chimera.localhost` is available when proxy is started.