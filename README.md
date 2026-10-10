# selecao-ai

株式会社セレソンのコーポレートサイト（https://selecao.ai）。

## 開発

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## 検証コマンド

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Node.js のバージョンは `package.json` の `engines.node`、pnpm のバージョンは `packageManager` を唯一の指定元とする。
