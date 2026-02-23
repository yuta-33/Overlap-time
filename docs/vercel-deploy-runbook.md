# overlap-time Vercelデプロイ手順書

## 1. 目的
- `overlap-time` を `Vercel + Supabase` 構成で本番公開する。
- 最小運用（無料枠前提）で、再デプロイとロールバックを迷わず実施できる状態にする。

## 2. 前提
- GitリポジトリがVercel連携可能（GitHub/GitLab/Bitbucket）
- Supabaseプロジェクトが作成済み
- 以下SQLをSupabase SQL Editorで適用済み
  1. `/Users/sasayuta/Documents/Overlap-time/supabase/schema.sql`
  2. `/Users/sasayuta/Documents/Overlap-time/supabase/rls.sql`

## 3. Vercelプロジェクト作成
1. Vercel Dashboardで `Add New Project` を選択
2. `Overlap-time` リポジトリをImport
3. Framework Presetが `Next.js` であることを確認
4. Build設定はデフォルトのまま保存

## 4. 環境変数設定（Vercel）
Project Settings -> Environment Variables に以下を設定する。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

設定対象は最低でも以下2つ:
- `Production`
- `Preview`

## 5. 初回デプロイ
1. `main` ブランチへpush
2. Vercelが自動ビルド・デプロイ
3. 発行されたURLで以下を確認
   - `/` でイベント作成できる
   - `/events/{id}` で参加できる
   - 別ブラウザ/シークレットウィンドウで同じイベントを開き、塗り更新が自動反映される

## 6. 独自ドメイン（任意）
1. Project Settings -> Domains
2. 利用するドメインを追加
3. DNSレコードをVercel指示に合わせて設定
4. HTTPS有効化を確認

## 7. リリース運用
- 通常リリース: `main` へマージして自動デプロイ
- 緊急リリース: Vercelで対象デプロイを `Promote to Production`
- ロールバック: 直前の安定デプロイを `Promote to Production`

## 8. デプロイ後チェックリスト
- API疎通
  - `POST /api/events`
  - `POST /api/events/:id/participants`
  - `PUT /api/events/:id/participants/:pid/availability`
- Realtime反映
  - 2クライアントで同一イベントを開いて相互反映を確認
- セキュリティ
  - SupabaseのService Roleキーが公開URLやクライアントコードに露出していない

## 9. トラブルシュート
- 画面は開くがデータ保存されない
  - Vercelの環境変数設定漏れを確認
  - Supabase SQL（特にRLS）が適用済みか確認
- Realtimeが反映されない
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` 設定を確認
  - `supabase/rls.sql` 内の publication 追加が適用されているか確認
- 403が多発する
  - `edit_token` の不一致が原因。再参加して新しいトークンを発行
