# ChannelOS

Ứng dụng cá nhân để quản lý và theo dõi các kênh YouTube, dùng Next.js, Supabase Postgres/Auth và YouTube Data API v3.

## Chức năng

- Đăng nhập bằng Supabase Auth, refresh phiên đăng nhập ở server.
- Phân quyền `admin`, `manager`, `viewer`.
- Thêm kênh từ URL `youtube.com/@handle` hoặc `youtube.com/channel/UC…`.
- Sửa trạng thái, chủ đề, ghi chú; xóa và đồng bộ từng kênh.
- Đồng bộ hàng loạt theo batch nhỏ, có timeout và tiếp tục tự động đến khi xử lý hết các kênh đang hoạt động.
- Quét toàn bộ video công khai theo batch 50 video để tính tổng lượt xem cập nhật hơn số tổng cấp kênh.
- Nhập file Excel quản lý kênh; lưu mật khẩu và secret 2FA bằng AES-GCM trong bảng riêng.
- Lưu video công khai, snapshot metrics và cảnh báo.
- Quản lý chủ đề và theo dõi kênh tham khảo.

Ứng dụng chỉ sử dụng dữ liệu công khai từ YouTube Data API. Không cần Google OAuth hoặc YouTube Analytics API.

## Thiết lập Supabase

1. Tạo project Supabase.
2. Chạy lần lượt các file trong `supabase/migrations`:
   - `001_initial_schema.sql`
   - `002_rls.sql`
   - `003_indexes.sql`
   - `004_remove_youtube_oauth.sql`
   - `005_account_secrets.sql`
   - `006_manual_ordering.sql`
   - `007_prompts.sql`
   - `008_niche_ordering.sql`
   - `009_combined_channel_row_order.sql`
   - `010_channel_metric_changes.sql`
   - `011_video_source_identity.sql`
   - `012_video_tags.sql`
   - `013_channel_video_view_scan.sql`
   - `014_youtube_quota_usage.sql`
3. Tạo người dùng trong Supabase Auth.
4. Cấp quyền `admin` cho người dùng đầu tiên trong SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = '<UUID người dùng trong Auth>';
```

Người dùng mới mặc định có quyền `viewer`.

## Biến môi trường

Sao chép `.env.example` thành `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<secret-key>
ACCOUNT_SECRETS_ENCRYPTION_KEY=<chuỗi-ngẫu-nhiên-tối-thiểu-32-ký-tự>
YOUTUBE_API_KEY=<youtube-data-api-key>
YOUTUBE_DAILY_QUOTA=10000
```

`SUPABASE_SECRET_KEY`, `ACCOUNT_SECRETS_ENCRYPTION_KEY` và `YOUTUBE_API_KEY` chỉ được dùng ở server. Không thêm tiền tố `NEXT_PUBLIC_`. `ACCOUNT_SECRETS_ENCRYPTION_KEY` phải là chuỗi ngẫu nhiên ổn định, tối thiểu 32 ký tự. Secret định dạng cũ được đọc bằng khóa cũ và tự mã hóa lại bằng khóa riêng khi admin xem lần đầu. Không thay đổi hoặc xóa các khóa này nếu chưa chạy quy trình rotate dữ liệu.

Trong Google Cloud, bật **YouTube Data API v3**, tạo API key và giới hạn key chỉ được gọi API này.
`YOUTUBE_DAILY_QUOTA` là hạn mức ngày của project Google Cloud (mặc định 10.000 đơn vị). ChannelOS dùng giá trị này để hiển thị quota ước tính còn lại; bộ đếm chỉ bao gồm request YouTube do ChannelOS thực hiện và reset lúc 00:00 theo múi giờ Pacific.

## Chạy project

```bash
npm install
npm run dev
```

Kiểm tra trước khi deploy:

```bash
npm run typecheck
npm run lint
npm run build
```

Nếu thiếu cấu hình, trang chủ sẽ hiển thị hướng dẫn thay vì tạo dữ liệu mẫu.
