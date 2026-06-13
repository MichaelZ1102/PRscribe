#!/usr/bin/env python3
"""Fetch more quality PR diffs using GitHub .diff URLs."""
import urllib.request
import json
import os

OUT = "F:/personal-space/Project/PR-tool/resources/pr-diffs"
os.makedirs(OUT, exist_ok=True)

PRS = [
    ('vitejs/vite', 18407),
    ('vitejs/vite', 9425),
    ('shadcn-ui/ui', 7902),
    ('shadcn-ui/ui', 7782),
    ('shadcn-ui/ui', 9708),
    ('microsoft/TypeScript', 48283),
    ('honojs/hono', 3830),
]

for owner_repo, num in PRS:
    owner, repo = owner_repo.split('/')
    sf = f'{owner}-{repo}'
    out = f'{OUT}/{sf}-{num}.json'
    if os.path.exists(out):
        print(f'SKIP {owner}/{repo}#{num}')
        continue

    url = f'https://github.com/{owner}/{repo}/pull/{num}.diff'
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/plain, */*',
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            txt = r.read().decode('utf-8', 'replace')
        if not txt.strip() or len(txt) < 50:
            print(f'EMPTY {owner}/{repo}#{num}')
            continue
    except Exception as e:
        print(f'FAIL {owner}/{repo}#{num}: {e}')
        continue

    files = []
    cur = None
    patch = []
    ta = td = 0
    for line in txt.split('\n'):
        if line.startswith('diff --git '):
            if cur:
                cur['patch'] = '\n'.join(patch)
                files.append(cur)
            fp = line.split(' ')[-1][2:]
            cur = {'filename': fp, 'status': 'modified', 'additions': 0, 'deletions': 0}
            patch = [line]
        elif cur:
            if line.startswith('new file mode'):
                cur['status'] = 'added'
            elif line.startswith('deleted file mode'):
                cur['status'] = 'removed'
            elif line.startswith('+') and not line.startswith('+++'):
                cur['additions'] += 1
                ta += 1
            elif line.startswith('-') and not line.startswith('---'):
                cur['deletions'] += 1
                td += 1
            patch.append(line)
    if cur:
        cur['patch'] = '\n'.join(patch)
        files.append(cur)

    if ta + td < 5:
        print(f'TRIVIAL {owner}/{repo}#{num}: +{ta}/-{td}')
        continue

    data = {
        'repoFullName': f'{owner}/{repo}',
        'prNumber': num,
        'prTitle': f'PR #{num}',
        'prBody': '',
        'prUrl': f'https://github.com/{owner}/{repo}/pull/{num}',
        'totalAdditions': ta,
        'totalDeletions': td,
        'totalFiles': len(files),
        'files': files,
    }

    with open(out, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'OK {owner}/{repo}#{num}: {len(files)} files +{ta}/-{td}')

print('Done')
