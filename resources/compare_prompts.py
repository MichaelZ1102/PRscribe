#!/usr/bin/env python3
"""
Comparative Prompt Test — eval v1 vs v2 on the same 12 PR diffs.
Measures coverage of each prompt's capabilities.
"""
import json, os

DIFFS_DIR = "F:/personal-space/Project/PR-tool/resources/pr-diffs"
OUTPUT_DIR = "F:/personal-space/Project/PR-tool/resources/test-results"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def load_diffs():
    diffs = []
    for fname in sorted(os.listdir(DIFFS_DIR)):
        if not fname.endswith('.json'):
            continue
        with open(os.path.join(DIFFS_DIR, fname)) as f:
            diffs.append(json.load(f))
    return diffs

# v2 specific capability checks
CAPABILITIES_V2 = {
    "change_type_inference": [
        "prompt must infer change type from diff patterns, not just title prefix",
        "Check: v2 has 'Change Type Detection' section",
    ],
    "small_diff_handling": [
        "prompt must handle small diffs without generating boilerplate",
        "Check: v2 has 'Diff Size Handling' section",
    ],
    "large_diff_handling": [
        "prompt must handle large diffs with file-level summary",
        "Check: v2 has 'Diff Size Handling' section",
    ],
    "mixed_file_types": [
        "prompt must categorize code/tests/config/docs/changeset files differently",
        "Check: v2 has 'Mixed File Types' section",
    ],
    "changeset_awareness": [
        "prompt must ignore changeset files from functional analysis",
        "Check: v2 lists changeset handling",
    ],
    "test_suggestions_default": [
        "prompt should suggest tests even when diff has none",
        "Check: v2 has 'Test Suggestions' section",
    ],
    "impact_scope_small": [
        "prompt must list scope even for single-file PRs",
        "Check: v2 has 'Impact Scope' section",
    ],
    "why_inference_short_title": [
        "prompt must infer 'why' from diff when title is short/missing",
        "Check: v2 has 'Change Inference' section",
    ],
    "chore_prefix_guidance": [
        "prompt must guide chore/docs prefix usage",
        "Check: v2 title format requires [type] prefix",
    ],
    "dependency_update_handling": [
        "prompt must handle dep-only PRs concisely",
        "Check: v2 has 'Special Cases' section",
    ],
    "binary_file_handling": [
        "prompt must mention binary files without analyzing content",
        "Check: v2 has 'Special Cases' for binary",
    ],
    "empty_diff_handling": [
        "prompt must handle empty diffs gracefully",
        "Check: v2 has 'Special Cases' for empty",
    ],
}

def check_capability(prompt_text, capability_key):
    """Check if v2 prompt text contains relevant guidance for each capability."""
    text_lower = prompt_text.lower()
    checks = {
        "change_type_inference": ["change type detection", "determine change type", "analyze the diff"],
        "small_diff_handling": ["small diff", "<5 changed"],
        "large_diff_handling": ["large diff", ">500 lines", "file-level summary"],
        "mixed_file_types": ["mixed file type", "recognize and correctly categorize", "code changes", "config files"],
        "changeset_awareness": ["changeset", "metadata"],
        "test_suggestions_default": ["test suggestion", "every pr", "even if no tests"],
        "impact_scope_small": ["impact scope", "single-file", "always list"],
        "why_inference_short_title": ["change inference", "pr title is short", "infer intent"],
        "chore_prefix_guidance": ["[feat]", "[fix]", "[refactor]", "[chore]", "[docs]", "change type must"],
        "dependency_update_handling": ["dependency update", "chore pr", "special cases"],
        "binary_file_handling": ["binary file", "special cases"],
        "empty_diff_handling": ["empty diff", "whitespace", "special cases"],
    }
    keywords = checks.get(capability_key, [])
    return any(kw in text_lower for kw in keywords)

def evaluate_diff_with_prompt(data, has_capability):
    """Score a specific diff against what the prompt claims to handle."""
    scores = []
    files = data.get('files', [])
    total_add = data['totalAdditions']
    total_del = data['totalDeletions']
    all_fnames = [f['filename'] for f in files]
    title = data.get('prTitle', '')
    
    # Check small diffs
    if total_add + total_del < 5:
        if has_capability('small_diff_handling'):
            scores.append(('small_diff', 2))
        elif has_capability('small_diff_handling'):
            scores.append(('small_diff', 1))
        else:
            scores.append(('small_diff', 0))
    
    # Check mixed file types
    has_non_code = any(f['filename'].endswith(('.md', '.json', '.yaml', '.snap', '.lock')) for f in files)
    has_changeset = any('.changeset/' in f['filename'] for f in files)
    if has_non_code and has_capability('mixed_file_types'):
        scores.append(('mixed_types', 2))
    elif has_non_code:
        scores.append(('mixed_types', 0))
    
    # Check changeset handling
    if has_changeset:
        if has_capability('changeset_awareness'):
            scores.append(('changeset', 2))
        else:
            scores.append(('changeset', 0))
    
    # Check impact scope for small diffs
    if len(files) <= 2:
        if has_capability('impact_scope_small'):
            scores.append(('impact_scope', 2))
        else:
            scores.append(('impact_scope', 0))
    
    # Check test suggestions
    has_tests = any('test' in f['filename'].lower() or 'spec' in f['filename'].lower() for f in files)
    if not has_tests:
        if has_capability('test_suggestions_default'):
            scores.append(('test_suggest', 2))
        else:
            scores.append(('test_suggest', 0))
    
    # Check why-inference for short titles
    if len(title) < 30 or title.startswith('PR #'):
        if has_capability('why_inference_short_title'):
            scores.append(('why_infer', 2))
        else:
            scores.append(('why_infer', 0))
    
    # Check dependency update handling
    is_dep_update = any(kw in title.lower() for kw in ['update dependency', 'chore(deps)', 'update engines'])
    if is_dep_update:
        if has_capability('dependency_update_handling'):
            scores.append(('dep_update', 2))
        else:
            scores.append(('dep_update', 0))
    
    return scores

