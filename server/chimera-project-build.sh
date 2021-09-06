#!/bin/bash
cd "$1"

# Try to build with cache, if it failed, try to rebuild from scratch
docker-compose build || docker-compose build --no-cache