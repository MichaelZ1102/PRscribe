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

try:
    repo = api("GET", "/repos/MichaelZ1102/pr-tool-test")
    print("EXISTS:", json.dumps({"html_url": repo.get("html_url"), "clone_url": repo.get("clone_url")}, indent=2))
except urllib.error.HTTPError as e:
    err = e.read().decode()
    if e.code == 404:
        print("NOT_FOUND")
    else:
        print("ERROR:", e.code, err[:300])
