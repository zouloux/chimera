# New server setup

### Requirements

Tested on Ubuntu 20.04 on a VPS configured with : 
- 8gb of ram
- 160 gb of SSD
- 4 vCores

### Instructions

#### Prepare OS

1. Do a clean installation of Ubuntu
2. Connect through SSH
3. Add your public SSH key to `~/.ssh/authorized_keys` to avoid password logins
4. Optionally, change default SSH port to improve security

#### Prepare DNS

Configure DNS with your domain name register to point any sub-domain to an your
chimera server's IP address.
DNS be configured like `*.domain-name.com A SERVER_IP` if you want to have
`domain-name.com` pointing to a website but any sub-domain pointing to your
Chimera server. Anyway, you must redirect all sub-domain of any domain
(or sub-domain) to server IP.
Can also be something like `*.chimera.domain-name.com A SERVER_IP`

#### Install dependencies

1. Install git
- `sudo apt install git`

2. Install docker ( [more info](https://docs.docker.com/engine/install/ubuntu/) )
- `sudo apt-get install apt-transport-https ca-certificates curl gnupg-agent software-properties-common`
- `curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -`
- `sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"`
- `sudo apt-get update`
- `sudo apt-get install docker-ce docker-ce-cli containerd.io`

3. Install docker compose
- `sudo curl -L "https://github.com/docker/compose/releases/download/1.27.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose`
- `sudo chmod +x /usr/local/bin/docker-compose`

4. Optionally, install zsh and ohmyzsh
- `sudo apt install zsh`
- `sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"`

#### Install chimera server

1. Pull chimera sources from github
- `git clone https://github.com/zouloux/chimera.git chimera-trunk`
- `ln -s chimera-trunk/server chimera`

2. Configure gitlab host
- Go to Gitlab folder : `cd ~/chimera/core/gitlab/`
- Create dot env : `touch .env`
- Edit it with vi or any editor : `vi .env` 
- Specify Chimera root domain name.
- Ex : `CHIMERA_HOST=chimera.domain-name.com` or `CHIMERA_HOST=domain-name.com`

3. Configure nginx host
- Go to Ngins virtual-hosts config folder :
  `cd ~/chimera/core/nginx/data/config/virtual-hosts`
- Copy template `cp chimera.conf.template chimera.conf`
- Edit config file with vi or any editor : `vi chimera.conf`
- Update line `~^(?<service>.+)\.sub-domain\.domain\-name\.com$;` and replace
  with your Chimera root domain name, with dot escaped with `\`
- Ex : `~^(?<service>.+)\.domain\-name\.com$;`

4. Create chimera private network
- `docker network create chimera`

5. Start Nginx server as detached service
- `cd ~/chimera/core/nginx`
- `docker-compose build`
- `docker-compose up -d`
- Now any sub-domain from your Root DNS should respond `502 Bad Gateway`

6. Start gitlab server as detached service
- `cd ~/chimera/core/gitlab`
- `docker-compose build`
- `docker-compose up -d`