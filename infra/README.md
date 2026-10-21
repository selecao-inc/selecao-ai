# infra

Vercel プロジェクト `selecao-ai` とドメイン（`selecao.ai` / `www.selecao.ai`）を Terraform で管理する。
state と実行は HCP Terraform（Organization `selecao-inc` / Workspace `selecao-ai`）。

## 管理しているもの

| リソース | 内容 |
|---|---|
| `vercel_project.site` | `selecao-ai`・Next.js・Git 連携 `selecao-inc/selecao-ai`・本番ブランチ `main` |
| `vercel_project_domain.apex` | `selecao.ai` |
| `vercel_project_domain.www` | `www.selecao.ai` → `selecao.ai` へ転送 |
| `vercel_project_environment_variable.secret` | `secrets.enc.yaml` の key/value を本番・プレビューへ投入（M1 は 0 件） |

DNS はお名前.com で手作業管理（[docs/RUNBOOK.md](../docs/RUNBOOK.md)）。

## 反映の流れ

1. `infra/` を変更して PR を出す
2. HCP Terraform が PR に plan を出す（PR のチェック）。**plan が唯一のレビュー機会**なので、作成・変更・削除の内容を必ず確認する
3. main にマージすると HCP Terraform が自動で apply する（Auto-apply ON）

手元で `terraform apply` / `terraform plan` はしない。

## 初回セットアップ（済み・Issue #2）

- HCP Terraform Workspace `selecao-ai`：VCS 連携 `selecao-inc/selecao-ai`、Working Directory `infra`、Auto-apply ON、Terraform 1.16.6、Execution mode Remote
- Workspace の環境変数（すべて Sensitive）：
  - `VERCEL_API_TOKEN` — Vercel チーム `yusukeohno16s-projects` のトークン
  - `GITHUB_TOKEN` — GitHub 設定用（#6 で使用）
  - `SOPS_AGE_KEY` — age 秘密鍵（`secrets.enc.yaml` の復号用）
- Vercel の GitHub App を `selecao-inc` に導入

Terraform の版を上げるときは、`versions.tf` の `required_version` と Workspace 設定を同時に変える。

## 手元での確認

```bash
cd infra
terraform fmt -check
terraform init -backend=false
terraform validate
```

## 秘密情報の追加手順

秘密情報は `secrets.enc.yaml`（SOPS / age 暗号化）にだけ置く。平文をコミット・PR 本文・ログに出さない。

前提：age 秘密鍵が `~/.config/sops/age/keys.txt` にあること。macOS の sops は既定でこの場所を見ないため、環境変数で指定する。

```bash
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
```

1. 編集する（エディタ上でだけ平文になり、保存時に再暗号化される）

   ```bash
   cd infra
   sops secrets.enc.yaml
   ```

   形式はフラットな key/value。key がそのまま Vercel の環境変数名になる。

   ```yaml
   EXAMPLE_API_KEY: "..."
   ```

2. 暗号化されていることを確認する（値が `ENC[...]` になっている）

   ```bash
   git diff infra/secrets.enc.yaml
   ```

3. PR を出し、plan に `vercel_project_environment_variable.secret["<key>"]` が追加されることを確認する（値は plan に表示されない）

復号の確認：

```bash
sops -d infra/secrets.enc.yaml
```

注意：復号した値は HCP Terraform の state に保存される（plan の表示では隠れるが state には残る）。Workspace の state を閲覧できるメンバーを最小限に保つ。

暗号化の宛先（age 公開鍵）は `.sops.yaml` で管理する。鍵を差し替えたら `sops updatekeys secrets.enc.yaml` で再暗号化し、HCP の `SOPS_AGE_KEY` も更新する。
