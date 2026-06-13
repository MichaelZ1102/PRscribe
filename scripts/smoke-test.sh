#!/bin/bash
#
# 冒烟测试脚本 — AI PR 描述生成器
# 用法: ./scripts/smoke-test.sh [选项]
#
# 选项:
#   --url <URL>         部署 URL（必需）
#   --all               运行所有测试
#   --l0                仅基础设施测试
#   --l1                仅 API 测试
#   --e2e               E2E 测试（需要 --repo + --token）
#   --repo <owner/repo> 测试仓库
#   --token <token>     GitHub Token
#   --verbose           详细输出
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASSED=0
FAILED=0
TOTAL=0
URL=""
RUN_ALL=false
RUN_L0=false
RUN_L1=false
RUN_E2E=false
REPO=""
TOKEN=""
VERBOSE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)    URL="$2";     shift 2 ;;
    --all)    RUN_ALL=true; shift ;;
    --l0)     RUN_L0=true;  shift ;;
    --l1)     RUN_L1=true;  shift ;;
    --e2e)    RUN_E2E=true; shift ;;
    --repo)   REPO="$2";    shift 2 ;;
    --token)  TOKEN="$2";   shift 2 ;;
    --verbose) VERBOSE=true; shift ;;
    *)
      echo -e "${RED}未知参数: $1${NC}"
      echo "用法: $0 --url <URL> [--all | --l0 | --l1 | --e2e]"
      exit 1
      ;;
  esac
done

if [[ -z "$URL" ]]; then
  echo -e "${RED}错误: --url 是必需的${NC}"
  exit 1
fi
URL="${URL%/}"

echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  AI PR 描述生成器 — 冒烟测试${NC}"
echo -e "${CYAN}  目标: $URL${NC}"
echo -e "${CYAN}  时间: $(date -Is 2>/dev/null || date +%Y-%m-%dT%H:%M:%S%z)${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""

