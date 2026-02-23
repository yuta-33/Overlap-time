# hosting fallback runbook

## 0. いま失敗している原因
- 現在のVercelプロジェクトには環境変数が未設定（`npx vercel env ls` で0件）。
- この状態だとサーバはインメモリfallbackで動き、イベント/参加者データが安定して保持されない。

## 1. 第一候補: Vercel（推奨）
### 1.1 必須環境変数
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 1.2 設定コマンド例
以下は値を手入力する方法。

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production

npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview
```

### 1.3 再デプロイ
```bash
npx vercel --prod --yes
```

## 2. 第二候補: Netlify
### 2.1 準備済みファイル
- `/Users/sasayuta/Documents/Overlap-time/netlify.toml`

### 2.2 手順
1. NetlifyでGitHubリポジトリをImport
2. Build command: `npm run build`
3. Publish directory: `.next`
4. 環境変数3つを設定
5. Deploy

## 3. 第三候補: Render
### 3.1 準備済みファイル
- `/Users/sasayuta/Documents/Overlap-time/render.yaml`

### 3.2 手順
1. Renderで`Blueprint`またはWeb Service作成
2. リポジトリ連携後、`render.yaml`を読み込む
3. 環境変数3つを設定
4. Deploy

## 4. 最終候補: CloudHost / さくらレンタルサーバ（自己ホスト）
### 4.1 準備済みファイル
- `/Users/sasayuta/Documents/Overlap-time/Dockerfile`
- `/Users/sasayuta/Documents/Overlap-time/.dockerignore`

### 4.2 Dockerでの起動例
```bash
docker build -t overlap-time:latest .
docker run -d --name overlap-time \
  -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  overlap-time:latest
```

### 4.3 非Docker（Node直接）
```bash
npm ci
npm run build
NEXT_PUBLIC_SUPABASE_URL=... \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run start
```

## 5. デプロイ後の動作検証
1. イベント作成
2. 共有URLを別ブラウザで開く
3. 2人以上で同じスロットを塗る
4. `overlay`で人数が2以上になることを確認
