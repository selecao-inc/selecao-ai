# DECISIONS

M1 の決定記録（ADR）。記録日：2026-10-28。元の決定日・設計書本文の代替案比較は未確認。採用済みはリポジトリの実装・ルールで確認できるもの、方針は未実装のものを示す。理由は現行構成との対応として記録する。

## ADR-001: Next.js App Router を採用

- 状態：採用済み
- 背景：コーポレートサイトの土台として、まず準備中ページを公開する（[Issue #1](https://github.com/selecao-inc/selecao-ai/issues/1)）。
- 決定：Next.js / React / TypeScript と App Router、Tailwind CSS v4 を使い、静的生成を基本方針とする。
- 理由：`app/` にページ・共通 layout・metadata をまとめ、Vercel の Next.js プロジェクトと接続する構成に揃える。
- 影響：`src/` は作らない。現在は準備中ページのみ。静的 export 設定はなく、将来の CMS 取得方式は別途決める。
- 根拠：`AGENTS.md`、`app/`、`next.config.ts`、`package.json`、`infra/main.tf`。

## ADR-002: pnpm と版指定の単一ソース

- 状態：採用済み
- 背景：ローカルと CI で使う版の食い違いを避ける。
- 決定：Node の指定は `package.json` の `engines.node`、pnpm は `packageManager` に集約。依存は固定版で追加し、更新は Dependabot の PR で扱う。
- 理由：CI も同じ指定と `pnpm install --frozen-lockfile` を読み、複数ファイルに版を重複させない。
- 影響：`.nvmrc` 等は追加しない。依存追加は `pnpm add -E`。更新時は lockfile と全検証結果を確認する。
- 根拠：`AGENTS.md`、`package.json`、`pnpm-lock.yaml`、`.github/workflows/ci.yml`、`.github/dependabot.yml`。

## ADR-003: Terraform + HCP Terraform で構成を管理

- 状態：採用済み
- 背景：Vercel と GitHub の設定をコードで管理する（[Issue #5](https://github.com/selecao-inc/selecao-ai/issues/5)、[Issue #6](https://github.com/selecao-inc/selecao-ai/issues/6)）。
- 決定：`infra/` に定義し、HCP の Organization `selecao-inc` / Workspace `selecao-ai` で state と実行を管理。DNS はお名前.com で手作業管理する。
- 理由：構成変更と plan を PR でレビューし、main マージと反映を結び付ける。
- 影響：手元で apply しない。Auto-apply ON の記録があり、マージ前の plan 確認が必要。HCP の全 PR でのトリガー条件は未確認のため、必須チェックは `ci` のみ。DNS・保護・復旧の詳細は [RUNBOOK](RUNBOOK.md) を参照。
- 根拠：`infra/*.tf`、`infra/README.md`、`docs/RUNBOOK.md`。

## ADR-004: SOPS（age）でサイト用秘密情報を管理

- 状態：採用済み（M1 はサイト用の値なし）
- 背景：秘密情報を平文でリポジトリに置かず、Vercel の環境変数投入を構成管理する。
- 決定：`infra/secrets.enc.yaml` を SOPS / age で暗号化し、HCP の Sensitive 変数 `SOPS_AGE_KEY` で復号。キーごとに Vercel の `production` / `preview` へ同じ値を設定する。
- 理由：暗号化済みファイルの変更を PR で扱い、手動の環境変数設定との乖離を避ける。
- 影響：キー名は秘密ではない前提。復号値は Terraform state に残る。環境別の値や `development` は現行定義にない。鍵管理・追加の前提は [infra/README](../infra/README.md#秘密情報の追加手順)、追加・削除の運用は [RUNBOOK](RUNBOOK.md#環境変数の追加削除sops) を参照。
- 根拠：`infra/main.tf`、`infra/.sops.yaml`、`infra/README.md`、[Issue #2](https://github.com/selecao-inc/selecao-ai/issues/2)。

## ADR-005: リポジトリの指示は AGENTS.md のみ

- 状態：採用済み
- 背景：ツール別の指示ファイルで、エージェント間の読み込み内容が分かれることを避ける。
- 決定：リポジトリの指示の正本はルートの `AGENTS.md`。ツール固有の指示ファイルは置かない。
- 理由：複数ツールが同じ作業ルールを参照できるようにする。
- 影響：CI は追跡ファイルを NUL 区切りで調べ、`CLAUDE.md` / `CLAUDE.local.md` / `CODEX.md` / `GEMINI.md` / `.cursorrules` を大文字小文字を区別せず検出して失敗させる。
- 根拠：`AGENTS.md`、`.github/workflows/ci.yml`、[PR #26](https://github.com/selecao-inc/selecao-ai/pull/26)。

## ADR-006: Notion CMS を本命とする

- 状態：方針（CMS 連携は未実装）
- 背景：README では設計書・マイルストーンの管理先に Notion を挙げている。Issue #7 と今回の依頼に Notion CMS を本命とする決定の記録が含まれる。
- 決定：今後の CMS の本命を Notion とする。M1 は GitHub docs を整備し、Notion 側からのリンク・M1 完了反映は別担当で行う。
- 理由：今回指定された方針を記録する。当初の選定理由・代替 CMS との比較は設計書本文を未確認のため断定しない。
- 影響：この決定だけで CMS 導入済みとは扱わない。対象データベース、公開項目、取得・キャッシュ・更新契機、認証情報の設計は実装前に要確認。
- 根拠：`README.md`、[Issue #7](https://github.com/selecao-inc/selecao-ai/issues/7)、Issue #7 の今回の作業範囲指定。現行 `package.json`・`app/` に CMS 連携はない。
