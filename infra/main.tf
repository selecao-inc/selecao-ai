# 認証は HCP Terraform の環境変数 VERCEL_API_TOKEN（Sensitive）から読む
provider "vercel" {
  team = "team_pQPtn4pi8bxpydBVfK4a9xbS" # yusukeohno16s-projects
}

resource "vercel_project" "site" {
  name      = "selecao-ai"
  framework = "nextjs"

  git_repository = {
    type              = "github"
    repo              = "selecao-inc/selecao-ai"
    production_branch = "main"
  }
}

resource "vercel_project_domain" "apex" {
  project_id = vercel_project.site.id
  domain     = "selecao.ai"
}

resource "vercel_project_domain" "www" {
  project_id = vercel_project.site.id
  domain     = "www.selecao.ai"
  redirect   = vercel_project_domain.apex.domain
  # 恒久的な正規化なので 308 を明示する（未指定だと API 既定に依存する）
  redirect_status_code = 308
}

# 秘密情報は secrets.enc.yaml（SOPS/age）にだけ置き、復号した key/value を Vercel の環境変数へ投入する。
# 復号鍵は HCP Terraform の環境変数 SOPS_AGE_KEY（Sensitive）。M1 では中身が空なので作成数は 0。
data "sops_file" "secrets" {
  source_file = "${path.module}/secrets.enc.yaml"
}

resource "vercel_project_environment_variable" "secret" {
  # 値は sensitive のまま、キー名だけを for_each に使う（キー名は秘密ではない前提）
  for_each = nonsensitive(toset(keys(data.sops_file.secrets.data)))

  project_id = vercel_project.site.id
  key        = each.key
  value      = data.sops_file.secrets.data[each.key]
  target     = ["production", "preview"]
  sensitive  = true
}
