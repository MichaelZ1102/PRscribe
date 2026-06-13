f = open("C:/Users/Administrator/AppData/Local/hermes/profiles/personal-space/.env", "rb")
for line in f:
    if line.startswith(b"GITHUB_TOKEN"):
        print(repr(line))
f.close()
