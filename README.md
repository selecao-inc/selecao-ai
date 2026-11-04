# selecao-ai

株式会社セレソンのコーポレートサイト（https://selecao.ai）。

## 開発

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Node.js は `package.json` の `engines.node`、pnpm は `packageManager` の版を使う（Corepack で自動選択）。

## 検証

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## ドキュメント

- [AGENTS.md](AGENTS.md) — AI エージェント向けの作業ルール
- [ARCHITECTURE](docs/ARCHITECTURE.md) — 構成図・サービスの役割・技術選定
- [RUNBOOK](docs/RUNBOOK.md) — 環境変数・ドメイン・DNS・ブランチ保護・復旧・依存更新
- [DECISIONS](docs/DECISIONS.md) — ADR 形式の決定記録・Notion CMS の方針
- [infra/README.md](infra/README.md) — インフラ定義・初回セットアップ・鍵の前提
- 設計書・マイルストーン・Issue — GitHub Issues / Notion
