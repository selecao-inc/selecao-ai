# 認証は HCP Terraform の環境変数 GITHUB_TOKEN（Sensitive）から読む
provider "github" {
  owner = "selecao-inc"
}

# 既存リポジトリを再作成せず、承認後の apply で HCP Terraform の state に取り込む
import {
  to = github_repository.site
  id = "selecao-ai"
}

resource "github_repository" "site" {
  name        = "selecao-ai"
  description = "株式会社セレソン コーポレートサイト"
  visibility  = "public"

  # import 時に既存のホームページ・機能を意図せず消さないよう明示する
  homepage_url = "https://selecao-ai.vercel.app"
  has_issues   = true
  has_projects = true
  has_wiki     = true

  delete_branch_on_merge = true
  allow_squash_merge     = true
  allow_merge_commit     = false
  allow_rebase_merge     = false

  # 誤削除を plan で止め、destroy を許可した場合も完全削除せずアーカイブする
  archive_on_destroy = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "github_branch_protection" "main" {
  repository_id = github_repository.site.node_id
  pattern       = "main"

  enforce_admins      = true
  allows_force_pushes = false
  allows_deletions    = false

  required_status_checks {
    strict = true
    # HCP Terraform のチェックは全 PR での実行条件が未確認のため必須にしない
    # pr-guard は PR と Issue の対応・変更範囲の判定（Issue #46、.github/workflows/pr-guard.yml）
    contexts = ["ci", "pr-guard", "scenarios"]
  }

  required_pull_request_reviews {
    required_approving_review_count = 0
    require_code_owner_reviews      = true
  }
}

# 鍵が未登録なら作成しない。復号値を output や Vercel の環境変数へ流さない。
resource "github_actions_secret" "scenario_bypass" {
  for_each = setintersection(nonsensitive(toset(keys(data.sops_file.secrets.data))), toset(["GITHUB_ACTIONS_VERCEL_AUTOMATION_BYPASS_SECRET"]))

  repository  = github_repository.site.name
  secret_name = "VERCEL_AUTOMATION_BYPASS_SECRET"
  value       = data.sops_file.secrets.data[each.key]

  lifecycle {
    precondition {
      condition     = length(trimspace(data.sops_file.secrets.data[each.key])) > 0
      error_message = "CI bypass の予約キーには空でない鍵を設定してください。"
    }
  }
}

# Dependabot の pull_request run は Actions secrets を使えないため、同じ予約キーを専用 store にも渡す。
resource "github_dependabot_secret" "scenario_bypass" {
  for_each = setintersection(nonsensitive(toset(keys(data.sops_file.secrets.data))), toset(["GITHUB_ACTIONS_VERCEL_AUTOMATION_BYPASS_SECRET"]))

  repository  = github_repository.site.name
  secret_name = "VERCEL_AUTOMATION_BYPASS_SECRET"
  value       = data.sops_file.secrets.data[each.key]

  lifecycle {
    precondition {
      condition     = length(trimspace(data.sops_file.secrets.data[each.key])) > 0
      error_message = "Dependabot bypass の予約キーには空でない鍵を設定してください。"
    }
  }
}
