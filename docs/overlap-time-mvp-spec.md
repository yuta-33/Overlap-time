# overlap-time MVP 1枚仕様書

## 0. ドキュメント情報
- 版: v0.1
- 作成日: 2026-02-19
- 対象: 無料リリース向けMVP

## 1. 目的とスコープ
- 目的: ログイン不要で複数人の空き時間を重ねて可視化し、候補時間を素早く見つける。
- スコープ: `2値入力（空き/不可）`、`JST固定`、`共有リンク参加`、`ヒートマップ集計`。
- 非スコープ: `△評価`、通知、コメント、カレンダー連携、アカウント機能。

## 2. 想定ユーザーフロー
1. 幹事がイベントを作成する。
2. システムが共有URLを発行する。
3. 参加者がURLを開き、表示名を入力する。
4. 参加者がグリッドを塗って空き時間を登録する。
5. 全体ヒートマップで重なりが多い時間帯を確認する。

## 3. 画面仕様
### 3.1 イベント作成画面 `/`
- 入力項目
  - イベント名（必須、1-100文字）
  - 開始日・終了日（必須、終了日は開始日以上）
  - 1日の表示開始時刻・終了時刻（必須、開始 < 終了）
  - スロット粒度（`15` または `30` 分）
- 操作
  - `作成` クリックでイベント作成APIを実行し、参加画面へ遷移。

### 3.2 参加・入力画面 `/events/{eventId}`
- 初期表示
  - イベント情報（名称、日付範囲、時間帯、JST表記）
  - 表示名入力モーダル（未参加時）
- 入力グリッド
  - 列: 時間スロット
  - 行: 日付
  - セル状態: `空き` or `不可`
- 集計表示
  - 各セルに「空き人数」を反映した濃淡表示（0人は最薄）

## 4. 操作仕様（塗り）
- 対応操作
  - PC: `pointerdown -> pointerenter -> pointerup`
  - スマホ: タップ開始後のスワイプで連続反映
- 塗りモード
  - 起点セルの状態を基準に、通過セルへ同じ状態を適用
- 最低限の操作要件
  - 画面拡大なしでも主要端末幅（360px以上）で操作可能
  - 入力結果は即時にローカル表示へ反映

## 5. データ仕様（MVP）
### 5.1 `events`
- `id` string (nanoid)
- `name` string
- `timezone` string（固定値 `Asia/Tokyo`）
- `start_date` date
- `end_date` date
- `day_start_time` time
- `day_end_time` time
- `slot_minutes` int（15 or 30）
- `created_at` timestamp

### 5.2 `participants`
- `id` string
- `event_id` string
- `display_name` string
- `edit_token_hash` string（再編集識別用）
- `created_at` timestamp

### 5.3 `availabilities`
- `event_id` string
- `participant_id` string
- `date` date
- `bitset` string（スロット単位、`1=空き` / `0=不可`）
- `updated_at` timestamp
- 主キー: (`event_id`, `participant_id`, `date`)

## 6. API仕様（最小）
### 6.1 `POST /api/events`
- 用途: イベント作成
- 入力: `name`, `start_date`, `end_date`, `day_start_time`, `day_end_time`, `slot_minutes`
- 出力: `event_id`, `event_url`

### 6.2 `GET /api/events/{id}`
- 用途: イベント表示に必要な設定と参加者情報の取得
- 出力: イベント設定、参加者一覧、現在の集計表示に必要なデータ

### 6.3 `POST /api/events/{id}/participants`
- 用途: 参加者作成
- 入力: `display_name`
- 出力: `participant_id`, `edit_token`

### 6.4 `PUT /api/events/{id}/participants/{pid}/availability`
- 用途: 参加者の空き情報更新
- 入力: `date`, `bitset`
- 出力: 更新後タイムスタンプ

### 6.5 `GET /api/events/{id}/overlay`
- 用途: 集計結果取得
- 出力: 日付ごとのスロット別空き人数配列

## 7. リアルタイム更新
- `availabilities` 更新を購読し、受信時にoverlayを再取得または再計算する。
- クライアントは Supabase Realtime (`postgres_changes`) で `availabilities` の `event_id` フィルタ購読を行う。
- 反映遅延目標: 通常1秒以内（無料構成での目標値）。

## 8. バリデーション・例外
- 入力エラー: 400（必須欠落、日付逆転、不正slot）
- 不存在イベント: 404
- 競合/更新失敗: 409 or 500
- 表示名はサニタイズして保存・表示する。

## 9. セキュリティ・運用（最低限）
- イベントIDは推測困難なランダム文字列を使用
- `edit_token` で本人編集を識別（平文保存しない）
- IP単位の軽いレート制限を導入
- HTTPS前提
- Supabase RLSを有効化し、匿名アクセスは`x-event-id`ヘッダーでイベント単位に制限する
- 可用性更新は`x-edit-token`照合（SHA-256ハッシュ一致）を条件に許可する

## 10. 受け入れ基準
- 共有URLだけで第三者が参加し、入力と更新ができる。
- 2名以上で同一スロットを `空き` にすると濃度が上がる。
- 同一参加者の更新が再読み込み後も保持される。
- スマホとPCの両方で塗り操作が成立する。

## 11. デプロイ方針（ホスティング選定）
### 11.1 候補比較
| 候補 | 構成イメージ | MVP適性 | 注意点 |
| --- | --- | --- | --- |
| Vercel + Supabase | Next.jsをVercel、DB/RealtimeをSupabase | 最優先（推奨） | 無料枠制限（帯域・同時接続） |
| Netlify + Supabase | Next.jsをNetlify、DB/RealtimeをSupabase | 代替案（可） | 一部機能でVercelより設定確認が増える |
| AWS | Amplify or ECS/Lambda + RDS + AppSync/WebSocket | 中長期向け | 初期設計と運用コストが重い |
| Azure | Static Web Apps/App Service + Azure Database + SignalR | 中長期向け | 初期設計と学習コストが重い |

### 11.2 MVP時点の推奨
- 推奨: `Vercel + Supabase`
- 理由
  - Next.jsとの相性が高く、最短で公開まで到達しやすい。
  - 認証なしリンク共有のMVPを実装しやすい。
  - Realtime反映を少ない実装量で実現できる。
  - 無料枠で検証開始しやすい。

### 11.3 MVPデプロイ手順（推奨構成）
1. Supabaseプロジェクト作成（リージョンは東京近傍を優先）。
2. `events / participants / availabilities` テーブルとインデックスを作成。
3. Next.jsに環境変数を設定（`SUPABASE_URL`, `SUPABASE_ANON_KEY` など）。
4. Git連携でVercelへデプロイ（`main` pushで自動デプロイ）。
5. 動作確認（イベント作成、参加、塗り、集計反映、スマホ操作）。
6. 必要に応じて独自ドメイン接続（任意、MVP後でも可）。

### 11.4 将来の移行方針
- MVPで利用継続率が確認できたら、要件に応じて再評価する。
- 再評価条件の例
  - 同時接続数・トラフィックが無料枠を継続的に超える。
  - 厳密なネットワーク統制や監査要件が必要になる。
- 上記が発生した場合はAWS/Azureへの段階移行を検討する。
