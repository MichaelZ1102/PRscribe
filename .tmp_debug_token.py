import json

env_path = "C:/Users/Administrator/AppData/Local/hermes/profiles/personal-space/.env"
token = None
with open(env_path, "rb") as f:
    for raw_line in f:
        if raw_line.startswith(b"GITHUB_TOKEN="):
            raw_val = raw_line[len(b"GITHUB_TOKEN="):]
            token = raw_val.decode("utf-8", errors="replace").strip()
            break

if not token:
    print(json.dumps({"error": "NO_TOKEN"}))
    exit(1)

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

# Check token scopes first
try:
    req = urllib.request.Request("https://api.github.com/")
    req.add_header("Authorization", "Bearer " + token)
    resp = urllib.request.urlopen(req)
    result["scopes"] = resp.headers.get("X-OAuth-Scopes", "")
except Exception as ex:
    result["scope_error"] = str(ex)

# Check user
try:
    resp = api("GET", "/user")
    result["login"] = resp.get("login")
except Exception as ex:
    result["user_error"] = str(ex)

# Try to find if there's an existing repo or check what repos exist
try:
    resp = api("GET", "/user/repos?per_page=5&sort=pushed")
    result["repos"] = [r.get("full_name") for r in resp]
except urllib.error.HTTPError as e:
    err = e.read().decode()
    result["repo_list_error"] = f"HTTP {e.code}: {err}"
except Exception as ex:
    result["repo_list_exception"] = str(ex)

# Try creating the repo with private=False (public repo)
try:
    data = {
        "name": "pr-tool-test",
        "description": "Test repository for PR-tool GitHub App development",
        "private": True,
        "auto_init": True,
        "gitignore_template": "Node"
    }
    resp = api("POST", "/user/repos", data)
    result["created"] = resp.get("html_url", "")
    result["clone_url"] = resp.get("clone_url", "")
except urllib.error.HTTPError as e:
    err = e.read().decode()
    result["create_error"] = f"HTTP {e.code}: {err}"
except Exception as ex:
    result["create_exception"] = str(ex)

print(json.dumps(result, indent=2))
