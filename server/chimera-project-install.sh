#!/bin/bash

# Get arguments
projectTrunk=$1
projectShared=$2
dockerComposePath=$3
projectPrefix=$4

# Get links from argument array
set -- "${@:5}"
links=("$@")

# Go into project directory
# shellcheck disable=SC2164
cd "$projectTrunk"

# Rename docker-compose.yaml and do not crash if same name or already exists
mv $dockerComposePath docker-compose.yaml > /dev/null 2>&1

# Inject chimera id into dot env
echo "" >> .env;echo "CHIMERA_ID=$projectPrefix" >> .env

# Go back to chimera home
cd -

# Create project's shared directory
mkdir -p "$projectShared"

# Browse all links to symlink
for i in "${links[@]}"; do
  # If not already in shared
  if [[ ! -e $projectShared/$i ]]; then
    # Create empty folder if shared does not exists in archive
    if [[ ! -e $projectTrunk/$i ]]; then mkdir -p $projectTrunk/$i; fi

    # Create parent folders and move from trunk to shared
    mkdir -p "$(dirname $projectShared/$i)" && mv "$projectTrunk/$i" "$projectShared/${i%/}"
  else
    # Already existing in shared, remove
    #sudo rm -rf $projectTrunk/$i
    rm -rf "${projectTrunk:-'/dev/null'}/$i"
  fi
  # Link moved or removed folder to shared
  ln -sfn "$projectShared/${i%/}" $projectTrunk/${i%/}
done