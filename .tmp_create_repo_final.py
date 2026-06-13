#!/usr/bin/env python3
import json
import re
import urllib.request
import urllib.error

env_path = "C:/Users/Administrator/AppData/Local/hermes/profiles/personal-space/.env"
token = None
with open(env_path, "r", encoding="utf-8", errors="replace") as f:
    for line in f:
        original_line = line
        line = line.strip()
        if "GITHUB_TOKEN" in line and not line.startswith("#"):
            print("DEBUG_MATCHING:", repr(original_line))
            m = re.match(r'^GITHUB_TOKEN=(.*)$', line)
            if m:
                raw_val = m.group(1)
                if raw_val.startswith('"') and raw_val.endswith('"'):
                    raw_val = raw_val[1:-1]
                token = raw_val
                print("DEBUG_TOKEN_LEN:", len(token))
                break
            else:
                print("DEBUG_NO_REGEX_MATCH for:", repr(line))

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
    user = api("GET", "/user")
    result["login"] = user.get("login")
except Exception as e:
    result["user_error"] = str(e)

try:
    data = {
        "name": "pr-tool-test",
        "description": "Test repository for PR-tool GitHub App development",
        "private": True,
        "auto_init": True,
        "gitignore_template": "Node"
    }
    resp = api("POST", "/user/repos", data)
    result["action"] = "created"
    result["html_url"] = resp.get("html_url", "")
    result["clone_url"] = resp.get("clone_url", "")
except urllib.error.HTTPError as e:
    err = e.read().decode()
    result["create_error"] = f"HTTP {e.code}: {err[:400]}"
except Exception as e:
    result["create_exception"] = str(e)

# Fallback: try public
if "create_error" in result and "already exists" not in result["create_error"].lower():
    try:
        data = {
            "name": "pr-tool-test",
            "description": "Test repository for PR-tool GitHub App development",
            "private": False,
            "auto_init": True,
            "gitignore_template": "Node"
        }
        resp = api("POST", "/user/repos", data)
        result["action"] = "created_public"
        result["html_url"] = resp.get("html_url", "")
        result["clone_url"] = resp.get("clone_url", "")
        del result["create_error"]
    except urllib.error.HTTPError as e2:
        err2 = e2.read().decode()
        if "already exists" in err2.lower():
            result["action"] = "already_exists"
            try:
                existing = api("GET", "/repos/MichaelZ1102/pr-tool-test")
                result["html_url"] = existing.get("html_url", "")
            except:
                pass
            if "create_error" in result:
                del result["create_error"]
        else:
            result["create_error2"] = f"HTTP {e2.code}: {err2[:400]}"

print(json.dumps(result, indent=2))
