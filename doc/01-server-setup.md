# New Chimera server setup

### Requirements

Tested on Ubuntu 22.04 on a VPS configured with :
- 8gb of ram
- 160 gb of SSD
- 4 vCores

### Instructions

#### Prepare Server

1. Do a clean installation of Ubuntu
2. Connect through SSH : `ssh root@SERVER_IP`
3. Add your public SSH key to `~/.ssh/authorized_keys` to avoid password logins
4. Change default SSH port to improve security and let Gitlab on port 22
   ( [more info](https://www.cyberciti.biz/faq/howto-change-ssh-port-on-linux-or-unix-server/) ):
- `sudo vi /etc/ssh/sshd_config` and replace `#Port 22` by `Port 2002`.
  You can choose any other port higher than `2000` if needed.
5. Allow new SSH port on internal firewall : `sudo ufw allow 2002`
6. Allow port on external firewall also (on hosting control pannel).
5. Restart server with `reboot` and check SSH reconnect with port after some
   seconds : `ssh -p root@SERVER_IP`

#### Prepare DNS

Configure DNS with your domain name register to point any sub-domain to an your
chimera server's IP address.
DNS can be configured like `*.domain-name.com A SERVER_IP` if you want to have
`domain-name.com` pointing to a website but any sub-domain pointing to your
Chimera server. Anyway, you must redirect all sub-domain of any domain
(or sub-domain) to server's IP.
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

4. Install n (node version manager) and node
- `sudo curl -o /usr/local/bin/n https://raw.githubusercontent.com/visionmedia/n/master/bin/n`
- `sudo chmod +x /usr/local/bin/n`
- Install node : `sudo n latest`

5. Highly advised, update vim
- `sudo add-apt-repository ppa:jonathonf/vim`
- `sudo apt update`
- `sudo apt install vim`

6. Optionally, install MySQL client for faster dumps with chimera sync
- `sudo apt-get install mysql-client`

7. Optionally, install zsh and ohmyzsh
- `sudo apt install zsh`
- `sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"`

#### Install cerbot certificate

[More info](https://certbot.eff.org/lets-encrypt/ubuntufocal-nginx)

1. Install snapd and dependencies
- `sudo apt install snapd`
- `sudo snap install core; sudo snap refresh core`

2. Install certbot
- `sudo snap install --classic certbot`
- `sudo ln -s /snap/bin/certbot /usr/bin/certbot`

3. Create root domain name certificate
   ( [more info](https://marcincuber.medium.com/lets-encrypt-generating-wildcard-ssl-certificate-using-certbot-ae1c9484c101) )
   Proposed method, can be any other certificate installation method or challenge.
   Replace `YOUR_EMAIL`, `DOMAIN_NAME` and follow instructions.
   ```
   certbot certonly --manual \
   --preferred-challenges dns-01 \
   --email 'YOUR_EMAIL' \
   --server https://acme-v02.api.letsencrypt.org/directory \
   --agree-tos \
   -d '*.DOMAIN_NAME'
   ```

##### Important note about wildcard domains

Wildcard domains **can't** be validated with http challenge ([for now](https://community.letsencrypt.org/t/wildcard-certificates-and-http-challenge/102060)).
This is why we use **dns-01** challenge in this example. DNS challenge means it can't be automated without a plugin which set a TXT entry into your hosting provider DNS configuration. Search if a [DNS Certbot plugin](https://certbot.eff.org/docs/using.html#dns-plugins) exists for your hosting provider and install / configure it. Without this, **crontab will not be able to automatically renew your wildcard certificate**. Some hosting provider plugins exists as external resources, like [this one for Ionos](https://pypi.org/project/certbot-dns-ionos/).

#### Install chimera server

1. Pull chimera sources from github
- `git clone https://github.com/zouloux/chimera.git chimera-trunk`
- `ln -s chimera-trunk/server chimera`
We can keep `chimera-trunk` to be able to pull `Chimera` updates.

> Note : The chimera repo is private, to clone it from your server, you'll need to create a PAT token from your Github account
> Create a new token here ( with repo access ) : https://github.com/settings/tokens
> Then prepend your token as a http user like so : `git clone https://TOKEN@github.com/zouloux/chimera.git chimera-trunk`

#### Configure Gitlab

1. Configure gitlab host
- Go to Gitlab folder : `cd ~/chimera/core/gitlab/`
- Copy template `cp .env.default .env`
- Edit `.env` with vi or any editor : `vi .env`
    - Set `DOMAIN_NAME` as Chimera root domain name ( after the wildcard, ex *.domain.com will be domain.com )s.
    - Fix `GITLAB_IMAGE_VERSION` to the **latest current gitlab version** (to avoid unwanted upgrades).
      ( [know more](https://hub.docker.com/r/gitlab/gitlab-ce/tags?page=1&ordering=last_updated) )
    - Set SMTP parameters to allow gitlab to send e-mails.
    - Avoid empty values for booleans (ex : `GITLAB_SMTP_TLS` should be `true` or `false`, not empty)
    - [More info about email configuration.](https://gitlab.com/gitlab-org/omnibus-gitlab/blob/master/doc/settings/smtp.md)

Ex : `
DOMAIN_NAME=chimera.domain-name.com
GITLAB_IMAGE_VERSION=15.5.3-ce.0
`

FIY, Gitlab is configured to run behind an SSL enabled Nginx proxy.
([more info](https://www.itsfullofstars.de/2019/06/gitlab-behind-a-reverse-proxy/))

2. Configure nginx proxy
- Go to Nginx virtual-hosts config folder :
  `cd ~/chimera/core/nginx/data/config/virtual-hosts`
- Copy templates `cp chimera.conf.template chimera.conf` and `cp default.conf.template default.conf`
- Edit chimera host file with vi or any editor : `vi chimera.conf`
- Update line `~^(?<service>.+)\.sub-domain\.domain\-name\.com$;` and replace
  with your Chimera root domain name, with dot escaped with `\`
- Ex : `~^(?<service>.+)\.domain\-name\.com$;`
- Update `DOMAIN_NAME` on line 28 and 29 with generated domain ID from certbot.
  If not sure, do `ls -la /etc/letsencrypt/live/`, sometimes Certbot adds an
  extension to the folder name.
- Also edit and replace `default.conf`

3. Create chimera private network
- `docker network create chimera`

4. Start Nginx server as detached service
- `cd ~/chimera/core/nginx`
- `docker-compose build`
- `docker-compose up -d`

Now any sub-domain from your Root DNS should respond `502 Bad Gateway`.
Also, https should work. If http does not respond, double check DNS parameters.
If you can't connect to SSH with domain name, it may come from Nginx. To check
Nginx, stop it with docker-compose and try `docker-compose up` without `-d` to
see if it crashes, and if you have any useful log.

5. Start gitlab server as detached service
- `cd ~/chimera/core/gitlab`
- `docker-compose up -d`

After some minutes, you should be able to connect to `https://gitlab.DOMAIN_NAME`.
A password file is created here. `cat /root/chimera/core/gitlab/data/web-config/initial_root_password`.
Use it to log into Gitlab with user `root`

> You can follow instructions to configure gitlab on [this tutorual](https://www.howtoforge.com/how-to-install-gitlab-with-docker-on-ubuntu-22-04/).

Configure Gitlab :
- Disable sign-up form ( we will create accounts when needed )
- Disable Prometheus
- ...

6. Setup gitlab token
- Connect to your freshly installed gitlab, then go to web page `/admin/runners`. Copy the **registration token**.
- Copy Gitlab runner config template :
    - `cd ~/chimera/core/gitlab/data/runner-config`
    - `cp config.toml.template config.toml`
- Connect to Gitlab runner's shell : `cd ~/chimera && ./docker-exec.sh core_gitlab-runner`
- Register a new runner : `gitlab-runner register` with parameters :
    - http://gitlab.chimera/
    - Enter registration token
    - Description : `gitlab-runner`
    - Tags : `gitlab,runner`
    - Select `docker` as engine
    - Specify default docker image, can be `zouloux/docker-ci-php-node` or `misterio92/ci-php-node`
    - Validate and exit shell with ctrl+c
- Configure generated file for your needs following [this](https://docs.gitlab.com/runner/configuration/advanced-configuration.html)
- You can restart everything to be sure with `cd ~/chimera/core/gitlab && docker-compose down && docker-compose up -d`
- After restart, Gitlab's web page `/admin/runners` should show registered runner.

7. Create SSH key and set global variables
- Generate an SSH key for your server to identify it with other production servers ([more info](https://git-scm.com/book/en/v2/Git-on-the-Server-Generating-Your-SSH-Public-Key)).
- Then, go to Gitlab's `/admin/application_settings/ci_cd` and add 3 variables :
    - `SSH_PRIVATE` and `SSH_PUBLIC` 
      Remove comments from `SSH_PRIVATE`, it should only include the key body.
    - `CHIMERA_HOST` to `root@172.17.0.1:2002` if Gitlab is installed on same server
      than Chimera. Otherwise, specify SSH target to connect from outside.
- Add public key to `~/.ssh/authorized_keys` on Chimera server

#### Configure maintenance cron

The maintenance cron will remove all unused docker images and containers. It will
also renew certbot SSL certificate if needed.

- Create a log directory into home folder : `mkdir ~/logs`.
- Go to crontab with `crontab -e`.
- Call maintenance script once a week and save to a log file.
    - Ex : `0 3 * * 0 /root/chimera/maintenance-cron.sh > /root/logs/maintenance-cron.log 2>&1`
    - This example is for every sunday on 3am.
    - Note that your home directory can change depending on installation.
    - Always test script (run `/root/chimera/maintenance-cron.sh > /root/logs/maintenance-cron.log` and update crontab if something goes wrong.)

#### Enable MySQL service

Optionally, you can setup a common MySQL server with a PhpMyAdmin interface.

- Got to mysql service directory : `cd ~/chimera/mysql`
- Create a new MySQL password :
  - `echo "MYSQL_ROOT_PASSWORD=$(cat /dev/random | LC_CTYPE=C tr -dc "[:alpha:]" | head -c 10)" > .env`
- See the generated password with `cat .env`
- Start service with `docker-compose up -d`
- Go to `https://phpmyadmin.DOMAIN_NAME`, Default MySQL login is `root`
- Open port on server's internal firewall : `sudo ufw allow 3306`
- Allow port on external firewall also.
