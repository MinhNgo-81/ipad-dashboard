/**
 * Google Apps Script: trả về lịch (hôm nay + ngày mai) và việc chưa xong trong Google Tasks dạng JSON.
 * Chạy dưới tài khoản Google của bạn — không cần Google Cloud Console.
 *
 * Cài đặt (xem README, mục 1):
 *  1. script.google.com → New project → dán toàn bộ file này.
 *  2. Đổi TOKEN bên dưới thành một chuỗi bí mật bất kỳ.
 *  3. Services (+) → thêm "Google Tasks API".
 *  4. Deploy → New deployment → Web app; Execute as: Me; Who has access: Anyone → Deploy, cho phép quyền.
 *  5. Copy "Web app URL" → GitHub secret DATA_URL = <URL>?token=<TOKEN>
 */
const TOKEN = 'DOI-THANH-CHUOI-BI-MAT';
const TZ = 'Asia/Ho_Chi_Minh';

function doGet(e) {
  if (!e || !e.parameter || e.parameter.token !== TOKEN) {
    return ContentService.createTextOutput('{"error":"forbidden"}').setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify(collect_())).setMimeType(ContentService.MimeType.JSON);
}

/** Mac mini gửi mức dùng Claude lên đây (POST ?token=...), lưu lại để doGet trả kèm. */
function doPost(e) {
  if (!e || !e.parameter || e.parameter.token !== TOKEN) {
    return ContentService.createTextOutput('{"error":"forbidden"}').setMimeType(ContentService.MimeType.JSON);
  }
  const body = JSON.parse(e.postData.contents);
  // Giữ mọi mục có % sử dụng (five_hour, seven_day, Fable, ...) + danh sách tên mục để dò lỗi
  const keep = { fetched_at: new Date().toISOString(), bucket_keys: Object.keys(body) };
  Object.keys(body).forEach(function (k) {
    const v = body[k];
    if (v && typeof v === 'object' && typeof v.utilization === 'number') {
      keep[k] = { utilization: v.utilization, resets_at: v.resets_at || null };
    }
  });
  // Bản thô (chỉ các mục khác null): Fable nằm trong danh sách "limits" ở đây
  const raw = {};
  Object.keys(body).forEach(function (k) { if (body[k] !== null) raw[k] = body[k]; });
  keep.raw = JSON.stringify(raw).slice(0, 6000);
  PropertiesService.getScriptProperties().setProperty('claude_usage', JSON.stringify(keep));
  return ContentService.createTextOutput('{"ok":true}').setMimeType(ContentService.MimeType.JSON);
}

function collect_() {
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const start = new Date(today + 'T00:00:00+07:00');
  const end = new Date(start.getTime() + 2 * 86400000);

  const events = [];
  CalendarApp.getAllCalendars().forEach(function (cal) {
    if (cal.isHidden() || !cal.isSelected()) return;
    cal.getEvents(start, end).forEach(function (ev) {
      try {
        if (ev.getMyStatus() === CalendarApp.GuestStatus.NO) return;  // đã từ chối
      } catch (err) {}
      const o = { title: ev.getTitle() || '(Không tiêu đề)', location: ev.getLocation() || '', calendar: cal.getName() };
      if (ev.isAllDayEvent()) {
        o.allDay = true;
        o.startDate = Utilities.formatDate(ev.getAllDayStartDate(), TZ, 'yyyy-MM-dd');
        o.endDate = Utilities.formatDate(ev.getAllDayEndDate(), TZ, 'yyyy-MM-dd');
      } else {
        o.allDay = false;
        o.start = ev.getStartTime().toISOString();
        o.end = ev.getEndTime().toISOString();
      }
      events.push(o);
    });
  });

  const tasks = [];
  const lists = Tasks.Tasklists.list({ maxResults: 100 }).items || [];
  lists.forEach(function (tl) {
    let pageToken;
    do {
      const r = Tasks.Tasks.list(tl.id, { showCompleted: false, showHidden: false, maxResults: 100, pageToken: pageToken });
      (r.items || []).forEach(function (t) {
        if (t.title && t.title.trim()) {
          tasks.push({ title: t.title.trim(), due: t.due ? t.due.slice(0, 10) : null, list: tl.title, notes: t.notes || '' });
        }
      });
      pageToken = r.nextPageToken;
    } while (pageToken);
  });

  // Việc từ Notion (nếu đã cài NOTION_TOKEN + NOTION_DB). Lỗi Notion không làm hỏng cả dashboard.
  let notionError = null;
  if (prop_('NOTION_TOKEN') && prop_('NOTION_DB')) {
    try {
      notionTasks_().forEach(function (t) { tasks.push(t); });
    } catch (err) {
      notionError = String(err && err.message || err).slice(0, 300);
      console.warn('Notion lỗi: ' + notionError);
    }
  }

  const claudeRaw = PropertiesService.getScriptProperties().getProperty('claude_usage');
  return { generated: new Date().toISOString(), events: events, tasks: tasks, notion_error: notionError,
           claude: claudeRaw ? JSON.parse(claudeRaw) : null };
}

