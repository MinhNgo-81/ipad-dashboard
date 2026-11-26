# Dashboard Lịch + Việc cần làm trên iPad Air

Bản này dùng lại toàn bộ "phía máy chủ" của Kindle Dashboard (Apps Script → GitHub Actions vẽ ảnh → GitHub Pages).
Chỉ thay **phía thiết bị**: thay vì jailbreak Kindle và chạy `loop.sh`, iPad mở một trang web nhỏ (`ipad/index.html`)
hiện ảnh toàn màn hình và tự tải ảnh mới mỗi 5 phút. **Không cần jailbreak, không cần cài app.**

```
Google Calendar + Tasks ─► Apps Script ─► GitHub Actions vẽ PNG 1640×2360 ─► GitHub Pages
                                                                              ├─ <SECRET_PATH>/dashboard.png
                                                                              └─ <SECRET_PATH>/index.html  ◄── iPad (Safari, toàn màn hình)
```

## Đã sửa gì so với bản Kindle

| File | Thay đổi |
|---|---|
| `render.py` | Kích thước ảnh đọc từ biến `DASH_W`, `DASH_H` (không đặt thì vẫn là khổ Kindle 1236×1648). |
| `.github/workflows/update.yml` | Đặt `DASH_W=1640`, `DASH_H=2360`, `DASH_SCALE=1.75`; chép `ipad/index.html` vào cùng thư mục bí mật với ảnh. |
| `ipad/index.html` (mới) | Trang hiển thị cho iPad: toàn màn hình, tự tải ảnh, không bao giờ bị màn trắng khi rớt mạng, làm tối ban đêm, giữ màn hình sáng. |
| `setup_github.sh` | Cuối cùng in thêm **Link iPad**. |
| `fonts/` | Đã kèm sẵn font Inter, GitHub khỏi phải tải mỗi lần. |
| `apps_script.gs` | Thêm lấy việc chưa xong từ **Notion** (tuỳ chọn, xem mục bên dưới). |
| `windows/` (mới) | Bản Windows của script đọc mức dùng Claude (thay cho `mac/`). |
| `.github/workflows/keepalive.yml` (mới) | Mỗi tuần tự bật lại lịch chạy, tránh GitHub tắt sau 60 ngày. |

Thư mục `kindle/` không còn cần cho iPad (để nguyên vì script cài đặt vẫn ghi vào đó).

## Cài đặt

**Phần 1 (Apps Script) và Phần 2 (GitHub)**: làm y hệt `README.md`, chạy `setup_github.sh` trong thư mục này.
Khi xong, script in ra **Link iPad** dạng:

```
https://<tên-github>.github.io/kindle-dashboard/<SECRET_PATH>/
```

(Nếu làm tay theo Cách B thì tự ghép link như trên.)

**Phần 3: trên iPad**

1. Mở **Link iPad** bằng **Safari** → thấy dashboard là đúng.
2. Bấm nút **Chia sẻ** → **Thêm vào MH chính** → **Thêm**. Mở từ biểu tượng mới trên màn hình chính: trang chạy toàn màn hình, không có thanh địa chỉ.
3. **Cài đặt → Màn hình & Độ sáng → Tự động khoá → Không bao giờ.**
4. (Khuyên dùng) Khoá iPad vào đúng app này: **Cài đặt → Trợ năng → Truy cập được hướng dẫn** → bật, đặt mật mã.
   Mở dashboard, **bấm nút nguồn (hoặc nút Home) 3 lần** → **Bắt đầu**. Muốn thoát: bấm 3 lần lại, nhập mật mã.
   Trong Tuỳ chọn có thể tắt "Cảm ứng" để chạm nhầm không làm gì.
5. Cắm sạc và để trên giá dọc, chỗ thoáng.
   - iOS 13 trở lên: bật **Cài đặt → Pin → Tình trạng pin → Sạc tối ưu hoá** cho pin bền khi cắm 24/7.
   - **iPad Air 1 (iOS 12.5.x) không có tuỳ chọn này.** Cắm 100% liên tục nhiều tháng làm pin chai, có thể phồng.
     Nên dùng **ổ cắm hẹn giờ** (hoặc ổ cắm thông minh): ví dụ chỉ cấp điện 2 tiếng sáng + 2 tiếng chiều,
     để pin dao động khoảng 40–90%. Thỉnh thoảng sờ mặt lưng; nếu màn hình bị đẩy cong lên thì rút điện ngay.

## Tuỳ chỉnh

Thêm tham số vào cuối link (sửa link rồi **Thêm vào MH chính** lại):

| Tham số | Ý nghĩa | Mặc định |
|---|---|---|
| `refresh=10` | Bao nhiêu phút tải ảnh mới | `5` |
| `night=22-6` | Khung giờ làm tối màn hình (`0-0` = tắt) | `0-7` |
| `dim=0.8` | Độ tối ban đêm, 0 → 0.9 | `0.6` |

Ví dụ: `https://.../<SECRET_PATH>/?refresh=10&night=23-6&dim=0.75`

- **Chạm 2 lần** vào màn hình = tải lại ngay (khi không bật khoá cảm ứng trong Truy cập được hướng dẫn).
- Rớt mạng: vẫn giữ ảnh cũ, góc dưới hiện "Mất kết nối · ảnh cũ N phút".
- Kích thước ảnh trong `update.yml` đang đặt cho **iPad Air 1/2** (`1536 x 2048`, `DASH_SCALE: "1.6"`).
  iPad Air 10.9"/11": `1640 x 2360`, `"1.75"` · iPad Air 13": `2048 x 2732`, `"2.2"`.
