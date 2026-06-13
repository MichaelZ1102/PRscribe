import json, os, re

# Read the .env file and extract GITHUB_TOKEN
env_path = "C:/Users/Administrator/AppData/Local/hermes/profiles/personal-space/.env"
token = None
with open(env_path, "rb") as f:
    for raw_line in f:
        if raw_line.startswith(b"GITHUB_TOKEN="):
            # Extract the value after the = sign
            # The line is: GITHUB_TOKEN=<value>\n
            raw_val = raw_line[len(b"GITHUB_TOKEN="):].strip()
            token = raw_val.decode("utf-8", errors="replace")
            break

if not token:
    print(json.dumps({"error": "NO_TOKEN"}))
    exit(1)

# Now make API calls
import urllib.request
import urllib.error

def api(method, path, data=None):
    url = "https://api.github.com" + path
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, method=method,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        })
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

result = {}

# Step 1: Check if repo exists
try:
    repo = api("GET", "/repos/MichaelZ1102/pr-tool-test")
    result["action"] = "already_exists"
    result["html_url"] = repo.get("html_url")
    result["clone_url"] = repo.get("clone_url")
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    if e.code == 404:
        # Create repo
        data = {
            "name": "pr-tool-test",
            "description": "Test repository for PR-tool GitHub App development",
            "private": False,
            "auto_init": True,
            "gitignore_template": "Node"
        }
        repo = api("POST", "/user/repos", data)
        result["action"] = "created"
        result["html_url"] = repo.get("html_url")
        result["clone_url"] = repo.get("clone_url")
    else:
        result["error"] = f"HTTP {e.code}: {err_body}"
except Exception as ex:
    result["error"] = str(ex)

print(json.dumps(result))
