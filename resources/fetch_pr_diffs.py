#!/usr/bin/env python3
"""Fetch real PR diffs from open-source projects and save as JSON for prompt testing."""
import urllib.request
import urllib.error
import json
import os
import time

OUTPUT_DIR = "F:/personal-space/Project/PR-tool/resources/pr-diffs"

# List of repos and specific PRs
PRS = [
    ("honojs/hono", 3685, "feat: cors middleware enhancement"),
    ("honojs/hono", 3650, "fix: handle empty body in json middleware"),
    ("honojs/hono", 3700, "refactor: router type inference"),
    ("vitejs/vite", 19500, "feat: custom asset directory"),
    ("vitejs/vite", 19450, "fix: resolve alias in CSS @import"),
    ("microsoft/TypeScript", 61000, "feat: new utility type"),
    ("shadcn-ui/ui", 7000, "feat: new sidebar component"),
    ("colinhacks/zod", 3800, "feat: discriminated union improvements"),
    ("trpc/trpc", 6000, "fix: ssr context handling"),
    ("prisma/prisma", 26000, "feat: improve relation queries"),
    ("biomejs/biome", 4500, "feat: new linter rule"),
    ("radix-ui/primitives", 3200, "fix: dialog scroll behavior"),
]

os.makedirs(OUTPUT_DIR, exist_ok=True)

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
success = 0
fail = 0

for owner_repo, pr_number, desc in PRS:
    owner, repo = owner_repo.split("/")
    outfile = os.path.join(OUTPUT_DIR, f"{owner}-{repo}-{pr_number}.json")

    if os.path.exists(outfile):
        print(f"[SKIP] {owner_repo}#{pr_number} already exists")
        success += 1
        continue

    # Fetch PR details
    api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
    req = urllib.request.Request(api_url)
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("User-Agent", "PR-Prompt-Optimizer/1.0")
    if GITHUB_TOKEN:
        req.add_header("Authorization", f"Bearer {GITHUB_TOKEN}")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            pr_data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"[FAIL] {owner_repo}#{pr_number} API: {e}")
        fail += 1
        continue

    # Fetch diff
    diff_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
    diff_req = urllib.request.Request(diff_url)
    diff_req.add_header("Accept", "application/vnd.github.v3.diff")
    diff_req.add_header("User-Agent", "PR-Prompt-Optimizer/1.0")
    if GITHUB_TOKEN:
        diff_req.add_header("Authorization", f"Bearer {GITHUB_TOKEN}")

    try:
        with urllib.request.urlopen(diff_req, timeout=30) as resp:
            diff_text = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"[FAIL] {owner_repo}#{pr_number} diff: {e}")
        fail += 1
        continue

    # Parse diff into files
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
        elif raw_line.startswith("new file mode") and current_file:
            current_file["status"] = "added"
            current_patch.append(raw_line)
        elif raw_line.startswith("deleted file mode") and current_file:
            current_file["status"] = "removed"
            current_patch.append(raw_line)
        elif raw_line.startswith("rename from ") and current_file:
            current_file["status"] = "renamed"
            current_patch.append(raw_line)
        elif raw_line.startswith("@@ ") and current_file:
            current_patch.append(raw_line)
        elif raw_line.startswith("+") and current_file and not raw_line.startswith("+++"):
            current_file["additions"] += 1
            total_add += 1
            current_patch.append(raw_line)
        elif raw_line.startswith("-") and current_file and not raw_line.startswith("---"):
            current_file["deletions"] += 1
            total_del += 1
            current_patch.append(raw_line)
        elif raw_line == "" or raw_line.startswith("---") or raw_line.startswith("+++") or raw_line.startswith("index "):
            if current_file:
                current_patch.append(raw_line)
        else:
            if current_file:
                current_patch.append(raw_line)

    if current_file:
        current_file["patch"] = "\n".join(current_patch)
        files.append(current_file)

    output = {
        "repoFullName": f"{owner}/{repo}",
        "prNumber": pr_number,
        "prTitle": pr_data.get("title", ""),
        "prBody": pr_data.get("body", "") or "",
        "prUrl": pr_data.get("html_url", ""),
        "totalAdditions": total_add,
        "totalDeletions": total_del,
        "totalFiles": len(files),
        "files": files,
    }

    with open(outfile, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"[OK]   {owner_repo}#{pr_number} — {len(files)} files, +{total_add}/-{total_del} lines")
    success += 1
    time.sleep(0.8)

print(f"\nDone: {success} succeeded, {fail} failed")
