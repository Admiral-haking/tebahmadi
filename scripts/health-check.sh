#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-https://tebahmadi.ir}"
curl --fail --silent --show-error --max-time 15 "$BASE_URL/api/health"
printf '\n'
curl --fail --silent --show-error --max-time 15 "$BASE_URL/13393349.txt" | wc -c | awk '{ print "verification_file_bytes=" $1 }'
