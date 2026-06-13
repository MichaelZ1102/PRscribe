import json
import os

env_path = "C:/Users/Administrator/AppData/Local/hermes/profiles/personal-space/.env"
token = None
with open(env_path, encoding="utf-8") as f:
    for line in f:
        stripped = line.strip()
        if stripped.startswith("GITHUB_TOKEN="):
            token = stripped.split("=", 1)[1]
            break

if token is None:
    print("NO_TOKEN")
    exit(1)

import urllib.request
req = urllib.request.Request(
    "https://api.github.com/user",
    headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github.v3+json"
    }
)
resp = urllib.request.urlopen(req)
d = json.loads(resp.read())
print("Login:", d.get("login"))
print("ID:", d.get("id"))
print("Type:", d.get("type"))
print("Name:", d.get("name"))
