# 合格の証拠・シナリオ保護・危険度

[設計書の入口](README.md) ｜ [工程と役割](workflow.md) ｜ [実装状況と後続課題](implementation-status.md)

この文書は目標とする設計で、強制手段は未実装を含む。現状は [実装状況](implementation-status.md#現在の実装状況) を参照する。

## 合格判定に必要な証拠

検証役は Issue の合格条件・計画・対象差分を入力とし、実装役の自己申告だけでなく CI の記録または再実行の出力を確認する。証拠には次を残す。

- 対象の head commit SHA。
- 実行したコマンド、exit code、出力・ログへの参照。
- 実行したシナリオ・テストの対象と件数、期待する対象との対応。
- 合格条件ごとの判定と、人の確認が必要な項目の確認記録。

exit 0 や CI 通過だけで仕様を満たしたとは判定しない。合格シナリオとレビューの証拠も確認し、必要な検査が 0 件・対象外・未実行なら未確認とする。未確認が残る間は合格扱いでマージへ進めない。

head が変わったら変更後の版で証拠を取り直す。レビューの再実施範囲は工場長が差分と影響から判断し、理由を記録する。

## 3. 合格シナリオの守り方

合格条件の文章は Issue に書いて実装役にも見せ、実行するシナリオは `tests/scenarios/` に置く。隠すことではなく変更権限の分離で、次の無断変更を防ぐ。

- シナリオ本文。
- 実行対象・実行条件。実行設定やヘルパーでシナリオを除外する経路も含む。
- 比較処理と期待値の生成元。期待値を緩める経路も含む。

これだけで期待値の妥当性や不具合の検出力が保証されるわけではない。

### 追加・変更の手順と強制

1. シナリオの追加・変更は実装と別の Issue・worktree・PR にし、実装 Issue に依存先を記録する。
2. CODEOWNERS とブランチ保護を組み合わせて人の承認を必須にし、実装より先にマージする。CODEOWNERS を置くだけで強制済みとは扱わない。
3. 実装 PR が `tests/scenarios/` に触れたら CI を失敗させ、必須チェックでマージを止める（[次節](#pr-の識別と変更範囲の判定issue-46)）。
4. 実装中に修正が必要になった場合も、合格条件との整合を人に確認し、別 Issue・PR で変更する。

これにより「1 Issue = 1 PR」を維持する。実装前のシナリオで main の必須 `ci` を壊さず、実装 PR で必要なシナリオを必ず実行する方式と保護の整備を、工場に製品を流す前提とする。

3 の強制は、次節の必須チェック `pr-guard` で行う（Issue #46）。シナリオの実行は #47 で扱う。GitHub 上の作成主体（bot `selecao-agents`）と人の承認主体（大野）の分離は [RUNBOOK](../RUNBOOK.md#ai-用-github-アカウントの運用) を参照する。

### PR の識別と変更範囲の判定（Issue #46）

必須チェック `pr-guard`（[ワークフロー](../../.github/workflows/pr-guard.yml)・[判定スクリプト](../../.github/scripts/pr-guard.mts)・[単体テスト](../../tests/pr-guard.test.ts)）が、PR の作成・本文の編集・push・再オープンのたびに次を判定する。失敗したときは、反した規則の番号（`[規則1]` など）と理由をエラーとして出す。

1. PR 本文で閉じる Issue の指定がちょうど1つ。`Closes` に加え、GitHub が Issue を閉じる他のキーワード（`Fixes`・`Resolves` など）も数える。別リポジトリの Issue は指定できない
2. ブランチ名に `issue-<同じ番号>-` が含まれる（例: `YusukeOhno16/issue-41-content-loader`）
3. その番号の Issue を GitHub API で取得でき、PR ではなく、開いている
4. Issue のラベルで PR の種類を決め、変更してよい範囲を判定する（下表）。`scenario` と `factory` の両方が付いていたら失敗させる

Dependabot（作成者 `dependabot[bot]`）の PR は判定の対象外として成功にする。

#### ラベルの意味

| ラベル | 意味 | 付けた Issue の PR |
|---|---|---|
| `scenario` | 合格シナリオを追加・変更する Issue。本文に `シナリオ対象: #<実装 Issue の番号>` をちょうど1つ書く | シナリオ PR |
| `factory` | ソフトウェアファクトリーの仕組み（CI・保護・運用）を変える Issue | 工場の仕組みの PR |
| どちらも無い | 製品の実装 Issue | 実装 PR |

#### 判定に影響するファイルの対応表

| パス | 役割 | 実装 PR | シナリオ PR | 工場の仕組みの PR |
|---|---|---|---|---|
| `tests/scenarios/issue-<M>/` | 実装 Issue #M の合格シナリオ | 変更できない | `シナリオ対象: #M` の `issue-M/` だけ変更できる | 変更できない |
| `tests/scenarios/` のそのほか | シナリオ共通の部品・設定 | 変更できない | 変更できない | 変更できる |
| `.github/workflows/` | CI の定義（`pr-guard`・`ci` を含む） | 変更できない | 変更できない | 変更できる |
| `.github/scripts/` | CI から実行する判定スクリプト（`pr-guard.mts`） | 変更できない | 変更できない | 変更できる |
| `vitest.config.mts` | 通常テストとシナリオの分離 | 変更できない | 変更できない | 変更できる |
| 上記以外 | ― | `pr-guard` では制限しない | 同左 | 同左 |

#### 判定器を PR から書き換えられない仕組み

`pr-guard` は `pull_request_target` で起動し、main（PR の向き先）側のワークフローとスクリプトだけを実行する。PR のコード（head）は checkout も実行もせず、PR の本文・ブランチ名・変更ファイルは GitHub API から読む。権限は読み取り（contents・issues・pull-requests）だけで、secrets は使わない。そのため、実装 PR に判定器（`.github/scripts/`）やワークフロー（`.github/workflows/`）を「常に合格」へ書き換える変更を混ぜても、その PR は main 側の判定器で判定され、規則4で失敗する。判定器の変更が効くのは、factory の PR として大野の承認を得て main に入った後の PR からになる。

変更ファイルの一覧は GitHub API の上限（3,000 件）で打ち切られるため、PR 情報の変更ファイル数と取得した件数が合わなければ、未検査のファイルが残るとして失敗させる。

上記以外のパスでも、聖域（[4. 危険度と承認](#4-危険度と承認)）は CODEOWNERS の承認が必要。シナリオ実行の設定（#47 で追加するもの）を対応表に足す場合は、#47 で同じ表を更新する。

#### この判定の限界

ラベルは Write 権限があれば付け替えられ、Issue のラベルを変えても `pr-guard` は再実行されない（次の push か本文の編集で再判定する）。また main 側の判定器そのものの誤りは、factory の PR で直すまで残る。`pr-guard` を追加・変更する PR 自体は、main にまだその版が無いため新しい判定ではマージ前に検査できず、マージ後の受け入れ確認で確かめる。そのため `pr-guard` は1つ目の防御にとどまり、最終的な防御は聖域に対する CODEOWNERS の承認（Issue #45、[RUNBOOK](../RUNBOOK.md#聖域の承認issue-45)）とする。`tests/scenarios/`・`.github/` はどちらも聖域なので、ラベルを偽っても大野の承認なしにはマージできない。

## 合格シナリオの実行（Issue #47）

`scenarios` チェックは `pull_request`（本文編集を含む）と main push で動く。必須化の定義は `infra/github.tf`。定義の追加と実際の HCP 反映・受け入れ確認は別で、導入時の確認は RUNBOOK に従う。

| 対象 | 実行・合格条件 |
|---|---|
| 実装 PR | `Closes #N` の `issue-N/` をすべて成功させる |
| シナリオ PR | Issue 本文の `シナリオ対象: #M` の `issue-M/` の各テストが検査失敗すること。一部の失敗で常時成功を隠さない |
| PR / main | `completed` で閉じた Issue のシナリオは回帰としてすべて成功させる |
| 無関係の open Issue | 理由をログに出して対象外 |
| `not_planned` など completed 以外で閉じた Issue / API 取得不能 | 失敗。対象シナリオの整理が必要 |
| factory（対応 Issue のラベル）/ Dependabot の PR | チェック対象外として成功 |

大野決定（2026-11-27）: 必要な `issue-N/` の実行可能シナリオが0件なら失敗。ただし実装 PR の差分が `content/` と `docs/`（`docs/factory/` を除く）のみなら、その対象の0件を例外成功にする。既存シナリオと完了済み Issue の回帰は省略しない。判定は全変更パスとリネーム元から行い、空の差分・混在・ラベルや本文による申告では例外を認めない。

必要な対象の0件、skip / todo、未完了 report、起動・収集エラー、runtime error、timeout は合格にしない。シナリオ PR では expect による検査失敗だけを反転し、単なる exit 1 を合格にしない。完了済みの対象は常に回帰として成功が必要。シナリオをまだ導入していない main の回帰対象なしは、対象外0グループとして記録する。

`not_planned` の後片付けは例外として区別する。base にあった対象の実行可能シナリオを head からすべて削除し、PR の全差分がその `issue-M/` の削除だけであることを GitHub API で確認できるシナリオ PR は成功にする。変更・追加・リネーム・他パス混在・一部残存なら失敗する。これは軽の0件例外や新シナリオの検査と別の削除専用経路。

通常のシナリオ追加・変更は対象の実装 Issue が open の場合だけ許可する。`completed` の回帰を変更する PR は、変更前の base 版が通ることで承認しないよう拒否する。変更が必要なら、人が対象 Issue の状態と合格条件を再確認してから進める。未知の closed reason は自動で削除を許可せず失敗させ、人へ返す。

### 書き方と実行境界

ファイルの規約は次のとおり。シナリオ本文は別 Issue / PR で先に main に入れる。`issue-N/` 内の symlink は使えない。

```ts
// tests/scenarios/issue-N/page.scenario.spec.ts（Preview 型）
import { test, expect } from "../preview.mts";

test("トップの見出し", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
```

Preview 型はこの共通 fixture の `page` / `context` を使う。bypass header を直接組み立てたり、`request` / `page.request` に secret を渡さない。共通 fixture は各 HTTP redirect を一段で止め、同じ origin か毎回判定してから header を付ける。外部 origin では既存の bypass header も取り除く。service worker は無効。検証済み origin の `/` に先にアクセスし、HTTP 200 を確認できなければシナリオを起動しない。

```ts
// tests/scenarios/issue-N/loader.scenario.test.ts（Vitest 型）
import { test, expect } from "vitest";
import { loadContent } from "../../../lib/content"; // 実装 Issue の実際の API に合わせる

test("不正データを拒否", async () => {
  await expect(loadContent("invalid")).rejects.toThrow();
});
```

Vitest 型は Preview から観測できない検査に限定する。上は書式の雛形であり、存在する API の定義ではない。**まだ存在しないモジュールの静的 import は収集エラーになるので使わない。** 実装前は、テスト本文で `existsSync` を expect してから dynamic import するなど、存在しないことを実際の検査失敗として表す。起動・import エラーを成功へ読み替えない。

通常の `pnpm test` はシナリオを除外するので、実装前の失敗シナリオが main の `ci` を壊さない。実行には base の Vitest 本体・`tests/scenarios/*config.mts` / reporter を使い、個別対象のファイルだけを CLI 引数で選ぶ。head の依存 install は `--ignore-scripts` で行い、`vitest` import も base に固定する。`.github/` と `tests/scenarios/` の共通部分の変更は factory PR に限る。

`plan` は GitHub API の最新 PR / Issue と差分を取得し、Preview 型には対象 SHA・環境・Vercel bot の成功 deployment と status を照合した HTTPS の `*.vercel.app` origin を渡す。PR 本文の URL、別 SHA、任意ドメイン、URL 内の認証・パス・クエリは受け付けない。Preview が未作成なら最大10分待機し、取得不能なら失敗。main は同じ SHA の production deployment を使う。GitHub の deployments 投稿が無効なら成功へ代替せず失敗する。

`plan` と最終集約は base 側の runner を使う。導入前で base に runner が無い場合は workflow 内の最小の API 判定で factory / Dependabot だけを対象外にし、通常の実装 PR は拒否する。runner / workflow の改変は別の base 側 `pr-guard` の必須チェックでも拒否する。実装・回帰のシナリオ本文は base を使い、シナリオ PR の検査対象だけ head を使う。Vitest 実行 job は対象 head の依存・コードを扱うが secrets は渡さない。Preview 実行 job は base の依存・設定・reporter と、選択した `issue-N/` だけを使い、head の install を実行しない。

Vitest 型は実装コードと同じプロセスに入るため、悪意ある実装が環境変数や report を操作することまで防ぐ独立した検証境界ではない。base の実行器への固定で依存・install による単純なすり替えを抑えるが、Preview からの外部検査を基本とし、この限界とソースレビューを残す。

report はテスト ID・planned / 実行件数・status だけを出し、生の stdout / stderr、テスト名・エラーの expected / actual、HTTP レスポンス、trace / screenshot / video は保存・アップロードしない。SHA と実行エンジン・対象 Issue・exit code をログに残す。API エラー、job 失敗、report 欠落でも最終 job `scenarios` は失敗する。

将来別リポへ移す際は Preview シナリオ、共通 fixture / 設定 / reporter と実行入口を一緒に移し、対象 SHA と検証済み origin を入力として渡す。Preview 型はアプリのソースを import しない。Vitest 型は対象コードの checkout が別途必要となる。

### bypass の自動利用と残るリスク

2026-11-27、大野が Claude と確認した結果（共有情報）: `ssoProtection` enabled / `deploymentType=all_except_custom_domains`、passwordProtection / trustedIps 無効。Preview と本番の `*.vercel.app` は保護対象。

同日、大野は required reviewer のある Environment を使わず、自動実行することを決定した。PR を出せる主体は大野と `selecao-agents`、fork に Actions secret が渡らないという運用前提に基づく。secret を受け取る同一リポジトリのシナリオコードや workflow は外部へ鍵を送る能力を持つため、origin 制限・ログ抑制だけでは意図的な窃取を防げない。CODEOWNERS / pr-guard はマージを止めてもレビュー前の実行を止めない。実行時の信頼の境界は PR 作成権限であり、権限を広げる際は再検討する。

漏えい時の影響は **保護された Preview と本番 `*.vercel.app` の閲覧**。鍵の失効・再発行が必要になる。bypass はアプリ独自の認証を代替するものではなく、到達できる endpoint に副作用がある場合はその挙動も別途評価する。Vercel は最初の bypass を `VERCEL_AUTOMATION_BYPASS_SECRET` システム環境変数として deployment に公開するので、GitHub だけに存在する鍵とは扱わない。

鍵は大野が Vercel で発行し、`infra/secrets.enc.yaml` に一度保存する。Terraform は予約キーを通常の Vercel 環境変数一覧から除き、`github_actions_secret` にだけ渡す。`vercel_project_protection_bypass` は secret を含む ID が非 Sensitive なので使わない。鍵がない状態では secret resource は0件で、通常の検証・factory 対象外判定は可能。ただし実際の Preview 検査は未登録を失敗にする。登録・HCP 権限・更新手順は RUNBOOK を参照する。

## 4. 危険度と承認

変更ファイルの場所で機械的に判定する設計とする。

| 区分 | 対象 |
|---|---|
| 軽 | `content/`・`docs/`（聖域を除く） |
| 中 | `app/`・`components/`・テスト（`tests/scenarios/` を除く） |
| 重 | 依存（`package.json`・`pnpm-lock.yaml` など） |
| 聖域 | `infra/`・秘密情報・認証・AGENTS.md・CI・`tests/scenarios/`・`docs/factory/` |

複数区分に該当する変更は重い側で扱い、`docs/factory/` は `docs/` の一部でも聖域とする。パス判定の成功は秘密情報の保存許可ではなく、その扱いは AGENTS.md に従う。

当面は全区分で人がマージし、聖域は人のレビュー・承認を必須とする。この設計書と AGENTS.md の変更には人（大野）の承認が必要。実績を見て軽・中の自動マージへ移す方針だが、基準は未決で、重・聖域の自動マージは v0.1 では定めない。
