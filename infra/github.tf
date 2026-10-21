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
}

resource "github_branch_protection" "main" {
  repository_id = github_repository.site.node_id
  pattern       = "main"

  enforce_admins      = true
  allows_force_pushes = false
  allows_deletions    = false

  required_status_checks {
    strict = true
    # HCP Terraform の plan は infra/ を触らない PR で走らないため必須にしない
    contexts = ["ci"]
  }

  required_pull_request_reviews {
    required_approving_review_count = 0
  }
}
