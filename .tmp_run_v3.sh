#!/bin/bash
# Source the profile .env to get GITHUB_TOKEN, then run the Python script
cd "F:/personal-space/Project/PR-tool" || exit 1
# Source the .env - but we need to handle the quoting issue
# The issue is GITHUB_TOKEN might contain " which breaks bash
# We'll use a workaround: read the line directly and handle quotes
GITHUB_TOKEN=$(grep "^GITHUB_TOKEN=*** /c/Users/Administrator/AppData/Local/hermes/profiles/personal-space/.env | cut -d= -f2-)
export GITHUB_TOKEN
python3 .tmp_repo_v3.py