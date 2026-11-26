# RUNBOOK

運用手順。全体構成は [ARCHITECTURE](ARCHITECTURE.md)、決定事項は [DECISIONS](DECISIONS.md)、インフラ定義・セットアップは [infra/README.md](../infra/README.md)。

既存の DNS・ブランチ保護の記録は確認日の時点のもの。環境変数の追加・削除、ドメイン変更、Rollback の手順は文書化のみ。HCP 操作とブランチ保護の確認結果は、各節の確認日・実施者・run を参照する。実施時は人間の承認を得て、対象 commit・plan・反映結果を PR に記録する。

## GitHub ブランチ保護

`infra/github.tf` で既存の `selecao-inc/selecao-ai` を import し、main を保護する。PR 必須・必須チェック `ci` と `pr-guard`（Issue #46。規則は [verification.md](factory/verification.md#pr-の識別と変更範囲の判定issue-46)）・通常の承認人数 0 人・聖域の CODEOWNERS 承認必須・管理者にも適用・force push / 削除禁止。マージ方法は Squash のみで、マージ後に作業ブランチを自動削除する。

`infra/` を変更していない [PR #20](https://github.com/selecao-inc/selecao-ai/pull/20)・[PR #21](https://github.com/selecao-inc/selecao-ai/pull/21) でも、`Terraform Cloud/selecao-inc/...` チェックが実行され、成功した（2026-10-21）。HCP の VCS トリガー設定は未確認で、全 PR での実行条件は確認できていないため、HCP Terraform のチェックは必須にしない。`infra/` の変更時は HCP の plan をレビューする。

### 聖域の承認（Issue #45）

`.github/CODEOWNERS` は `/tests/scenarios/`・`/docs/factory/`・`/.github/`・`/infra/`・`/AGENTS.md` の所有者を `@YusukeOhno16` にする。CODEOWNERS 自体も `/.github/` に含まれる。Terraform は `require_code_owner_reviews = true` とし、`required_approving_review_count = 0`・`enforce_admins = true` を維持する。聖域以外の PR に一般の承認人数は要求しない。当面、マージ操作は全 PR で人が行う。

2026-11-16、PR #53 が main に入り、HCP 反映・受け入れ確認 1〜4 を完了した。main の対象 SHA は `9590faae80f2b16267085a7662da826731dc77cd`。大野の HCP セッションで Claude が run `run-d9qDqMEyRzNDvK9f` の **Applied** を確認した（大野から共有された確認結果）。同じ確認で API から取得した main の保護は `require_code_owner_reviews=true`・`required_approving_review_count=0`・`enforce_admins=true`・`contexts=[ci]`。ローカル apply は実行していない。

以下の日時は UTC。GitHub の状態は Codex が `gh pr view --json mergeStateStatus,reviewDecision,reviews,statusCheckRollup` で取得した。HCP の plan 内容と承認前の GitHub 画面は、大野のセッションで Claude が確認し、大野が結果を共有した。HCP 確認日は 2026-11-16（確認時刻は未記録）。テスト PR は両方とも bot `selecao-agents` が作成し、結果コメント後にマージせずクローズ、テスト用のローカル・リモートブランチも削除した。

| 受け入れ確認 | 実施結果（pass） |
|---|---|
| 1. 聖域 PR が承認前は `BLOCKED` | PR #54、SHA `be112efcc97ec58716f93f28cc887509e03c32f3`。2026-11-16 12:30:53Z、`ci=SUCCESS`・レビュー0件・`mergeStateStatus=BLOCKED`。画面では「Merging is blocked — Waiting on code owner review from YusukeOhno16」「Code owner review required by reviewers with write access」を確認し、`requested_reviewers=YusukeOhno16` として code owner に自動依頼されていた。HCP: `run-CUY4ob5PHo7bmFzX`（確認4参照） |
| 2. 大野の承認後はマージ可能 | PR #54、同じ SHA。`YusukeOhno16=APPROVED`（2026-11-16 12:38:22Z）、12:40:01Z の再取得で `mergeStateStatus=CLEAN`・`ci=SUCCESS`。マージ操作は実施せずクローズ |
| 3. 聖域以外は承認なしでマージ可能 | PR #55、SHA `db44bb40cef623ec0c8b9cc99527d39ac5638777`。2026-11-16 12:30:54Z、`ci=SUCCESS`・レビュー0件・`mergeStateStatus=CLEAN`。12:40:02Z にも同じ状態を再確認。マージせずクローズ。HCP: `run-tT6WYd8RuBXGh6Si`（確認4参照） |
| 4. HCP の plan が差分ゼロ | 2026-11-16、Claude が大野の HCP セッションで PR #54（`be112ef`）の `run-CUY4ob5PHo7bmFzX` と PR #55（`db44bb4`）の `run-tT6WYd8RuBXGh6Si` を確認。両方 **No changes（0 added / 0 updated / 0 removed）**。GitHub commit statuses も両 SHA で `state=success`・`description=Success`（それぞれ 12:30:30Z / 12:30:49Z） |

承認人数 0 の設定では `reviewDecision` は承認前後とも空文字（`REVIEW_REQUIRED` にはならない）だった。これだけで承認不要とは判定しない。聖域 PR の画面上の code owner 承認要求、レビュー自動依頼、および `ci` 成功後の承認前 `BLOCKED` → 大野の承認後 `CLEAN` により、CODEOWNERS 承認の強制を確認した。

テスト PR と結果コメント:

https://github.com/selecao-inc/selecao-ai/pull/54#issuecomment-6916679654

https://github.com/selecao-inc/selecao-ai/pull/55#issuecomment-6916680112

承認人数 0 のままで CODEOWNERS 承認が強制されないと判明したら停止して大野へ返す。全 PR の承認必須化へ無断で切り替えない。

### pr-guard の受け入れ確認（Issue #60）

2026-11-26（JST）、Codex が bot `selecao-agents`（push=true・admin=false）で Issue #60 の確認1〜6を実施し、すべて期待どおりとなった。大野の指示で #58 完了前に先行実施した。2026-12-02 より前の確認であり、Actions policy 設定後の再確認と制限適用後の起動確認は #58 に残す。今回の成功を policy 設定済みの証拠にはしない。

以下の取得日時は UTC。`gh pr view --json`、`gh pr checks --required`、`gh api` の Actions run / jobs / check-runs、`gh run view --log` を取得した。必須欄の `ci`・`pr-guard` と `statusCheckRollup` の job 名を照合し、CODEOWNERS 未承認による停止とは分けて判定した。main 保護の REST API は bot では HTTP 404 だったため、strict・HCP apply・plan 差分ゼロを今回独立確認したとは扱わない（#60 の背景には大野の反映確認済みの記録がある）。

テストIssue #61・#62・#63 はすべてラベルなし（実装 PR）。既存の本物の Issue を `Closes` で指定していない。ブランチと対応は次のとおり。SHA の記号は下の結果表にも使用する。

| PR / テストIssue | ブランチ | PR head SHA |
|---|---|---|
| #64 / #61 | `YusukeOhno16/issue-61-guard-body-test` | A = `11f429cd618e533c37752d3b6d1910ca23346264` |
| #65 / #62 | `YusukeOhno16/issue-62-guard-scenario-test` | B = `d83bd9199557486c5ee29cb43203ce9323f6649b` |
| #66 / #63 | `YusukeOhno16/issue-63-guard-tamper-test` | C = `b03743981503ed342d401675b25f63d960f31a97` |
| #64 / #61（push 後） | `YusukeOhno16/issue-61-guard-body-test` | D = `9244170271887f5ec0e7422e4aa1d0fcc7f30501` |

全7回とも **job 名 `pr-guard`・event `pull_request_target`**。checkout ログの `ref` は **`3f2d229a4b5074968ae0842ea5760d5ff45c86d9`（main / PR #57）**、`HEAD is now at 3f2d229` も確認した。ログの対象 head と check run の `head_sha` は、それぞれ表の PR head と一致した。権限ログは Contents / Issues / PullRequests が read、Metadata が read。

| 確認（pass） | PR | 取得時刻 UTC | PR head / check head_sha | Actions run / check run ID | pr-guard の結果 | ci / mergeStateStatus |
|---|---|---|---|---|---|---|
| 1. Closes なし | #64 | 13:17:53 | A / A | `45827579946` / `139935595237` | failure（規則1で失敗） | pass / BLOCKED |
| 2. 実装 PR のシナリオ変更 | #65 | 13:17:59 | B / B | `45827590649` / `139935633046` | failure（規則4で失敗） | pass / BLOCKED |
| 3. 判定器・workflow の常時成功化 | #66 | 13:18:06 | C / C | `45827652658` / `139935851491` | failure（両パスを規則4で拒否） | pass / BLOCKED |
| 4. 正常な本文に修正 | #64 | 13:18:52 | A / A | `45827866558` / `139936590549` | success（成功、待機なし） | pass / CLEAN |
| 5a. 同じ head で Closes 削除 | #64 | 13:19:24 | A / A | `45827953259` / `139936900825` | failure（規則1で失敗） | pass / BLOCKED |
| 5b. 同じ head で復元 | #64 | 13:20:12 | A / A | `45828042430` / `139937213356` | success（成功、待機なし） | pass / CLEAN |
| 6. push で新 head | #64 | 13:22:02 | D / D | `45828162386` / `139937626118` | success（新 head の判定が成功） | pass / CLEAN |

確認1〜3はすべて `ci=pass` でも、`gh pr checks --required` が `pr-guard=fail`（exit 1）を返し、PR が BLOCKED だった。確認2は `tests/scenarios/issue-62/acceptance.md`、確認3は `.github/scripts/pr-guard.mts` と `.github/workflows/pr-guard.yml` をエラー内に列挙した。確認3の PR 側は CLI の `process.exitCode=0` と workflow の `run: "true"` に変えてあるが、main の判定器が実行された。

確認4・5は PR #64 の head A を固定し、本文だけを変更した。成功時はレビュー0件で CLEAN、削除後は必須欄の新しい pr-guard が pending → fail、BLOCKED、復元後は pass・CLEAN。`statusCheckRollup` には過去の成功・失敗も残るため、最新 run の check run と必須欄を照合し、古い成功で通過していないことを確認した。

確認6は head A → D の push 後、新 head D の `statusCheckRollup` に新規 run `45828162386` の pr-guard が IN_PROGRESS（必須欄 pending・exit 8）、ci が QUEUED、PR が BLOCKED になった。旧 head A の成功は新 head の成功として使われなかった。新 check run `139937626118` の `head_sha=D` とログの対象 head D、main checkout、成功を確認し、ci 完了後の CLEAN まで再取得した。

Actions の証拠（上表の順。各 URL は run と job / check run を特定する）:

https://github.com/selecao-inc/selecao-ai/actions/runs/45827579946/job/139935595237

https://github.com/selecao-inc/selecao-ai/actions/runs/45827590649/job/139935633046

https://github.com/selecao-inc/selecao-ai/actions/runs/45827652658/job/139935851491

https://github.com/selecao-inc/selecao-ai/actions/runs/45827866558/job/139936590549

https://github.com/selecao-inc/selecao-ai/actions/runs/45827953259/job/139936900825

https://github.com/selecao-inc/selecao-ai/actions/runs/45828042430/job/139937213356

https://github.com/selecao-inc/selecao-ai/actions/runs/45828162386/job/139937626118

テスト PR #64・#65・#66 はマージせずクローズし、`state=CLOSED`・`mergedAt=null` を再取得した。テスト用リモート・ローカルブランチと子 worktree を削除し、Issue #61・#62・#63 を閉じたことも再確認した。本記録の PR は `Closes #60` とし、聖域 `docs/factory/` を含むため大野の承認を必要とする。マージは行わない。

範囲外・未確認: fork PR、導入前から開いていた PR の Update branch、HCP plan 内容の再確認。policy 設定後と 12/02 以降の起動確認は #58 で行う。

### AI 用 GitHub アカウントの運用

AI の push・PR 作成は machine account `selecao-agents` で行い、大野（`YusukeOhno16`）がレビュー・承認する。大野自身が聖域を変更する場合も bot から PR を出す（GitHub では自分の PR を自分で承認できないため）。

Issue #44 のセットアップとコメントにある確定手順は次のとおり。端末固有の設定の詳細は `~/.agents/guides/agent-github-account.md` を参照する。

1. 大野が `agents@selecao.ai`（Google グループ、メンバーは大野のみ）で bot を作成し、2段階認証・回復手段を設定する。
2. bot を対象リポジトリの外部コラボレーター（Write）として招待し、bot が承認する。org メンバー・admin にはしない。
3. 大野が期限付き classic PAT（`repo`・`workflow` のみ）を発行する。外部コラボレーターでは fine-grained PAT の Resource owner に org を選べなかったため、この方式を採用した。
4. PAT を macOS キーチェーンのアカウント `selecao-agents`・サービス `gh-token-selecao-agents` に保存する。値を会話・リポ・ログ・履歴へ残さず、保存後にクリップボードを空にする。
5. `~/.zshenv` が、`~/orca/workspaces/selecao-ai/` 配下で起動した zsh にだけキーチェーンから `GH_TOKEN` を設定する。起動後の `cd` では切り替わらない。push はローカル git 設定の HTTPS pushurl と `gh auth git-credential` で同じトークンを使う（fetch は SSH）。
6. 作業開始時、新しいシェルで `gh api user --jq .login` が `selecao-agents` と確認できなければ停止する。`gh api repos/selecao-inc/selecao-ai --jq .permissions` で `push: true`・`admin: false` も確認する。PR 作成後は `gh pr view <番号> --json author,headRefOid` で bot の名義と対象 SHA を記録する。

トークンの期限は #44 の記録で 2027-11-15 15:00 UTC。更新作業は #52（2027年10月対応）で管理する。大野が bot の設定から同じ最小スコープの新しい期限付き PAT を発行し、上記と同じキーチェーン項目を更新する。新しいシェルで bot の名義・権限・push の認証を確認した後、旧 PAT を失効させ、新期限と検証結果を #52 に値なしで記録する。具体的な保存操作は端末の手順書に従い、PAT 自体を貼り付けない。

同じ Mac の同じユーザーには大野の gh ログインと SSH 鍵が残る。この分離は既定の名義を分けるもので、権限を完全に隔離しない。隔離の強化は #51 のホールドアウト段階2・3で判断する。承認不能で締め出された場合は、下記の既存 break-glass を人間の管理者が行う。

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

CI 障害または CODEOWNERS の承認不能で全員がマージできない場合に限り、人間の管理者が次の手順で復旧する。

1. 修正 PR を用意し、障害の原因・一時的に外す保護・復元担当者を PR に記録する
2. GitHub の Settings → Branches で main の保護を編集し、管理者への適用（`enforce_admins`）・障害中の必須チェック・承認不能な CODEOWNERS 承認要件のうち、復旧に必要なものだけを一時的に外す。保護ルール全体は削除しない
3. 人間の管理者が修正 PR を Squash でマージする
4. 直後に HCP Terraform で **Plan only** を実行し、一時変更を Terraform の定義へ戻す差分と、意図しない差分がないことを確認する。VCS トリガー設定は未確認のため、自動 run の有無に依存せず手動で確認する。手動 run は最新 commit を取得しないので、対象の構成が復旧させる main の Terraform 定義であることも確認する
5. plan を確認・承認した人間が HCP で **Plan and apply (standard)** を実行して保護を戻す。Auto-apply ON のため、この run は plan 成功後に自動反映される。事前確認には必ず Plan only を使う
6. GitHub 上で管理者への適用・必須チェック `ci`・CODEOWNERS 承認要件が Terraform の定義どおりに復元され、HCP の Plan only が差分ゼロになることを確認して PR に記録する

`pr-guard` を必須にした反映（HCP apply）の時点で開いている PR は、`pr-guard` の結果が無いため、判定が走るまでマージできない。push・ブランチの更新（Update branch）・本文の編集・閉じて開き直す、のいずれかで main 側の `pr-guard` が走る。`pr-guard` は `pull_request_target` で main 側の定義だけを実行するため、`pr-guard.yml` を追加・変更する PR 自体には、その PR の版の判定は走らない。`.github/workflows/ci.yml`・`pr-guard.yml` の job 名（必須チェック名）を変えるときは、`infra/github.tf` の `required_status_checks.contexts` も同じ PR で変更する。移行 PR 自体は旧チェック名が必須なので、保護の更新が反映されるまでは旧チェックも成功させる。

HCP Terraform のアカウント（大野）は 2026-11-16 に HCP の GitHub ログイン（`YusukeOhno16`）に紐付け済み（大野確認）。今後は GitHub でサインインする。メールとパスワードでのサインインは 2027-01-31 に終了するが、紐付け済みのため影響しない。Issue #19 のトークン更新でサインインするときもこの方法を使う。

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
