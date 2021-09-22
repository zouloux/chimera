#!/bin/bash

# Get arguments
projectTrunk=$1
projectKeep=$2
relativeChimeraKeep=$3
dockerComposePath=$4
projectPrefix=$5
createSym=$6

# Get links from argument array
set -- "${@:7}"
links=("$@")

# Go into project directory
# shellcheck disable=SC2164
cd "$projectTrunk"

# Rename docker-compose.yaml and do not crash if same name or already exists
mv $dockerComposePath docker-compose.yaml > /dev/null 2>&1

# Force all restart policies to "unless-stopped" in docker-compose
sed -i 's/^\(\s*\)restart\s*:.*$/\1restart: \"unless-stopped\"/' docker-compose.yaml

# Inject compose project name and chimera keep into dot env
# TODO : Remove COMPOSE_HOSTNAME / CHIMERA_KEEP ...
echo "" >> .env; echo "" >> .env;
echo "# ------------------------------------------------------------------------------ COMPOSE & CHIMERA" >> .env
echo "COMPOSE_PROJECT_NAME=$projectPrefix" >> .env
echo "COMPOSE_NAME=$projectPrefix" >> .env
echo "COMPOSE_HOSTNAME=$projectPrefix" >> .env
echo "CHIMERA_KEEP=$relativeChimeraKeep" >> .env

# Replace all instances of $COMPOSE_PROJECT_NAME and $COMPOSE_NAME in .env
sed -i "s/\$COMPOSE_PROJECT_NAME/$projectPrefix/" .env
sed -i "s/\$COMPOSE_NAME/$projectPrefix/" .env

# Go back to chimera home
cd -

# Create project's kept directory
mkdir -p "$projectKeep"

# Remove trailing slash
projectKeep=${projectKeep%/}

# Browse all kept links
for i in "${links[@]}"; do
  # If not already in keep
  if [[ ! -e $projectKeep/$i ]]; then
    # Create empty folder if kepts does not exists in trunk
    if [[ ! -e $projectTrunk/$i ]]; then mkdir -p $projectTrunk/$i; fi
    # Create parent folders and copy from trunk to keep
    mkdir -p "$(dirname $projectKeep/$i)" && cp -R "$projectTrunk/$i" "$projectKeep/${i%/}"
  fi
  # Create symbolic link in relative mode (resolve itself, needed ../)
  if [[ "$createSym" == "symlinks" ]]; then
    rm -rf "${projectTrunk:?nn}/$i"
    to="$(pwd)/${projectTrunk:?nn}/${relativeChimeraKeep?:nn}/${i%/}"
    ln -rsf $to "${projectTrunk:?nn}/$i"
  fi
done
