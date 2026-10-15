# AGENTS.md — AI エージェント向けの作業ルール

株式会社セレソンのコーポレートサイト（https://selecao.ai）のリポジトリ。
AI エージェントはこのファイルのルールに従って作業する。ツール固有の指示ファイル（CLAUDE.md 等）は置かない。

## 最初に読むもの

1. このファイル
2. `docs/`（ARCHITECTURE / RUNBOOK / DECISIONS。作成済みのもののみ）
3. 担当する GitHub Issue（`gh issue view <番号> --repo selecao-inc/selecao-ai`）

## ルール

1. **1 PR = 1 Issue = 1 目的**。Issue に書かれた範囲だけを変更する。無関係なリファクタ・整形・改善を混ぜない
2. **main に直接 push しない**。作業ブランチ（`feat/` `fix/` `infra/` `docs/` `chore/`）から PR を出す。マージは人間が行う
3. **過剰実装しない**。将来用のコード・不要な抽象化・ラッパーを作らない。必要になった時点で足す
4. **依存は固定版**で追加する（`pnpm add -E`。`^` `~` を付けない）。更新は Dependabot の PR で行う
5. **版の指定元は1か所**：Node = `package.json` の `engines.node`、pnpm = `packageManager`。`.nvmrc` 等を別に作らない
6. **`infra/` の変更は PR 経由のみ**。手元で `terraform apply` しない（HCP Terraform がマージ時に反映する）
7. **秘密情報を書かない**。鍵・トークンは `infra/secrets.enc.yaml`（SOPS 暗号化）以外のどこにも置かない。コード・ログ・ドキュメント・PR 本文にも含めない
8. **"Done" の前に検証コマンドを全部通す**。結果（pass/fail）を PR 本文に書く
9. **コードを変える PR では `docs/` も同じ PR で更新する**
10. AI が作ったコミットには `Co-Authored-By` を付ける

## 検証コマンド

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## PR の書き方

タイトル：`<種類>: <変更内容>`（例 `feat: 準備中ページを追加`）
本文：背景 / 概要 / テスト（コマンドと結果） / 完了条件（Issue のチェックリスト） / `Closes #<Issue番号>`

## リポジトリ構成

```
app/          サイト本体（Next.js App Router）
components/   再利用部品（M2〜）
content/      文章・実績（M2〜）
public/       静的ファイル
tests/        テスト（Vitest）
infra/        Terraform・SOPS（M1-4〜）
docs/         技術ドキュメント
.github/      CI・Dependabot（M1-3〜）
```

`src/` は作らない。

## 技術

Next.js（App Router・React・TypeScript）／ Tailwind CSS v4 ／ 静的生成 ／ pnpm ／ Vitest ／ Vercel ／ Terraform + HCP Terraform ／ SOPS（age）
