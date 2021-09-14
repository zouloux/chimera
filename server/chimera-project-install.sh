#!/bin/bash

# Get arguments
projectTrunk=$1
projectKeep=$2
relativeChimeraKeep=$3
dockerComposePath=$4
projectPrefix=$5

# Get links from argument array
set -- "${@:6}"
links=("$@")

# Go into project directory
# shellcheck disable=SC2164
cd "$projectTrunk"

# Rename docker-compose.yaml and do not crash if same name or already exists
mv $dockerComposePath docker-compose.yaml > /dev/null 2>&1

# Inject compose project name and chimera keep into dot env
echo "" >> .env
echo "COMPOSE_PROJECT_NAME=$projectPrefix" >> .env
echo "COMPOSE_NAME=$projectPrefix" >> .env
echo "COMPOSE_HOSTNAME=$projectPrefix" >> .env
echo "CHIMERA_KEEP=$relativeChimeraKeep" >> .env

# Replace all instances of $COMPOSE_PROJECT_NAME in .env
sed -i "s/\$COMPOSE_PROJECT_NAME/$projectPrefix/" .env

# Change restart policy from "no" to "unless-stopped"
sed -i 's/^(\s*)(restart\s*:\s*\"no\"\s*$)/\1restart: \"unless-stopped\"/' docker-compose.yaml

# Go back to chimera home
cd -

# Create project's kept directory
mkdir -p "$projectKeep"

# Browse all kept links
for i in "${links[@]}"; do
  # If not already in keep
  if [[ ! -e $projectKeep/$i ]]; then
    # Create empty folder if kepts does not exists in trunk
    if [[ ! -e $projectTrunk/$i ]]; then mkdir -p $projectTrunk/$i; fi
    # Create parent folders and copy from trunk to keep
    mkdir -p "$(dirname $projectKeep/$i)" && cp -R "$projectTrunk/$i" "$projectKeep/${i%/}"
  fi
done
