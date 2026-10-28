# RUNBOOK

運用手順。全体構成は [ARCHITECTURE](ARCHITECTURE.md)、決定事項は [DECISIONS](DECISIONS.md)、インフラ定義・セットアップは [infra/README.md](../infra/README.md)。

既存の DNS・ブランチ保護の記録は確認日の時点のもの。以下の運用手順は文書化のみで、環境変数の追加・削除、ドメイン変更、Rollback、HCP 操作の実地検証は今回行っていない。実施時は人間の承認を得て、対象 commit・plan・反映結果を PR に記録する。

## GitHub ブランチ保護

`infra/github.tf` で既存の `selecao-inc/selecao-ai` を import し、main を保護する。PR 必須・必須チェック `ci`・承認 0 人・管理者にも適用・force push / 削除禁止。マージ方法は Squash のみで、マージ後に作業ブランチを自動削除する。

`infra/` を変更していない [PR #20](https://github.com/selecao-inc/selecao-ai/pull/20)・[PR #21](https://github.com/selecao-inc/selecao-ai/pull/21) でも、`Terraform Cloud/selecao-inc/...` チェックが実行され、成功した（2026-10-21）。HCP の VCS トリガー設定は未確認で、全 PR での実行条件は確認できていないため、必須チェックは引き続き `ci` のみとする。`infra/` の変更時は HCP の plan をレビューする。

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
| HCP Terraform の plan | 差分ゼロ（Plan only、`run-pcGEpBM7hh9CLVEV`、Contents Read-only 化の後に実施。0 to add / 0 to change / 0 to destroy、認証エラーなし。[Issue #6](https://github.com/selecao-inc/selecao-ai/issues/6#issuecomment-6318463699)） |

### CI 障害時の break-glass

CI が壊れて全員がマージできない場合に限り、人間の管理者が次の手順で復旧する。

1. 修正 PR を用意し、障害の原因・一時的に外す保護・復元担当者を PR に記録する
2. GitHub の Settings → Branches で main の保護を編集し、管理者への適用（`enforce_admins`）または障害中の必須チェックだけを一時的に外す。保護ルール全体は削除しない
3. 人間の管理者が修正 PR を Squash でマージする
4. 直後に HCP Terraform で **Plan only** を実行し、一時変更を Terraform の定義へ戻す差分と、意図しない差分がないことを確認する。VCS トリガー設定は未確認のため、自動 run の有無に依存せず手動で確認する。手動 run は最新 commit を取得しないので、対象の構成が復旧させる main の Terraform 定義であることも確認する
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

## 環境変数の追加・削除（SOPS）

対象は `infra/main.tf` の `vercel_project_environment_variable.secret`。フラットな key/value を `production` と `preview` の両方に設定する。環境別の値・`development` の投入は未対応なので、必要なら別 Issue で設計する。HCP 自体の認証変数の更新とは区別する（[infra/README](../infra/README.md#初回セットアップ済みissue-2)）。

### 前提と編集

SOPS / age の準備・秘密鍵の配置・暗号化の宛先は [既存の追加手順](../infra/README.md#秘密情報の追加手順) を参照。以下は**リポジトリルートから**順に実行する。エディタのバックアップ・同期・ログに平文を残さない環境を使い、復号結果をターミナルへ表示しない。

```bash
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
cd infra
sops secrets.enc.yaml
cd ..
git diff --check
git diff -- infra/secrets.enc.yaml
```

- 追加：SOPS が開いたエディタ内に必要なキーと文字列値を追加し保存する。キー名は plan に出るため秘密を含めない。秘密値をブラウザへ公開する `NEXT_PUBLIC_` には入れない。
- 削除：アプリが参照していないことを確認し、対象キーの行を SOPS のエディタで削除する。利用中なら先に参照を取り除く PR を反映し、新しいデプロイを確認してから削除する。
- 保存後の差分で値が `ENC[...]` であることを確認する。平文の YAML を保存・追加しない。暗号化ファイル自体や SOPS メタデータを手作業で削除しない。
- 最後のキーを削除する場合も、既存 M1 と同じ「データが空で SOPS メタデータがあるファイル」を維持する。使用する SOPS で空データを保存できるかは未検証。保存できない場合は作業を止め、ダミーキーを入れず対応方法を確認する。

### レビューと反映

1. `AGENTS.md` の検証コマンドをすべて実行する。`infra/README.md` の fmt / init（backend 無効）/ validate も実施する。これらの成功だけでは復号・投入の成功とは扱わない。
2. PR で HCP の対象 commit の plan を確認する。追加なら対象キーの作成、削除なら対象キーの削除だけであることを確認し、秘密値をログ・本文に出さない。値は sensitive だが Terraform state に残るため閲覧権限を絞る。
3. 人間が plan を承認してマージする。HCP の apply 成功と Vercel 側の対象環境・キー名を確認する。管理対象を Vercel の画面で直接編集しない。
4. [Vercel の環境変数](https://vercel.com/docs/environment-variables)の変更は既存デプロイに反映されず、新しいデプロイから有効になる。HCP の apply と同じ main push のビルドの順序に依存せず、apply 完了後に main の対象 commit を Redeploy し、Preview も利用するなら新しいデプロイで確認する。
5. 画面・必要な機能を確認し、対象 SHA・HCP run・デプロイ・pass/fail を PR に記録する。古いデプロイは値を保持し得るため、環境変数削除をトークン失効の代わりにしない。失効が必要なら依存先を確認して人間が行う。

HCP の認証・復号に失敗したときはマージしない。鍵更新は infra/README の手順、既存トークンの更新予定は [Issue #19](https://github.com/selecao-inc/selecao-ai/issues/19) を参照する。

## ドメイン変更

DNS の設定値・メール用の保護対象は [DNS（お名前.com）](#dnsお名前com) に集約し、ここには切替順序だけを書く。

1. 新ドメインの管理権限と DNS 管理先、正規 URL、旧 URL の維持期間・転送要否を人間と決める。レジストラ移管や NS 変更はこの手順に含めない。
2. PR で `infra/main.tf` のドメイン定義を更新する。既存の apex / www を一度に置換すると旧ドメインの削除を伴い得るため、移行中は新旧を併存させる定義にする。www の 308 転送先も確認し、plan で意図しない削除を止める。
3. コード・文書の旧 URL を検索し、必要な参照を同じ PR で更新する。現行の `app/layout.tsx` に固定のドメイン設定はない。`infra/github.tf` の homepage は Vercel の URL なので、変更要否を別途判断する。
4. 人間が plan を承認してマージし、HCP の apply 成功後、Vercel Domains の案内どおりに新ドメインの DNS を人間が設定する。既存メール用レコードを保持する。
5. 新 apex / www の DNS・HTTPS・ページ・転送を DNS 節の確認方法で検証する。証明書と Domains の状態も確認して結果を記録する。
6. 新ドメインでの確認後、旧 URL の転送を維持するか、合意した期間後に旧ドメインと Web 用 DNS を外すかを別 PR で実施する。問題があれば併存中の旧ドメインを維持し、修正 PR と必要な DNS の復元で戻す。

## Rollback

### アプリの復旧

1. 障害の対象 commit・デプロイ、直前の正常な本番デプロイを特定する。環境変数や外部サービスの変更も含むか確認する。
2. 緊急の切戻しは人間が Vercel のプロジェクト `selecao-ai` → Deployments で正常な本番デプロイへの **Instant Rollback** を選ぶ。画面に表示される対象ドメインと利用可能な切戻し先を確認して実行する。契約プラン・権限・利用可能な履歴は今回未確認。
3. 本番の HTTPS・表示・www 転送を確認する。過去のビルドを使うため、最新の環境変数を取り込む操作ではなく、DNS・Terraform・外部サービスも戻らない。
4. main の原因変更を `git revert <原因のcommit>` した作業ブランチで修正 PR を作り、全検証後、人間がマージする。infra を含むコミットを機械的に revert せず、下記の plan レビューも行う。
5. Rollback 後は本番ドメインの自動割当が停止するため、修正版のデプロイを確認後、人間が **Undo Rollback** から修正版を選んで本番へ戻す。本番の再確認と自動割当の復旧を記録する。

操作仕様は [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback) を参照。Rollback できる履歴がない場合は、修正／revert PR からの新規デプロイで復旧する。

### インフラ・環境変数・DNS の復旧

- Terraform 管理対象は既知の正常な定義へ戻す PR を用意する。現在の state に対する HCP plan の作成・変更・削除を確認し、人間の承認後にマージする。state の巻戻しやローカル apply はしない。
- 環境変数は暗号化ファイルの修正 PR → HCP の反映確認 → 新規デプロイの順。失効済みのトークンを過去の値へ戻さない。
- DNS は変更前に記録した Web 用レコードへ人間が戻し、名前解決・HTTPS・転送を再確認する。メール用・NS は変更しない。
- CI 障害で修正 PR がマージできない場合だけ、既存の [break-glass](#ci-障害時の-break-glass) を使う。

## 依存更新の判断ルール

現行の `.github/dependabot.yml` は npm・GitHub Actions・`infra/` の Terraform を毎週月曜（Asia/Tokyo）に確認し、npm の minor / patch はグループ化する。以下は更新 PR のレビュー基準とし、自動マージは前提にしない。

| 種類 | 確認・判断 |
|---|---|
| npm minor / patch | リリースノートと互換性を確認し、固定版・lockfile の差分と全検証が通ることを確認。グループで原因不明の失敗があれば切り分ける |
| npm major | 破壊的変更と移行作業を確認。対応が必要なら別 Issue で範囲を決め、CI が通るだけで承認しない |
| Node / pnpm / 型定義 | `engines.node` / `packageManager` を正とし、CI と Vercel との互換性を確認。`@types/node` の major は実行環境の Node と揃える。ignore 設定の現状は `.github/dependabot.yml` で確認する |
| GitHub Actions | リリースノート・入力・権限・runner 要件を確認。必須 `ci` job の名前を変えるならブランチ保護節の移行手順に従う |
| Terraform / provider | `infra/versions.tf` と `.terraform.lock.hcl`、fmt / validate、対象 commit の HCP plan を確認。Terraform 本体の版は HCP Workspace 設定との同期も必要で、人間と調整する |
| セキュリティ修正 | 影響と緊急性を確認し、必要な更新を優先。セキュリティ・認証に関わる変更は人間レビューを通す |

各 PR で `pnpm install --frozen-lockfile` / lint / typecheck / test / build の pass/fail を記録し、main の最新状態で必須 `ci` が成功してから人間がマージする。依存・構成を変える PR では関連 docs も更新する。不明な互換性は「要確認」として残し、根拠なしに承認しない。
