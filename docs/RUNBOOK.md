# RUNBOOK

運用手順。インフラ構成は [infra/README.md](../infra/README.md)。

## GitHub ブランチ保護

`infra/github.tf` で既存の `selecao-inc/selecao-ai` を import し、main を保護する。PR 必須・必須チェック `ci`・承認 0 人・管理者にも適用・force push / 削除禁止。マージ方法は Squash のみで、マージ後に作業ブランチを自動削除する。

HCP Terraform の plan チェックは `infra/` を変更しない PR で走らないため、必須チェックに追加しない。

### 初回導入の承認

1. PR 本文の plan が repository の import・設定更新と main の保護作成だけで、既存の Vercel / SOPS に意図しない変更がないことを確認する
2. plan 結果を確認した人間がマージを承認する。HCP は Auto-apply ON のため、マージが反映の契機になる
3. 承認前は apply・main への直接 push テスト・GitHub 設定の手動変更を実行しない

### 承認・apply 後に人間が行う受け入れ確認

- main への直接 push が拒否される
- `ci` が失敗している PR はマージできない
- `ci` が成功している PR を Squash でマージできる
- HCP Terraform の plan が差分ゼロになる

初回 PR の plan には導入差分があるため、これらは承認・apply 後まで未完了として扱う。受け入れ確認を終えた人間が Issue #6 を閉じる。

#### 受け入れ確認の結果（2026-10-21、PR #18 の apply 後）

| 確認項目 | 結果 |
|---|---|
| main への直接 push | 拒否された（`GH006: Protected branch update failed`、PR 必須・`ci` 必須） |
| `ci` が失敗している PR | マージできなかった（テスト用 PR #20 が `BLOCKED`、Squash マージは base branch policy で拒否。PR はマージせずクローズ） |
| `ci` が成功している PR | この記録を追加した PR を Squash でマージした |
| HCP Terraform の plan | 未確認（Contents を Read-only に下げた後の plan とあわせて確認する） |

### CI 障害時の break-glass

CI が壊れて全員がマージできない場合に限り、人間の管理者が次の手順で復旧する。

1. 修正 PR を用意し、障害の原因・一時的に外す保護・復元担当者を PR に記録する
2. GitHub の Settings → Branches で main の保護を編集し、管理者への適用（`enforce_admins`）または障害中の必須チェックだけを一時的に外す。保護ルール全体は削除しない
3. 人間の管理者が修正 PR を Squash でマージする
4. 直後に HCP Terraform で **Plan only** を実行し、一時変更を Terraform の定義へ戻す差分と、意図しない差分がないことを確認する。`infra/` を触らない修正では自動 run が走らないため、手動で実行する。手動 run は最新 commit を取得しないので、対象の構成が復旧させる main の Terraform 定義であることも確認する
5. plan を確認・承認した人間が HCP で **Plan and apply (standard)** を実行して保護を戻す。Auto-apply ON のため、この run は plan 成功後に自動反映される。事前確認には必ず Plan only を使う
6. GitHub 上で管理者への適用・必須チェック `ci` が復元され、HCP の Plan only が差分ゼロになることを確認して PR に記録する

`.github/workflows/ci.yml` の job 名（必須チェック名）を変えるときは、`infra/github.tf` の `required_status_checks.contexts` も同じ PR で変更する。移行 PR 自体は旧チェック名が必須なので、保護の更新が反映されるまでは旧チェックも成功させる。

HCP の run の種類・手動実行の仕様は [Run modes and options](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/run/modes-and-options) と [UI and VCS-driven run workflow](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/run/ui) を参照。

## DNS（お名前.com）

`selecao.ai` の DNS はお名前.com（ネームサーバー `01〜04.dnsv.jp`）で手作業管理する。Terraform では管理しない。

### 初回の本番デプロイ

Vercel プロジェクトは PR マージ後の apply で作られるため、そのマージ自体（main への push）では本番デプロイが走らない。apply 完了後に一度だけ、Vercel のプロジェクト `selecao-ai` → Deployments から main の最新を Redeploy する（または main に新しいコミットが入るのを待つ）。

### Vercel 公開のために追加するレコード

Issue #5 の PR をマージして Vercel にドメインが追加された後に、お名前.com の「DNS レコード設定」で次の 2 件を**追加**する。

| ホスト名 | TYPE | VALUE | TTL |
|---|---|---|---|
| （空欄＝`selecao.ai`） | A | `76.76.21.21` | 3600 |
| `www` | CNAME | `cname.vercel-dns.com` | 3600 |

- 値は Vercel の推奨値（2026-10-21 時点）。追加前に Vercel のプロジェクト `selecao-ai` → Settings → Domains の表示と一致することを確認し、違えば Vercel の表示を正とする
- Vercel が TXT（`_vercel`）による所有確認を求めた場合は、その表示どおりに TXT を追加する
- 既存の A / AAAA / CNAME が同じホスト名にある場合は追加前に確認する（2026-10-21 時点ではどちらも無し）

### 触ってはいけない既存レコード（メール・所有確認）

2026-10-21 時点で次が設定されている。Vercel 対応で**変更・削除しない**。

| ホスト名 | TYPE | 用途 |
|---|---|---|
| `selecao.ai` | MX（`1 smtp.google.com`） | Google Workspace のメール受信 |
| `selecao.ai` | TXT（`v=spf1 include:_spf.google.com ~all`） | SPF |
| `selecao.ai` | TXT（`google-site-verification=...`） | Google の所有確認 |
| `google._domainkey` | TXT（`v=DKIM1; ...`） | DKIM |
| `_dmarc` | TXT（`v=DMARC1; ...`） | DMARC |

ネームサーバー（NS）も変更しない。CAA レコードは無い（追加する場合は Vercel が使う Let's Encrypt を許可すること）。

### 確認

```bash
dig +short selecao.ai A          # 追加した値（Vercel の表示値）
dig +short www.selecao.ai CNAME  # 追加した値（Vercel の表示値）
dig +short selecao.ai MX         # 1 smtp.google.com.（変わっていないこと）
curl -sI https://www.selecao.ai | grep -i -E '^(HTTP|location)'   # 308 で https://selecao.ai/ へ転送
```

Vercel の Domains 画面で両ドメインが「Valid Configuration」になり、`https://selecao.ai` で準備中ページが表示されれば完了。
