import os
import json
import urllib.request
import urllib.error

# Get token directly from environment - the terminal has this from Hermes
token = os.environ.get("GITHUB_TOKEN", "")
if not token:
    print("NO_TOKEN")
    exit(1)

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
try:
    resp = api("GET", "/user")
    result["login"] = resp.get("login")
except Exception as ex:
    result["user_error"] = str(ex)

try:
    resp = api("GET", "/user/repos?per_page=5&sort=pushed")
    result["repos"] = [r.get("full_name") for r in resp]
except Exception as ex:
    result["repo_list_error"] = str(ex)

# Try to create repo
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
except urllib.error.HTTPError as e:
    err = e.read().decode()
    result["create_error"] = f"HTTP {e.code}: {err}"
except Exception as ex:
    result["create_exception"] = str(ex)

print(json.dumps(result, indent=2))
