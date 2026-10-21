# RUNBOOK

運用手順。インフラ構成は [infra/README.md](../infra/README.md)。

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
