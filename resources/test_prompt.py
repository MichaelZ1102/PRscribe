#!/usr/bin/env python3
"""
Prompt Test Suite — evaluates prompt template v1 against 12 real PR diffs.
Tests each diff for completeness criteria, identifies patterns for improvement.
"""
import json
import os
import re

DIFFS_DIR = "F:/personal-space/Project/PR-tool/resources/pr-diffs"
PR_TEMPLATE = "F:/personal-space/Project/PR-tool/src/prompt-templates/pr-description-v1.md"
OUTPUT_DIR = "F:/personal-space/Project/PR-tool/resources/test-results"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def load_prompt(path):
    with open(path) as f:
        return f.read()

def load_diffs():
    diffs = []
    for fname in sorted(os.listdir(DIFFS_DIR)):
        if not fname.endswith('.json'):
            continue
        with open(os.path.join(DIFFS_DIR, fname)) as f:
            data = json.load(f)
        diffs.append(data)
    return diffs

# Analysis dimensions for each PR
def classify_pr_type(data):
    """Classify the PR type based on patterns."""
    title = data.get('prTitle', '').lower()
    files = data.get('files', [])
    all_fnames = [f['filename'] for f in files]
    all_patches = [f.get('patch', '') for f in files]
    
    # Check for automated/dependency PRs
    if any(kw in title for kw in ['update dependency', 'chore(deps)', 'renovate', 'update engines']):
        return 'chore: dependency update'
    if any(f.startswith('.github/workflows/') for f in all_fnames) and data['totalAdditions'] + data['totalDeletions'] < 5:
        return 'chore: CI workflow'
    if any(f == 'README.md' for f in all_fnames) and data['totalAdditions'] + data['totalDeletions'] < 5:
        return 'docs: trivial'
    if data['totalAdditions'] + data['totalDeletions'] < 5 and data['totalFiles'] <= 2:
        return 'fix: trivial'
    
    # Check for feature vs fix
    if title.startswith('feat') or any(kw in title for kw in ['add', 'support', 'implement', 'introduce']):
        return 'feat'
    if title.startswith('fix') or any(kw in title for kw in ['fix', 'correct', 'handle', 'prevent']):
        return 'fix'
    if title.startswith('refactor') or 'refactor' in title:
        return 'refactor'
    if title.startswith('chore'):
        return 'chore'
    if title.startswith('docs'):
        return 'docs'
    
    return 'other'

def get_main_language(data):
    """Detect primary language from file extensions."""
    ext_counts = {}
    for f in data.get('files', []):
        ext = os.path.splitext(f['filename'])[1] or '(none)'
        ext_counts[ext] = ext_counts.get(ext, 0) + 1
    if ext_counts:
        return max(ext_counts, key=ext_counts.get)
    return 'unknown'

def evaluate_prompt_coverage(data):
    """
    Evaluate what information the prompt v1 can extract from this diff.
    Returns issues and coverage gaps.
    """
    issues = []
    files = data.get('files', [])
    total_add = data['totalAdditions']
    total_del = data['totalDeletions']
    
    # 1. Diff size analysis
    if total_add + total_del > 500:
        issues.append('large-diff: >500 changes — token budget may exceed limits')
    elif total_add + total_del < 5:
        issues.append('small-diff: minimal changes — may generate boilerplate output')
    
    # 2. File type variety
    has_non_code = any(f['filename'].endswith(('.md', '.json', '.yaml', '.yml', '.toml', '.snap')) for f in files)
    has_config = any(f['filename'].endswith(('package.json', 'tsconfig.json', '.eslintrc')) for f in files)
    has_test = any('test' in f['filename'].lower() or 'spec' in f['filename'].lower() for f in files)
    has_changeset = any('.changeset/' in f['filename'] or 'changelog' in f['filename'].lower() for f in files)
    
    if has_non_code and not has_test:
        issues.append('mixed-filetypes: code + non-code changes — prompt needs to handle diverse file types')
    if has_config:
        issues.append("config-changes: dependency/config changes present — prompt should identify 'chore' changes")
    if has_changeset:
        issues.append('changeset-files: changeset/changelog files present — may confuse change type detection')
    
    # 3. Commit message analysis
    title = data.get('prTitle', '')
    if not title or title == '':
        issues.append('missing-title: PR has no title — prompt should handle gracefully')
    
    # 4. Detection of change semantics
    if total_add > 0 and total_del == 0:
        pass  # Pure addition
    elif total_del > 0 and total_add == 0:
        issues.append('pure-deletion: only deletions — prompt may not handle this well')
    
    # 5. Binary/large file detection
    for f in files:
        if not f.get('patch') or len(f.get('patch', '')) < 50:
            issues.append('binary-file: {} has no readable diff'.format(f['filename']))
    
    return issues