// =====================================================================================
// NOTION (tuỳ chọn) — lấy việc chưa xong từ một hoặc nhiều database Notion.
// Cài đặt: Project Settings (bánh răng) → Script Properties → thêm:
//   NOTION_TOKEN = mã bí mật của Integration (bắt đầu bằng ntn_ hoặc secret_)
//   NOTION_DB    = link hoặc ID database; nhiều database thì cách nhau dấu phẩy
// Tự nhận cột: cột tiêu đề, cột trạng thái (Status / Checkbox / Select) và cột ngày (ưu tiên tên có "hạn", "due", "deadline").
// Muốn chỉ định rõ thì thêm (không bắt buộc):
//   NOTION_TITLE, NOTION_STATUS, NOTION_DATE = tên cột
//   NOTION_DONE  = các giá trị coi là "đã xong", cách nhau dấu phẩy (vd: Xong,Đã đăng,Huỷ)
//   NOTION_DAYS  = chỉ lấy việc có hạn trong N ngày tới (việc quá hạn và việc không có hạn vẫn lấy)
//   NOTION_PAST_DAYS = chỉ lấy việc quá hạn trong N ngày gần đây (0 = bỏ hết việc quá hạn; không đặt = lấy tất cả)
//   NOTION_SKIP_UNDATED = 1 để bỏ các dòng không có ngày (hợp với database trộn cả hồ sơ, ghi chú)
// =====================================================================================
const NOTION_VERSION = '2022-06-28';
const DONE_RE = /^(done|complete|completed|xong|đã xong|hoàn thành|đã hoàn thành|cancel+ed|huỷ|hủy|đã huỷ|đã hủy)$/i;

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }

function notion_(path, payload) {
  const opt = {
    method: payload ? 'post' : 'get',
    headers: { Authorization: 'Bearer ' + prop_('NOTION_TOKEN'), 'Notion-Version': NOTION_VERSION },
    muteHttpExceptions: true,
  };
  if (payload) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(payload); }
  const res = UrlFetchApp.fetch('https://api.notion.com/v1/' + path, opt);
  const body = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200) {
    const hint = res.getResponseCode() === 404 ? ' (database chưa được Connect với Integration?)' : '';
    throw new Error('Notion ' + res.getResponseCode() + ': ' + (body.message || '') + hint);
  }
  return body;
}

/** Lấy ID 32 ký tự từ link hoặc ID Notion. */
function notionId_(s) {
  // bỏ phần ?v=... và dấu /, ID là 32 ký tự cuối (link dạng .../Ten-trang-<id>)
  const m = String(s).trim().split('?')[0].replace(/\/+$/, '').replace(/-/g, '').match(/[0-9a-f]{32}$/i);
  return m ? m[0] : '';
}

function plain_(arr) { return (arr || []).map(function (t) { return t.plain_text; }).join('').trim(); }

/** Chọn cột tiêu đề / trạng thái / ngày từ cấu trúc database. */
function notionPick_(props) {
  const names = Object.keys(props);
  const byType = function (type, re) {
    return names.filter(function (n) { return props[n].type === type && (!re || re.test(n)); })[0];
  };
  const want = function (key) { const n = prop_(key); return n && props[n] ? n : null; };
  return {
    title: want('NOTION_TITLE') || byType('title'),
    status: want('NOTION_STATUS') || byType('status') || byType('checkbox') ||
            byType('select', /trạng thái|tình trạng|status|tiến độ/i),
    date: want('NOTION_DATE') || byType('date', /hạn|due|deadline/i) || byType('date', /ngày|date/i) || byType('date'),
  };
}

