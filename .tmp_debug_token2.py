import json

env_path = "C:/Users/Administrator/AppData/Local/hermes/profiles/personal-space/.env"
token = None
with open(env_path, "rb") as f:
    for raw_line in f:
        if raw_line.startswith(b"GITHUB_TOKEN=***            raw_val = raw_line[len(b"GITHUB_TOKEN=***            token = raw_val.decode("utf-8", errors="replace").strip()
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

# Check token's installations/permissions (fine-grained tokens use this endpoint)
try:
    req = urllib.request.Request(
        "https://api.github.com/user/installations",
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github.v3+json"
        })
    resp = urllib.request.urlopen(req)
    inst = json.loads(resp.read())
    print("INSTALLATIONS:", json.dumps(inst.get("installations", []), indent=2)[:2000])
except urllib.error.HTTPError as e:
    err = e.read().decode()
    print("INSTALLATION_ERR:", e.code, err)

# The token is classic PAT if it starts with ghp_, fine-grained if github_pat_
print("TOKEN_PREFIX:", token[:4] + ("..." if len(token) > 4 else ""))

# Try to get token details - this might work for fine-grained PATs
try:
    req = urllib.request.Request(
        "https://api.github.com/user",
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github.v3+json"
        })
    resp = urllib.request.urlopen(req)
    print("X-OAuth-Scopes:", resp.headers.get("X-OAuth-Scopes", "(none)"))
    print("X-Accepted-OAuth-Scopes:", resp.headers.get("X-Accepted-OAuth-Scopes", "(none)"))
except Exception as ex:
    print("HEADER_ERR:", str(ex))
