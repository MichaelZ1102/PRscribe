import json
import subprocess
import sys

# Use bash to extract the token safely
cmd = ["bash", "-c", "source /c/Users/Administrator/AppData/Local/hermes/profiles/personal-space/.env 2>/dev/null; echo \"${GITHUB_TOKEN}\""]
result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
token = result.stdout.strip()

if not token:
    print("NO_TOKEN")
    print("STDERR:", result.stderr)
    sys.exit(1)

import urllib.request
import urllib.error

def api(method, path, data=None):
    url = "https://api.github.com" + path
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        })
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

# Check repo existence
try:
    repo = api("GET", "/repos/MichaelZ1102/pr-tool-test")
    print("REPO_EXISTS", json.dumps({"html_url": repo.get("html_url")}))
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    if e.code == 404:
        print("Creating repo...")
        data = {
            "name": "pr-tool-test",
            "description": "Test repository for PR-tool GitHub App development",
            "private": False,
            "auto_init": True,
            "gitignore_template": "Node"
        }
        repo = api("POST", "/user/repos", data)
        print("REPO_CREATED", json.dumps({"html_url": repo.get("html_url"), "clone_url": repo.get("clone_url")}))
    else:
        print("ERROR", e.code, err_body)
except Exception as ex:
    print("EXCEPTION", str(ex))
