



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

- `git clone https://github.com/zouloux/chimera.git chimera-trunk`
- `ln -s chimera-trunk/server chimera`