/** Danh sách giá trị "đã xong" của cột trạng thái. */
function notionDoneNames_(p) {
  const extra = prop_('NOTION_DONE').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(String);
  const isDone = function (name) { return DONE_RE.test(name) || extra.indexOf(name.toLowerCase()) >= 0; };
  if (!p) return [];
  if (p.type === 'status') {
    const completeIds = [];
    (p.status.groups || []).forEach(function (g) {
      if (/complete/i.test(g.name)) g.option_ids.forEach(function (id) { completeIds.push(id); });
    });
    return p.status.options.filter(function (o) { return completeIds.indexOf(o.id) >= 0 || isDone(o.name); })
                           .map(function (o) { return o.name; });
  }
  if (p.type === 'select') return p.select.options.filter(function (o) { return isDone(o.name); }).map(function (o) { return o.name; });
  return [];
}

function notionTasks_() {
  const days = parseInt(prop_('NOTION_DAYS'), 10);
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const limit = days >= 0 ? Utilities.formatDate(new Date(Date.now() + days * 86400000), TZ, 'yyyy-MM-dd') : null;
  const past = parseInt(prop_('NOTION_PAST_DAYS'), 10);
  const oldest = past >= 0 ? Utilities.formatDate(new Date(Date.now() - past * 86400000), TZ, 'yyyy-MM-dd') : null;
  const out = [];

  prop_('NOTION_DB').split(',').map(notionId_).filter(String).forEach(function (dbId) {
    const db = notion_('databases/' + dbId);
    const listName = plain_(db.title) || 'Notion';
    const col = notionPick_(db.properties);
    if (!col.title) throw new Error('Database "' + listName + '" không có cột tiêu đề');
    const st = col.status ? db.properties[col.status] : null;
    const done = notionDoneNames_(st);

    // Lọc ngay trên Notion: bỏ việc đã xong
    let filter = null;
    if (st && st.type === 'checkbox') filter = { property: col.status, checkbox: { equals: false } };
    else if (st && done.length) {
      filter = { and: done.map(function (n) {
        const c = { property: col.status }; c[st.type] = { does_not_equal: n }; return c;
      }) };
    }

    let cursor = null, pages = 0;
    do {
      const q = { page_size: 100 };
      if (filter) q.filter = filter;
      if (cursor) q.start_cursor = cursor;
      const r = notion_('databases/' + dbId + '/query', q);
      (r.results || []).forEach(function (pg) {
        if (pg.archived || pg.in_trash) return;
        const pr = pg.properties;
        const title = plain_(pr[col.title] && pr[col.title].title);
        if (!title) return;
        const d = col.date && pr[col.date] && pr[col.date].date;
        const due = d && d.start ? d.start.slice(0, 10) : null;
        if (limit && due && due > limit) return;   // hạn còn xa
        if (oldest && due && due < oldest) return;   // quá hạn đã lâu (thường là việc quên đổi trạng thái)
        if (!due && prop_('NOTION_SKIP_UNDATED') === '1') return;   // bỏ việc không có ngày
        out.push({ title: title, due: due, list: listName, notes: '', source: 'notion' });
      });
      cursor = r.has_more ? r.next_cursor : null;
      pages++;
    } while (cursor && pages < 10);   // tối đa 1.000 việc mỗi database
  });
  return out;
}

/** Bấm Run hàm này để kiểm tra riêng phần Notion (xem kết quả ở Execution log). */
function testNotion() {
  prop_('NOTION_DB').split(',').map(notionId_).filter(String).forEach(function (dbId) {
    const db = notion_('databases/' + dbId);
    const col = notionPick_(db.properties);
    Logger.log('Database "' + plain_(db.title) + '": tiêu đề = ' + col.title + ', trạng thái = ' + col.status +
               ', ngày = ' + col.date + ', giá trị coi là xong = ' +
               JSON.stringify(notionDoneNames_(col.status ? db.properties[col.status] : null)));
  });
  const t = notionTasks_();
  Logger.log(t.length + ' việc chưa xong:\n' + t.slice(0, 30).map(function (x) {
    return '- ' + x.title + (x.due ? '  (hạn ' + x.due + ')' : '');
  }).join('\n'));
}

/** Bấm Run hàm này trong trình soạn thảo để kiểm tra (xem kết quả ở Execution log). */
function testCollect() {
  Logger.log(JSON.stringify(collect_(), null, 2));
}