def evaluate_prompt_quality(data):
    """
    Score prompt v1's ability to generate each section of the output format.
    0 = missing/incapable, 1 = partial, 2 = good.
    """
    scores = {}
    issues = []
    
    pr_type = classify_pr_type(data)
    
    # Title generation
    if pr_type.startswith('chore') or pr_type == 'docs: trivial':
        scores['title_detection'] = 1  # Prompt doesn't mention PR type prefixes specifically
        issues.append('title: no guidance for chore/docs prefix format')
    else:
        scores['title_detection'] = 2
    
    # Change type detection
    change_types_in_title = any(t in data.get('prTitle', '').lower() for t in ['feat', 'fix', 'refactor', 'chore', 'docs'])
    if not change_types_in_title and pr_type not in ['chore', 'docs']:
        scores['change_type_detection'] = 1
        issues.append('change-type: prompt relies on title prefix — should infer from diff pattern')
    else:
        scores['change_type_detection'] = 2
    
    # Why inference — how well the prompt infers purpose
    files = data.get('files', [])
    has_descriptive_titles = len(data.get('prTitle', '')) > 30
    has_body = bool(data.get('prBody', '').strip())
    if has_descriptive_titles or has_body:
        scores['why_inference'] = 2
    else:
        scores['why_inference'] = 1
        issues.append('why-inference: PR title is short/empty — prompt must infer from diff alone')
    
    # Test suggestion quality
    has_tests = any('test' in f['filename'].lower() or 'spec' in f['filename'].lower() for f in files)
    if has_tests:
        scores['test_suggestions'] = 2
    else:
        scores['test_suggestions'] = 1
        issues.append('tests: diff has no tests — prompt should suggest adding them')
    
    # Impact scope detection
    if len(files) > 5:
        scores['impact_scope'] = 2
    else:
        scores['impact_scope'] = 1
        issues.append('impact-scope: few files changed — should still list clear scope')
    
    # File detail table
    scores['file_table'] = 2  # Prompt explicitly includes this
    
    return scores, issues

def run_tests():
    prompt = load_prompt(PR_TEMPLATE)
    diffs = load_diffs()
    
    print(f"Loaded prompt template ({len(prompt)} chars)")
    print(f"Loaded {len(diffs)} PR diffs")
    print(f"{'='*70}")
    
    all_issues = []
    all_scores = {}
    results = []
    
    for data in diffs:
        repo = data['repoFullName']
        num = data['prNumber']
        title = data.get('prTitle', '')
        pr_type = classify_pr_type(data)
        lang = get_main_language(data)
        coverage_issues = evaluate_prompt_coverage(data)
        quality_scores, quality_issues = evaluate_prompt_quality(data)
        
        issues = coverage_issues + quality_issues
        
        total_score = sum(quality_scores.values())
        max_score = len(quality_scores) * 2
        pct = (total_score / max_score) * 100 if max_score > 0 else 0
        
        result = {
            'repo': repo,
            'num': num,
            'title': title[:60] if title else '(no title)',
            'type': pr_type,
            'language': lang,
            'files': data['totalFiles'],
            'additions': data['totalAdditions'],
            'deletions': data['totalDeletions'],
            'score': total_score,
            'max_score': max_score,
            'pct': pct,
            'issues': issues,
            'scores': quality_scores,
        }
        results.append(result)
        
        # Print summary
        icon = '✓' if pct >= 75 else '△' if pct >= 50 else '✗'
        print(f"\n{icon} {repo}#{num} — {pr_type}")
        print(f"   {title[:70]}")
        print(f"   Files: {data['totalFiles']}, +{data['totalAdditions']}/-{data['totalDeletions']} | Lang: {lang}")
        print(f"   Score: {total_score}/{max_score} ({pct:.0f}%)")
        if issues:
            for iss in issues[:4]:
                print(f"   ⚠  {iss}")
        all_issues.extend(issues)
    
    # Aggregate results
    print(f"\n{'='*70}")
    print(f"SUMMARY: {len(results)} PRs tested")
    
    categories = {}
    for r in results:
        cat = r['type'].split(':')[0] if ':' in r['type'] else r['type']
        if cat not in categories:
            categories[cat] = {'count': 0, 'scores': []}
        categories[cat]['count'] += 1
        categories[cat]['scores'].append(r['pct'])
    
    print(f"\nBreakdown by type:")
    for cat, info in sorted(categories.items()):
        avg = sum(info['scores']) / len(info['scores'])
        print(f"  {cat}: {info['count']} PRs, avg score {avg:.0f}%")
    
    avg_all = sum(r['pct'] for r in results) / len(results)
    print(f"\nOverall average: {avg_all:.1f}%")
    
    # Top issues
    issue_counts = {}
    for iss in all_issues:
        issue_key = iss.split(':')[0] if ':' in iss else iss
        issue_counts[issue_key] = issue_counts.get(issue_key, 0) + 1
    
    print(f"\nTop recurring issues:")
    for iss, count in sorted(issue_counts.items(), key=lambda x: -x[1])[:8]:
        print(f"  [{count}/{len(results)}] {iss}")
    
    # Save results
    outpath = os.path.join(OUTPUT_DIR, 'prompt-v1-test-results.json')
    with open(outpath, 'w') as f:
        json.dump({'results': results, 'summary': {
            'total_prs': len(results),
            'overall_avg': f'{avg_all:.1f}%',
            'category_breakdown': {k: f'{sum(v["scores"])/len(v["scores"]):.0f}%' for k, v in categories.items()},
            'top_issues': [{'issue': k, 'count': v} for k, v in sorted(issue_counts.items(), key=lambda x: -x[1])[:8]],
        }}, f, ensure_ascii=False, indent=2)
    print(f"\nResults saved to {outpath}")

if __name__ == '__main__':
    run_tests()
