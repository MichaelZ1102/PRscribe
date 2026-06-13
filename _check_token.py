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

# Check token scopes and type
req = urllib.request.Request("https://api.github.com/user",
    headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github.v3+json"
    })
resp = urllib.request.urlopen(req)
print("=== Token Info ===")
print("Scopes:", resp.headers.get("X-OAuth-Scopes", "none"))
print("Accepted Scopes:", resp.headers.get("X-Accepted-OAuth-Scopes", "none"))
user = json.loads(resp.read())
print("Login:", user.get("login"))
print("Type:", user.get("type"))

# Check token type via /applications/grants
req2 = urllib.request.Request("https://api.github.com/user/installations",
    headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github.v3+json"
    })
try:
    resp2 = urllib.request.urlopen(req2)
    installs = json.loads(resp2.read())
    print("Installations:", len(installs.get("installations", [])))
except urllib.error.HTTPError as e:
    print("No installs access:", e.code)