- Chữ to/nhỏ: chỉnh `DASH_SCALE` (số lớn hơn = chữ to hơn, ít dòng hơn).
- Các tuỳ chỉnh khác (thành phố, ẩn lịch, bố cục Claude) giống hệt `README.md` Phần 4–5.

## Thêm việc từ Notion (miễn phí, dùng được với Notion Free)

Việc chưa xong trong Notion được gộp chung vào mục **Việc cần làm**, cùng với Google Tasks.

1. Vào **https://www.notion.so/profile/integrations** → **New integration** → đặt tên `Dashboard`,
   chọn workspace, loại **Internal** → **Save**. Mở mục **Configuration**, copy **Internal Integration Secret**.
   Ở mục *Capabilities* chỉ cần tick **Read content**.
2. Mở database nhiệm vụ trong Notion → **⋯** (góc phải trên) → **Connections** → chọn `Dashboard` → **Confirm**.
   Database nằm trong một trang cha thì Connect ở trang cha cũng được.
3. Copy link database: **⋯ → Copy link**.
4. Trong Apps Script: dán lại toàn bộ `apps_script.gs` mới (giữ dòng `TOKEN` của bạn) → **Save**.
   Vào **Project Settings** (bánh răng bên trái) → **Script Properties** → **Add script property**:

   | Property | Value |
   |---|---|
   | `NOTION_TOKEN` | mã secret ở bước 1 |
   | `NOTION_DB` | link database ở bước 3 (nhiều database thì cách nhau dấu phẩy) |

5. Chọn hàm **`testNotion`** → **Run** → cho phép quyền mới ("kết nối dịch vụ bên ngoài").
   Execution log sẽ ghi script đã nhận cột nào làm tiêu đề / trạng thái / hạn, và danh sách việc chưa xong.
6. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (link giữ nguyên).

Script tự nhận cột:
- **Tiêu đề**: cột tên trang.
- **Trạng thái**: cột kiểu *Status* (các giá trị trong nhóm *Complete* là xong), hoặc *Checkbox* (tick = xong),
  hoặc *Select* tên "Trạng thái/Status" (giá trị như Xong, Done, Hoàn thành, Huỷ là xong).
- **Hạn**: cột ngày có tên chứa "hạn", "due", "deadline"; không có thì lấy cột ngày đầu tiên.

Nhận sai thì thêm Script Properties để chỉ định (không bắt buộc):

| Property | Ví dụ | Ý nghĩa |
|---|---|---|
| `NOTION_TITLE` / `NOTION_STATUS` / `NOTION_DATE` | `Ngày đăng` | Tên cột cụ thể |
| `NOTION_DONE` | `Đã đăng,Bỏ` | Thêm giá trị được coi là "xong" |
| `NOTION_DAYS` | `14` | Chỉ lấy việc có hạn trong 14 ngày tới (việc quá hạn và việc không có hạn vẫn lấy). Nên đặt nếu database có rất nhiều dòng. |

Tick xong một việc bên Notion → biến khỏi dashboard sau lần vẽ ảnh tiếp theo (thường 15–20 phút).
Notion lỗi (hết hạn secret, bỏ Connect…) thì dashboard vẫn chạy bình thường với lịch + Google Tasks.

## Mức dùng Claude trên máy Windows

Thay cho Phần 5 (bản Mac) trong `README.md`. Cần một máy Windows **luôn bật**, đã cài và đăng nhập **Claude Code**
(dòng lệnh `claude`; đăng nhập xong sẽ có file `%USERPROFILE%\.claude\.credentials.json`).

1. Chép thư mục `windows\` vào máy đó, ví dụ `C:\dashboard-windows\`.
2. Chạy thử (chỉ đọc số, chưa gửi đi):
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\dashboard-windows\claude_usage.ps1 -DryRun
   ```
   Thấy dòng `Phiên 5 giờ: ..%` và `Tuần: ..%` là được.
3. Cài job chạy ngầm 10 phút/lần (sẽ hỏi DATA_URL, dán vào rồi Enter; chữ không hiện khi dán):
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\dashboard-windows\install.ps1
   ```
4. Trên GitHub: **Settings → Secrets and variables → Actions → Variables** → `DASH_LAYOUT` = `claude`.

Xem nhật ký ở `claude_usage.log` cạnh script. Gỡ job:
`Unregister-ScheduledTask -TaskName ClaudeUsageDashboard -Confirm:$false`.
Máy tắt/ngủ quá 2 giờ thì dashboard ghi "SỐ LIỆU CŨ". Số liệu là **% của gói Pro/Max**, không phải số token.

## Lưu ý

- **Chi phí 0 đồng khi repo để công khai (Public).** Repo riêng tư ở gói Free sẽ vượt hạn mức phút chạy và không dùng được Pages.
  Dữ liệu vẫn kín: link Apps Script, token Notion nằm trong Secrets / Script Properties; ảnh nằm ở thư mục tên ngẫu nhiên.
- GitHub tắt lịch chạy của repo công khai sau 60 ngày không có thay đổi. Workflow `keepalive.yml` mỗi thứ Hai tự bật lại
  để chuyện này không xảy ra. Nếu dashboard vẫn đứng yên: tab **Actions** → chọn workflow → **Enable workflow**.
- Ảnh vẫn chỉ cập nhật khi GitHub Actions chạy (khoảng 15 phút/lần, đôi khi trễ). Tải trên iPad 5 phút/lần chỉ để bắt kịp ảnh mới nhanh hơn.
- Web không chỉnh được độ sáng thật của iPad; "làm tối" là lớp phủ đen. Muốn tối hơn nữa, giảm độ sáng tay hoặc dùng **Phím tắt → Tự động hoá → Thời gian trong ngày → Đặt độ sáng**.
- Link iPad và link ảnh vẫn là bí mật như bản Kindle: ai có link là xem được lịch của bạn.
