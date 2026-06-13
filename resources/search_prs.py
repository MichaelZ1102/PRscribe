#!/usr/bin/env python3
"""Search for valid merged PR numbers from popular open-source projects."""
import urllib.request
import json

def search_prs(repo, label, max_results=3):
    url = f'https://api.github.com/search/issues?q=repo:{repo}+type:pr+is:merged+label:{label}&sort=created&order=desc&per_page={max_results}'
    req = urllib.request.Request(url)
    req.add_header('Accept', 'application/vnd.github.v3+json')
    req.add_header('User-Agent', 'PR-Tool/1.0')
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode())
    results = []
    for item in data.get('items', []):
        lbl = item['labels'][0]['name'] if item['labels'] else 'none'
        results.append((item['number'], item['title'], lbl))
    return results

repos = [
    ('honojs/hono', ['feat', 'enhancement', 'fix']),
    ('vitejs/vite', ['feat', 'enhancement', 'bug', 'fix']),
    ('shadcn-ui/ui', ['enhancement', 'bug']),
    ('radix-ui/primitives', ['bug', 'enhancement']),
    ('microsoft/TypeScript', ['feat', 'bug']),
    ('biomejs/biome', ['feat', 'bug', 'enhancement']),
    ('prisma/prisma', ['feat', 'fix']),
    ('trpc/trpc', ['feat', 'fix', 'enhancement']),
    ('colinhacks/zod', ['feat', 'fix']),
]

for repo, labels in repos:
    for label in labels:
        try:
            results = search_prs(repo, label)
            if results:
                print(f'--- {repo} ({label}) ---')
                for num, title, lbl in results:
                    print(f'  #{num} [{lbl}] {title[:120]}')
        except Exception as e:
            print(f'--- {repo} ({label}) --- ERROR: {e}')
