#!/usr/bin/env bash

bold=$(tput bold)
normal=$(tput sgr0)

echo ""
echo "${bold}Chimera local proxy${normal}"
echo ""

# Get this script's directory and cd it
# so all scripts are running relatively to this folder, and not pwd
DIR="$(dirname "$(readlink "$0")")"
cd $DIR || exit 1

if [ "$1" == "start" ]; then
   exec ./local-proxy-start.sh
elif [ "$1" == "stop" ]; then
   exec ./local-proxy-stop.sh

else
  echo "Usage : "
  echo "${bold}  $ chimera-proxy start"
  echo "${bold}  $ chimera-proxy stop"
fi