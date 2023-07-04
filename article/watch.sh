#!/bin/bash -E

fswatch -or . | xargs -n1 ./build.sh
