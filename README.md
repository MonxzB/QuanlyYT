# ChannelOS

Ứng dụng quản lý mạng lưới kênh YouTube, dùng Next.js/Vinext, Supabase Postgres/Auth và YouTube Data API v3.

## Chức năng chính

- Đăng nhập Supabase Auth và phân quyền `admin`, `manager`, `viewer`.
- Dashboard, kênh, tài khoản, hồ sơ trình duyệt, chủ đề, nội dung, cảnh báo và báo cáo đều đọc dữ liệu thật từ Supabase.
- Thêm kênh bằng URL `youtube.com/@handle` hoặc `youtube.com/channel/UC…`.
- Đồng bộ metadata kênh, uploads playlist, video theo batch 50, daily metrics và cảnh báo.
- OAuth YouTube Analytics; access/refresh token được mã hóa AES-GCM và chỉ xử lý phía server.
- Giao diện tiếng Việt với từ điển `locales/vi.json` và `locales/en.json`.

## Thiết lập Supabase

1. Tạo project Supabase.
2. Chạy lần lượt:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls.sql`
   - `supabase/migrations/003_indexes.sql`
3. Tạo người dùng đầu tiên trong Supabase Auth.
4. Nâng quyền người dùng đầu tiên trong SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = '<UUID người dùng trong Auth>';
```

Người dùng mới mặc định có quyền `viewer`. Chỉ `admin` được đổi vai trò trực tiếp trong database; client không thể tự nâng quyền.

## Biến môi trường

Sao chép `.env.example` thành `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<secret-key>
YOUTUBE_API_KEY=<youtube-data-api-key>
GOOGLE_CLIENT_ID=<oauth-client-id>
GOOGLE_CLIENT_SECRET=<oauth-client-secret>
OAUTH_TOKEN_ENCRYPTION_KEY=<chuỗi-ngẫu-nhiên-tối-thiểu-32-ký-tự>
NEXT_PUBLIC_APP_URL=http://localhost:5173
```

`SUPABASE_SECRET_KEY`, `GOOGLE_CLIENT_SECRET` và `OAUTH_TOKEN_ENCRYPTION_KEY` là secret server-side, tuyệt đối không thêm tiền tố `NEXT_PUBLIC_`.

## Thiết lập Google Cloud

1. Bật **YouTube Data API v3**.
2. Tạo API key và gán vào `YOUTUBE_API_KEY`.
3. Nếu dùng Analytics, bật **YouTube Analytics API**, cấu hình OAuth consent screen và tạo OAuth Web Client.
4. Redirect URI:

```
<NEXT_PUBLIC_APP_URL>/api/youtube/auth/callback
```

## Chạy và kiểm tra

```bash
npm install
npm run dev
npx tsc --noEmit
npm run lint
npm run build
```

Nếu thiếu biến môi trường, ứng dụng hiển thị trang “ChannelOS đang chờ cấu hình” và không tạo dữ liệu mẫu.
