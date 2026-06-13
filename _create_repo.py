#!/usr/bin/env python
import json, re, urllib.request, urllib.error

env_path = "C:/Users/Administrator/AppData/Local/hermes/profiles/personal-space/.env"
token = None
with open(env_path, "r", encoding="utf-8", errors="replace") as f:
    for line in f:
        line = line.strip()
        if line.startswith("GITHUB_TOKEN=") and not line.startswith("#"):
            raw = line.split("=", 1)[1]
            if raw.startswith('"') and raw.endswith('"'):
                raw = raw[1:-1]
            token = raw
            break

if not token:
    print("NO_TOKEN"); exit(1)

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

# Check user info
user = api("GET", "/user")
print("=== User Info ===")
print("Login:", user.get("login"))
print("ID:", user.get("id"))
print("Name:", user.get("name"))

# Create the test repo
print("\n=== Creating repo: pr-tool-test ===")
data = {
    "name": "pr-tool-test",
    "description": "Test repository for PR-tool GitHub App development",
    "private": True,
    "auto_init": True,
    "gitignore_template": "Node"
}
try:
    repo = api("POST", "/user/repos", data)
    print("CREATED:", json.dumps({"html_url": repo.get("html_url"), "clone_url": repo.get("clone_url")}, indent=2))
except urllib.error.HTTPError as e:
    err = e.read().decode()
    if "already exists" in err.lower():
        print("ALREADY_EXISTS")
        repo = api("GET", "/repos/MichaelZ1102/pr-tool-test")
        print("EXISTING:", json.dumps({"html_url": repo.get("html_url")}, indent=2))
    else:
        print("ERROR:", e.code)
        print("BODY:", err[:500])
except Exception as ex:
    print("EXCEPTION:", str(ex))
