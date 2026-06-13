#!/bin/bash
# Source the .env to get GITHUB_TOKEN
source /c/Users/Administrator/AppData/Local/hermes/profiles/personal-space/.env 2>/dev/null

# Use single quotes around the token value to avoid quote issues
curl -s \
  --header "Authorization: Bearer ***  \
  --header "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/MichaelZ1102/pr-tool-test" \
  -o /tmp/gh_repo_check.json
echo "EXIT:$?"
