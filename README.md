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

- `AGENTS.md` — AI エージェント向けの作業ルール
- `docs/` — 構成・運用手順・決定記録（順次追加）
- 設計書・マイルストーン・Issue — GitHub Issues / Notion
