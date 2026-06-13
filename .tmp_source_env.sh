#!/bin/bash
# Source .env and use Python to do the API call, passing token via env var
source /c/Users/Administrator/AppData/Local/hermes/profiles/personal-space/.env 2>/dev/null
export GITHUB_TOKEN
python3 F:/personal-space/Project/PR-tool/.tmp_create_repo_v2.py