def run_comparison():
    diffs = load_diffs()
    
    with open("F:/personal-space/Project/PR-tool/src/prompt-templates/pr-description-v1.md") as f:
        v1_text = f.read()
    with open("F:/personal-space/Project/PR-tool/src/prompt-templates/pr-description-v2.md") as f:
        v2_text = f.read()
    
    # Check overall capability coverage
    print("=" * 70)
    print("CAPABILITY COMPARISON: v1 vs v2")
    print("=" * 70)
    v1_caps = {}
    v2_caps = {}
    for cap_key in CAPABILITIES_V2:
        v1_has = check_capability(v1_text, cap_key)
        v2_has = check_capability(v2_text, cap_key)
        v1_caps[cap_key] = v1_has
        v2_caps[cap_key] = v2_has
        status = "✓" if v2_has else "✗"
        improved = "+" if v2_has and not v1_has else " "
        label = cap_key.replace('_', ' ')
        print(f"  {status} {label:35s}  v1={'✓' if v1_has else '✗'}  v2={'✓' if v2_has else '✗'}{' (NEW!)' if improved == '+' else ''}")
    
    v1_total = sum(1 for v in v1_caps.values() if v)
    v2_total = sum(1 for v in v2_caps.values() if v)
    print(f"\n  Coverage: v1 = {v1_total}/{len(CAPABILITIES_V2)}, v2 = {v2_total}/{len(CAPABILITIES_V2)}")
    
    # Per-PR scoring
    print(f"\n{'='*70}")
    print("PER-PR COMPARISON: v1 vs v2")
    print("=" * 70)
    
    total_v1 = 0
    total_v2 = 0
    max_score = 0
    pr_results = []
    
    for data in diffs:
        v1_scores = evaluate_diff_with_prompt(data, lambda k: check_capability(v1_text, k))
        v2_scores = evaluate_diff_with_prompt(data, lambda k: check_capability(v2_text, k))
        
        v1_pct = sum(s[1] for s in v1_scores) / (len(v1_scores) * 2) * 100 if v1_scores else 0
        v2_pct = sum(s[1] for s in v2_scores) / (len(v2_scores) * 2) * 100 if v2_scores else 0
        
        repo = data['repoFullName']
        num = data['prNumber']
        title = data.get('prTitle', '')[:50]
        
        delta = v2_pct - v1_pct
        icon = "++" if delta >= 25 else "+" if delta > 0 else "=" if delta == 0 else "-"
        
        print(f"\n  {repo}#{num}")
        print(f"    {title}")
        print(f"    v1: {v1_pct:.0f}%  v2: {v2_pct:.0f}%  {icon}{delta:+.0f}%")
        
        # Show what changed
        v1_only_issues = [s[0] for s in v1_scores if s[1] == 0]
        v2_only_issues = [s[0] for s in v2_scores if s[1] == 0]
        v1_only_set = set(v1_only_issues) - set(v2_only_issues)
        if v1_only_set:
            for iss in v1_only_set:
                print(f"      → v2 now handles: {iss}")
        
        total_v1 += v1_pct
        total_v2 += v2_pct
        
        pr_results.append({
            'repo': repo,
            'pr': num,
            'v1_score': round(v1_pct, 1),
            'v2_score': round(v2_pct, 1),
            'delta': round(delta, 1),
        })
    
    avg_v1 = total_v1 / len(diffs)
    avg_v2 = total_v2 / len(diffs)
    
    print(f"\n{'='*70}")
    print(f"FINAL RESULTS")
    print(f"{'='*70}")
    print(f"  v1 average: {avg_v1:.1f}%")
    print(f"  v2 average: {avg_v2:.1f}%")
    print(f"  Improvement: +{avg_v2 - avg_v1:.1f}%")
    
    # Save to JSON
    with open(os.path.join(OUTPUT_DIR, 'v1-v2-comparison.json'), 'w', encoding='utf-8') as fp:
        json.dump({
            'v1_capabilities': {k: v for k, v in v1_caps.items()},
            'v2_capabilities': {k: v for k, v in v2_caps.items()},
            'v1_coverage': f"{v1_total}/{len(CAPABILITIES_V2)}",
            'v2_coverage': f"{v2_total}/{len(CAPABILITIES_V2)}",
            'pr_results': pr_results,
            'avg_v1': round(avg_v1, 1),
            'avg_v2': round(avg_v2, 1),
            'improvement': round(avg_v2 - avg_v1, 1),
        }, ensure_ascii=False, indent=2)
    print(f"\nResults saved to {OUTPUT_DIR}/v1-v2-comparison.json")

if __name__ == '__main__':
    run_comparison()
