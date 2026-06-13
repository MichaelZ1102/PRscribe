#!/usr/bin/env python3
"""Fetch real PR diffs from GitHub using web URLs instead of API (rate-limit friendly)."""
import urllib.request
import json
import os
import time
import re

OUTPUT_DIR = "F:/personal-space/Project/PR-tool/resources/pr-diffs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Validated PRs (from earlier search results — these exist)
PRS = [
    # Honojs — already have 3685
    # Vite — good quality PRs
    ("vitejs/vite", 20163, "feat: add base option to import.meta.glob"),
    ("vitejs/vite", 18407, "feat(create-vite): update to svelte 5"),
    ("vitejs/vite", 9425, "fix(glob): server perf when globbing huge dirs"),
    ("vitejs/vite", 9399, "fix: url constructor import asset no as url"),
    # shadcn-ui — good frontend PRs
    ("shadcn-ui/ui", 7902, "feat(shadcn): add envVars to schema"),
    ("shadcn-ui/ui", 7896, "feat: update handling of env files in registry"),
    ("shadcn-ui/ui", 7782, "feat: support for universal registry item"),
    ("shadcn-ui/ui", 9708, "fix: handling of @apply inside @utility"),
    # TypeScript
    ("microsoft/TypeScript", 48283, "fix: parameter type inlay hints"),
    # Additional quality PRs
    ("honojs/hono", 3868, "fix: improve router matching"),
    ("honojs/hono", 3830, "feat: add context timeout"),
]

def parse_diff_to_files(diff_text, owner, repo, pr_number):
    """Parse raw diff text into structured JSON."""
    files = []
    current_file = None
    current_patch = []
    total_add = 0
    total_del = 0

    for raw_line in diff_text.split("\n"):
        if raw_line.startswith("diff --git "):
            if current_file:
                current_file["patch"] = "\n".join(current_patch)
                files.append(current_file)
            parts = raw_line.split(" ")
            file_path = parts[-1][2:] if len(parts) >= 3 else parts[-1]
            current_file = {"filename": file_path, "status": "modified", "additions": 0, "deletions": 0}
            current_patch = [raw_line]
        elif current_file:
            if raw_line.startswith("new file mode"):
                current_file["status"] = "added"
            elif raw_line.startswith("deleted file mode"):
                current_file["status"] = "removed"
            elif raw_line.startswith("rename from "):
                current_file["status"] = "renamed"
            elif raw_line.startswith("+") and not raw_line.startswith("+++"):
                current_file["additions"] += 1
                total_add += 1
            elif raw_line.startswith("-") and not raw_line.startswith("---"):
                current_file["deletions"] += 1
                total_del += 1
            current_patch.append(raw_line)

    if current_file:
        current_file["patch"] = "\n".join(current_patch)
        files.append(current_file)

    output = {
        "repoFullName": f"{owner}/{repo}",
        "prNumber": pr_number,
        "prTitle": f"PR #{pr_number}",
        "prBody": "",
        "prUrl": f"https://github.com/{owner}/{repo}/pull/{pr_number}",
        "totalAdditions": total_add,
        "totalDeletions": total_del,
        "totalFiles": len(files),
        "files": files,
    }
    return output

success = 0
fail = 0

for owner_repo, pr_number, desc in PRS:
    owner, repo = owner_repo.split("/")
    safe_name = owner_repo.replace("/", "-")
    outfile = os.path.join(OUTPUT_DIR, f"{safe_name}-{pr_number}.json")

    if os.path.exists(outfile):
        print(f"[SKIP] {owner_repo}#{pr_number} already exists")
        success += 1
        continue

    # Fetch PR diff directly from GitHub's .diff endpoint
    diff_url = f"https://github.com/{owner}/{repo}/pull/{pr_number}.diff"
    req = urllib.request.Request(diff_url)
    req.add_header("User-Agent", "Mozilla/5.0 (compatible; PR-Tool/1.0)")
    req.add_header("Accept", "text/plain, */*")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            diff_text = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"[FAIL] {owner_repo}#{pr_number} diff: {e}")
        fail += 1
        continue

    # Skip very small/noop diffs
    lines = diff_text.strip().split("\n")
    if len(lines) < 10 or diff_text.strip() == "":
        print(f"[SKIP] {owner_repo}#{pr_number} — empty/too small ({len(lines)} lines)")
        fail += 1
        continue

    output = parse_diff_to_files(diff_text, owner, repo, pr_number)

    # Skip if total changes are too small (less than 5 lines changed total)
    if output["totalAdditions"] + output["totalDeletions"] < 5 and output["totalFiles"] <= 2:
        print(f"[SKIP] {owner_repo}#{pr_number} — trivial diff (+{output['totalAdditions']}/-{output['totalDeletions']})")
        fail += 1
        continue

    with open(outfile, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"[OK]   {owner_repo}#{pr_number} — {output['totalFiles']} files, +{output['totalAdditions']}/-{output['totalDeletions']} lines")
    success += 1
    time.sleep(1.5)  # Be gentle

print(f"\nDone: {success} succeeded, {fail} failed")