test_pass() {
  PASSED=$((PASSED + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${GREEN}✅ 通过${NC}"
}

test_fail() {
  local msg="$1"
  FAILED=$((FAILED + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${RED}❌ 失败: ${msg}${NC}"
}

run_test() {
  local name="$1"
  shift
  echo -e "${YELLOW}[TC-$(printf '%02d' $((TOTAL + 1)))]${NC} $name"
  local output
  output=$("$@" 2>&1 || true)
  local rc=$?
  if [[ $rc -eq 0 ]]; then
    test_pass
  else
    test_fail "退出码 $rc — $(echo "$output" | head -c 200)"
  fi
  if ${VERBOSE:-false} && [[ -n "$output" ]]; then
    echo "$output" | head -5 | sed 's/^/    /'
  fi
  echo ""
}

run_test_http() {
  local name="$1"
  local url="$2"
  local expected="$3"
  echo -e "${YELLOW}[TC-$(printf '%02d' $((TOTAL + 1)))]${NC} $name"
  local actual
  actual=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 "$url" 2>/dev/null || echo "000")
  if [[ "$actual" == "$expected" ]]; then
    test_pass
  else
    test_fail "预期 HTTP $expected, 实际 HTTP $actual"
  fi
  echo ""
}

# ── L0 ──
if $RUN_ALL || $RUN_L0; then
  echo -e "${CYAN}━━━ L0: 基础设施 ━━━${NC}"
  echo ""
  run_test_http "服务可达性" "$URL/" "200"
  run_test_http "健康检查端点" "$URL/api/health" "200"
  run_test "健康检查响应体" bash -c \
    "curl -s '$URL/api/health' | python3 -c \"import sys,json; d=json.load(sys.stdin); assert d.get('status')=='ok', 'status not ok'; print('status=ok')\""
fi

# ── L1 ──
if $RUN_ALL || $RUN_L1; then
  echo -e "${CYAN}━━━ L1: 核心 API ━━━${NC}"
  echo ""
  WEBHOOK_URL="$URL/api/webhook"
  CT='Content-Type: application/json'
  SIG='x-hub-signature-256: sha256=0000000000000000000000000000000000000000000000000000000000000000'
  EVT='x-github-event: pull_request'
  DLV='x-github-delivery: test-001'
  PAYLOAD='{"action":"opened","pull_request":{"number":1},"repository":{"full_name":"test/test"}}'

  echo -e "${YELLOW}[TC-$(printf '%02d' $((TOTAL + 1)))]${NC} Webhook — 非法签名"
  local hc
  hc=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$WEBHOOK_URL" \
    -H "$CT" -H "$SIG" -H "$EVT" -H "$DLV" \
    -d "$PAYLOAD" 2>/dev/null || echo "000")
  TOTAL=$((TOTAL + 1))
  if [[ "$hc" == "400" ]]; then test_pass; else test_fail "预期 HTTP 400, 实际 $hc"; fi
  echo ""

  echo -e "${YELLOW}[TC-$(printf '%02d' $((TOTAL + 1)))]${NC} Webhook — 缺少签名头"
  hc=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$WEBHOOK_URL" \
    -H "$CT" -d '{}' 2>/dev/null || echo "000")
  TOTAL=$((TOTAL + 1))
  if [[ "$hc" == "400" ]]; then test_pass; else test_fail "预期 HTTP 400, 实际 $hc"; fi
  echo ""

  echo -e "${YELLOW}[TC-$(printf '%02d' $((TOTAL + 1)))]${NC} Webhook — ping 事件"
  hc=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$WEBHOOK_URL" \
    -H "$CT" -H "x-hub-signature-256: sha256=0000000000000000000000000000000000000000000000000000000000000000" \
    -H "x-github-event: ping" -H "x-github-delivery: test-ping" \
    -d '{"zen":"test"}' 2>/dev/null || echo "000")
  TOTAL=$((TOTAL + 1))
  if [[ "$hc" == "200" ]]; then test_pass; else test_fail "预期 HTTP 200, 实际 $hc"; fi
  echo ""

  echo -e "${YELLOW}[TC-$(printf '%02d' $((TOTAL + 1)))]${NC} 限流检测（连续 10 次请求）"
  local hit_429=false
  for i in $(seq 1 10); do
    hc=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$WEBHOOK_URL" \
      -H "$CT" -H "$SIG" -H "x-github-event: pull_request" \
      -H "x-github-delivery: test-rate-$i" \
      -d '{"action":"opened"}' 2>/dev/null || true)
    if [[ "$hc" == "429" ]]; then
      hit_429=true
      break
    fi
  done
  TOTAL=$((TOTAL + 1))
  if $hit_429; then
    test_pass
  else
    test_fail "未触发限流"
  fi
  echo ""
fi

# ── E2E ──
if $RUN_ALL || $RUN_E2E; then
  if [[ -z "$REPO" || -z "$TOKEN" ]]; then
    echo -e "${RED}E2E 测试需要 --repo 和 --token 参数${NC}"
    echo ""
  else
    echo -e "${CYAN}━━━ L3: 真实仓库 E2E ━━━${NC}"
    echo ""
    BRANCH="smoke-test/ai-pr-$(date +%s)"
    PR_TITLE="[Smoke Test] AI PR 描述 — $(date +%H:%M)"
    TMPDIR=$(mktemp -d)

    echo -e "${YELLOW}[TC-E2E-01]${NC} 创建测试分支并推送变更"
    cd "$TMPDIR"
    if git clone "https://x-access-token:${TOKEN}@github.com/${REPO}.git" repo 2>/dev/null; then
      cd repo
      git checkout -b "$BRANCH"
      echo "# Smoke Test PR - $(date)" >> SMOKE_TEST.md
      git add SMOKE_TEST.md
      git commit -m "smoke test: add test file"
      git push origin "$BRANCH" 2>/dev/null || true
      PR_URL=$(gh pr create --repo "$REPO" --base main --head "$BRANCH" \
        --title "$PR_TITLE" \
        --body "Automated smoke test. Will be closed automatically." \
        --draft 2>/dev/null || true)
      TOTAL=$((TOTAL + 1))
      if [[ -n "$PR_URL" ]]; then
        test_pass
        PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$' || echo "")
        echo -e "${YELLOW}[TC-E2E-02]${NC} 验证 AI 评论生成（等待 30s）"
        FOUND=false
        for w in $(seq 1 30); do
          sleep 1
          if COMMENTS=$(gh pr view "$PR_NUM" --repo "$REPO" --comments --json body 2>/dev/null); then
            if echo "$COMMENTS" | grep -qiE '(AI|自动生成|PR 描述|变更摘要|description|summary)'; then
              FOUND=true
              break
            fi
          fi
        done
        TOTAL=$((TOTAL + 1))
        if $FOUND; then test_pass; else test_fail "未在 30s 内检测到 AI 评论"; fi

        echo -e "${YELLOW}[TC-E2E-03]${NC} 清理测试环境"
        gh pr close "$PR_NUM" --repo "$REPO" --comment "Smoke test done" 2>/dev/null || true
        git push origin --delete "$BRANCH" 2>/dev/null || true
        TOTAL=$((TOTAL + 1))
        test_pass
      else
        test_fail "创建 PR 失败"
      fi
    else
      test_fail "克隆仓库失败"
    fi
    cd /
    rm -rf "$TMPDIR"
    echo ""
  fi
fi

# ── 汇总 ──
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  总数: $TOTAL | ${GREEN}通过: $PASSED${NC} | ${RED}失败: $FAILED${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}✅ 冒烟测试全部通过${NC}"
  exit 0
elif [[ $FAILED -le 2 ]]; then
  echo -e "${YELLOW}⚠️  有条件通过（$FAILED 项失败，需人工确认）${NC}"
  exit 1
else
  echo -e "${RED}❌ 不通过！$FAILED 项失败，建议回滚${NC}"
  exit 2
fi
