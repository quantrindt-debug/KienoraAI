<script>
/* ==========================================================
   KIENORAAI - FRONTEND
   Quan trọng:
   - Câu hỏi thông thường dùng action "ask" trên Google Apps Script.
   - Không còn phụ thuộc vào việc HTML tự giữ toàn bộ kho để trả lời.
   - Sheet1 đọc từ dòng 2: Q | A | FileName | FileUrl.
   ========================================================== */

const API_URL =
  "https://script.google.com/macros/s/AKfycby8GRv6ew_QapByIvYL3RS3dqhwsuUKU3XykLmJE8vyWoDZeGmEqAn40-I2fQHQk918/exec";

const STORAGE_SHARED = "kienora_learned_qa";
const STORAGE_USER = "kienora_current_user";
const STORAGE_ROLE = "kienora_current_role";

let currentUser = localStorage.getItem(STORAGE_USER) || null;
let currentRole = localStorage.getItem(STORAGE_ROLE) || null;

let sharedSheetData = [];
let personalSheetData = [];
let authMode = "login";

/* ================= HELPERS ================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeItem(item) {
  item = item || {};

  return {
    q: String(item.q ?? item.Q ?? "").trim(),
    a: String(item.a ?? item.A ?? "").trim(),
    fileName: String(item.fileName ?? item.FileName ?? "").trim(),
    fileUrl: String(item.fileUrl ?? item.FileUrl ?? "").trim()
  };
}

function normalizeList(list) {
  return Array.isArray(list)
    ? list.map(normalizeItem).filter(x => x.q || x.a)
    : [];
}

function isValidHttpUrl(url) {
  if (!url) return true;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ||
           parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function safeUrl(url) {
  return isValidHttpUrl(url) ? escapeHtml(url) : "";
}

function getLearnedQA() {
  if (sharedSheetData.length) {
    return sharedSheetData;
  }

  try {
    return normalizeList(
      JSON.parse(localStorage.getItem(STORAGE_SHARED) || "[]")
    );
  } catch {
    return [];
  }
}

function setSharedData(data) {
  sharedSheetData = normalizeList(data);

  localStorage.setItem(
    STORAGE_SHARED,
    JSON.stringify(sharedSheetData)
  );
}

/* ================= API ================= */

async function postApi(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  return await response.json();
}

async function getApi(params) {
  const url =
    API_URL + "?" +
    new URLSearchParams(params).toString();

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  return await response.json();
}

/* ================= CLOUD DATA ================= */

async function loadCloudData(showMessage = false) {
  try {
    const result = await getApi({
      action: "get_data",
      username: currentUser || ""
    });

    if (result.status !== "success") {
      throw new Error(result.message || "Không lấy được dữ liệu.");
    }

    setSharedData(
      Array.isArray(result.sheet1)
        ? result.sheet1
        : result.data
    );

    personalSheetData = normalizeList(result.personal);

    renderQAListInModal();

    if (showMessage) {
      addAIMessage(
        "🔄 <b>Đã đồng bộ thành công</b> với Google Sheets."
      );
    }

    return true;

  } catch (error) {

    try {
      sharedSheetData = normalizeList(
        JSON.parse(
          localStorage.getItem(STORAGE_SHARED) || "[]"
        )
      );
    } catch {
      sharedSheetData = [];
    }

    if (showMessage) {
      addAIMessage(
        "⚠️ Không kết nối được Google Sheets. " +
        "KienoraAI đang dùng dữ liệu cục bộ đã lưu."
      );
    }

    return false;
  }
}

/* ================= AUTH ================= */

function updateAuthUI() {
  const dot = document.getElementById("authStatusDot");
  const text = document.getElementById("authUsernameText");
  const buttons = document.getElementById("authButtons");

  if (currentUser) {

    dot.className =
      "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse";

    text.innerText =
      currentUser +
      (currentRole === "admin"
        ? " (Quản trị)"
        : " (Cá nhân)");

    buttons.innerHTML = `
      <button onclick="logout()"
        class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-xl font-bold transition">
        Đăng xuất
      </button>`;

  } else {

    dot.className =
      "w-2.5 h-2.5 rounded-full bg-slate-400";

    text.innerText =
      "Khách (Chưa đăng nhập)";

    buttons.innerHTML = `
      <div class="flex items-center gap-1.5">
        <button onclick="openAuthModal('login')"
          class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl font-bold transition shadow-sm">
          Đăng nhập
        </button>

        <button onclick="openAuthModal('register')"
          class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-xl font-bold transition">
          Đăng ký
        </button>
      </div>`;
  }
}

function openAuthModal(mode) {
  authMode = mode;

  document.getElementById("authModal").classList.remove("hidden");

  document.getElementById("modalUsername").value = "";
  document.getElementById("modalPassword").value = "";
  document.getElementById("modalEmail").value = "";

  const title =
    document.getElementById("authModalTitle");

  const btn =
    document.getElementById("authSubmitBtn");

  const extra =
    document.getElementById("registerExtraField");

  if (mode === "register") {

    title.innerText =
      "Đăng ký tài khoản KienoraAI";

    btn.innerText =
      "Gửi yêu cầu đăng ký";

    extra.classList.remove("hidden");

  } else {

    title.innerText =
      "Đăng nhập KienoraAI";

    btn.innerText =
      "Đăng nhập";

    extra.classList.add("hidden");
  }
}

function closeAuthModal() {
  document.getElementById("authModal").classList.add("hidden");
}

async function submitAuthForm() {
  const username =
    document.getElementById("modalUsername").value.trim();

  const password =
    document.getElementById("modalPassword").value.trim();

  const email =
    document.getElementById("modalEmail").value.trim();

  const btn =
    document.getElementById("authSubmitBtn");

  if (!username || !password) {
    alert("Vui lòng nhập tên đăng nhập và mật khẩu.");
    return;
  }

  btn.disabled = true;

  try {

    if (authMode === "register") {

      const result = await postApi({
        action: "register",
        username,
        password,
        email
      });

      alert(
        result.message ||
        "Đã gửi yêu cầu đăng ký."
      );

      if (result.status === "success") {
        closeAuthModal();
      }

    } else {

      const result = await postApi({
        action: "login",
        username,
        password
      });

      if (result.status !== "success") {
        alert(
          result.message ||
          "Đăng nhập không thành công."
        );
        return;
      }

      currentUser =
        result.username || username;

      currentRole =
        result.role || "user";

      localStorage.setItem(
        STORAGE_USER,
        currentUser
      );

      localStorage.setItem(
        STORAGE_ROLE,
        currentRole
      );

      updateAuthUI();
      closeAuthModal();

      await loadCloudData();

      addAIMessage(
        "🎉 <b>Đăng nhập thành công!</b> " +
        "Xin chào " +
        escapeHtml(currentUser) +
        "."
      );
    }

  } catch (error) {

    alert(
      "❌ Không thể kết nối máy chủ KienoraAI."
    );

  } finally {

    btn.disabled = false;
  }
}

async function logout() {
  currentUser = null;
  currentRole = null;

  localStorage.removeItem(STORAGE_USER);
  localStorage.removeItem(STORAGE_ROLE);

  personalSheetData = [];

  updateAuthUI();
  await loadCloudData();

  alert("Đã đăng xuất KienoraAI.");
}

/* ================= COMMAND UI ================= */

function toggleCommandBox() {
  const box =
    document.getElementById("commandBoxContainer");

  const icon =
    document.getElementById("cmdIcon");

  if (box.classList.contains("hidden")) {

    box.classList.remove("hidden");

    setTimeout(() => {

      box.classList.remove(
        "scale-95",
        "opacity-0"
      );

      box.classList.add(
        "scale-100",
        "opacity-100"
      );

      document.getElementById(
        "cmdInput"
      ).focus();

    }, 10);

    icon.classList.remove(
      "fa-wand-magic-sparkles"
    );

    icon.classList.add("fa-xmark");

  } else {

    box.classList.remove(
      "scale-100",
      "opacity-100"
    );

    box.classList.add(
      "scale-95",
      "opacity-0"
    );

    setTimeout(() => {
      box.classList.add("hidden");
    }, 200);

    icon.classList.remove("fa-xmark");

    icon.classList.add(
      "fa-wand-magic-sparkles"
    );
  }
}

function handleCmdKeyPress(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    executeUserCommand();
  }
}

function addUserMessage(text) {
  const container =
    document.getElementById("cmdMessages");

  container.insertAdjacentHTML(
    "beforeend",
    `
      <div class="flex items-start justify-end gap-2">
        <div class="bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-sm shadow-sm max-w-[88%] text-xs whitespace-pre-wrap break-words">
          ${escapeHtml(text)}
        </div>

        <div class="w-7 h-7 bg-slate-300 text-slate-700 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold">
          Bạn
        </div>
      </div>
    `
  );

  container.scrollTop =
    container.scrollHeight;
}

function addAIMessage(html) {
  const container =
    document.getElementById("cmdMessages");

  container.insertAdjacentHTML(
    "beforeend",
    `
      <div class="flex items-start gap-2">

        <div class="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold">
          AI
        </div>

        <div class="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 max-w-[88%] leading-relaxed text-xs break-words">
          ${html}
        </div>

      </div>
    `
  );

  container.scrollTop =
    container.scrollHeight;
}

function addLoadingMessage() {
  const id =
    "ai_loading_" + Date.now();

  const container =
    document.getElementById("cmdMessages");

  container.insertAdjacentHTML(
    "beforeend",
    `
      <div id="${id}" class="flex items-start gap-2">

        <div class="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold">
          AI
        </div>

        <div class="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 text-slate-400 text-xs italic">
          KienoraAI đang tra cứu kho tri thức...
        </div>

      </div>
    `
  );

  container.scrollTop =
    container.scrollHeight;

  return id;
}

/* ================= FILE RESPONSE ================= */

function buildKnowledgeAnswer(result) {
  const item = normalizeItem(result.data);
  const source =
    result.source === "personal"
      ? "🔒 Kho tri thức cá nhân"
      : "🌐 Kho tri thức chung";

  let html = `
    <div class="text-[10px] ${
      result.source === "personal"
        ? "bg-sky-50 text-sky-700"
        : "bg-indigo-50 text-indigo-700"
    } px-2 py-0.5 rounded font-bold mb-2 inline-block">
      ${source}
    </div>

    <p class="whitespace-pre-wrap break-words">
      ${escapeHtml(item.a)}
    </p>
  `;

  if (item.fileName && item.fileUrl) {

    const url = safeUrl(item.fileUrl);

    if (url) {

      html += `
        <div class="mt-3 bg-slate-50 border border-indigo-100 rounded-2xl p-3">

          <div class="flex items-center justify-between gap-3">

            <div class="flex items-center gap-2.5 min-w-0">

              <div class="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                <i class="fa-solid fa-file-pdf"></i>
              </div>

              <div class="min-w-0">
                <p class="font-bold text-xs text-slate-800 truncate">
                  ${escapeHtml(item.fileName)}
                </p>

                <p class="text-[10px] text-slate-400">
                  Tài liệu đính kèm
                </p>
              </div>

            </div>

            <a href="${url}"
              target="_blank"
              rel="noopener noreferrer"
              class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold transition flex items-center gap-1 shrink-0">

              <i class="fa-solid fa-download"></i>
              Tải tài liệu
            </a>

          </div>
        </div>
      `;
    }
  }

  return html;
}

/* ================= NORMAL COMMANDS ================= */

function getHelpHtml() {
  let html = `
    🤖 <b>HƯỚNG DẪN LỆNH KIENORAAI</b><br><br>

    <b>1. Hệ thống</b><br>

    • <code class="text-indigo-600 font-bold">/help</code>
      - Xem danh sách lệnh.<br>

    • <code class="text-indigo-600 font-bold">/sync</code> /
      <code class="text-indigo-600 font-bold">/lammoi</code>
      - Đồng bộ Google Sheets.<br>

    • <code class="text-indigo-600 font-bold">/thongtin</code> /
      <code class="text-indigo-600 font-bold">/info</code>
      - Xem thông tin tài khoản.<br>

    • <code class="text-indigo-600 font-bold">/thongke</code>
      - Thống kê kho tri thức.<br><br>

    <b>2. Kho tri thức</b><br>

    • <code class="text-indigo-600 font-bold">/quanly</code> /
      <code class="text-indigo-600 font-bold">/ql</code>
      - Mở kho quản lý.<br>

    • <code class="text-indigo-600 font-bold">/day [hỏi] | [đáp]</code>
      - Dạy KienoraAI.<br>

    • <code class="text-indigo-600 font-bold">/day [hỏi] | [đáp] | [tên file] | [link]</code>
      - Dạy kèm tài liệu.<br>

    • <code class="text-indigo-600 font-bold">/tim [từ khóa]</code>
      - Tìm tri thức.<br>
  `;

  if (currentRole === "admin") {

    html += `
      • <code class="text-rose-600 font-bold">/xoa [cụm từ]</code>
        - Xóa tri thức chung.<br>

      • <code class="text-rose-600 font-bold">/xoatoanbo</code>
        - Xóa toàn bộ kho chung.<br>
    `;
  }

  html += `
    <br>

    <b>3. Tiện ích</b><br>

    • <code class="text-indigo-600 font-bold">/diem [mã_hs]</code>
      - Tra cứu hồ sơ/điểm.<br>

    • <code class="text-indigo-600 font-bold">/lich</code> /
      <code class="text-indigo-600 font-bold">/thoikhoabieu</code>
      - Lịch / thời khóa biểu.<br>

    • <code class="text-indigo-600 font-bold">/thongbao</code>
      - Thông báo nhà trường.
  `;

  if (currentUser && currentRole === "admin") {

    html += `
      <br><br>

      <b>🛡️ 4. Quản trị</b><br>

      • <code class="text-rose-600 font-bold">/ds_tk</code>
        - Danh sách tài khoản.<br>

      • <code class="text-rose-600 font-bold">/duyet_tk [user]</code>
        - Duyệt tài khoản.<br>

      • <code class="text-rose-600 font-bold">/khoa_tk [user]</code>
        - Khóa tài khoản.<br>

      • <code class="text-rose-600 font-bold">/ds_tt</code>
        - Tri thức chờ duyệt.<br>

      • <code class="text-rose-600 font-bold">/duyet_tt [dòng]</code>
        - Duyệt tri thức.<br>

      • <code class="text-rose-600 font-bold">/xoa_tt [dòng]</code>
        - Từ chối tri thức.<br>

      • <code class="text-rose-600 font-bold">/backup</code>
        - Hướng dẫn sao lưu JSON.<br>

      • <code class="text-rose-600 font-bold">/logs</code>
        - Nhật ký hệ thống.
    `;
  }

  return html;
}

async function executeUserCommand() {
  const input =
    document.getElementById("cmdInput");

  const text =
    input.value.trim();

  const sendBtn =
    document.getElementById("sendCommandBtn");

  if (!text || sendBtn.disabled) {
    return;
  }

  addUserMessage(text);
  input.value = "";
  sendBtn.disabled = true;

  const lower = text.toLowerCase();

  try {

    /* ================= LOCAL COMMANDS ================= */

    if (lower === "/help" || lower === "/giupdo") {
      addAIMessage(getHelpHtml());
      return;
    }

    if (
      lower === "/xinchao" ||
      lower === "hi" ||
      lower === "hello"
    ) {
      addAIMessage(
        "👋 Xin chào! Tôi là <b>KienoraAI</b>. " +
        "Bạn hãy đặt câu hỏi hoặc gõ <code>/help</code>."
      );
      return;
    }

    if (
      lower === "/quanly" ||
      lower === "/ql"
    ) {
      openQAManager();
      addAIMessage(
        "🗂️ <b>Đã mở kho tri thức KienoraAI.</b>"
      );
      return;
    }

    if (
      lower === "/sync" ||
      lower === "/lammoi"
    ) {
      const ok =
        await loadCloudData(false);

      addAIMessage(
        ok
          ? "🔄 <b>Đã đồng bộ thành công với Google Sheets.</b>"
          : "⚠️ <b>Đồng bộ chưa thành công.</b>"
      );

      return;
    }

    if (
      lower === "/thongtin" ||
      lower === "/info"
    ) {
      const user =
        currentUser
          ? `<b>${escapeHtml(currentUser)}</b> (${
              currentRole === "admin"
                ? "Quản trị viên"
                : "Cá nhân"
            })`
          : "Chưa đăng nhập (Khách)";

      addAIMessage(`
        ℹ️ <b>Thông tin KienoraAI</b><br>
        • Tài khoản: ${user}<br>
        • Kho tri thức chung: ${getLearnedQA().length} mục<br>
        • Kho tri thức cá nhân: ${personalSheetData.length} mục<br>
        • Trạng thái: 🟢 Trực tuyến
      `);

      return;
    }

    if (lower === "/thongke") {
      try {
        const result = await getApi({
          action: "stats",
          username: currentUser || ""
        });

        if (result.status !== "success") {
          throw new Error(result.message || "Không lấy được thống kê.");
        }

        addAIMessage(`
          📊 <b>Thống kê KienoraAI</b><br>
          • Kho tri thức chung: <b>${result.sharedTotal}</b> mục.<br>
          • Kho tri thức cá nhân: <b>${result.personalTotal}</b> mục.<br>
          • Tổng cộng: <b>${result.total}</b> mục.
        `);
      } catch (error) {
        addAIMessage(
          "❌ Không thể lấy thống kê trực tiếp từ Google Sheets."
        );
      }

      return;
    }

    if (lower === "/thongbao") {
      addAIMessage(`
        📢 <b>Thông báo KienoraAI</b><br>
        • Hệ thống đang hoạt động.<br>
        • Tri thức được quản lý tập trung trên Google Sheets.<br>
        • Admin có thể duyệt tri thức từ kho chờ duyệt.
      `);

      return;
    }

    if (
      lower === "/lich" ||
      lower === "/thoikhoabieu"
    ) {
      addAIMessage(`
        📅 <b>Lịch / Thời khóa biểu</b><br>
        Tính năng này đã được chuẩn bị trong bộ lệnh KienoraAI
        và có thể kết nối thêm với sheet lịch của nhà trường.
      `);

      return;
    }

    if (lower.startsWith("/diem ")) {
      const maHS =
        text.substring(6).trim();

      addAIMessage(`
        🔍 Đang tra cứu mã học sinh:
        <b>${escapeHtml(maHS)}</b>.<br>
        Tính năng điểm chi tiết cần được kết nối với sheet điểm tương ứng.
      `);

      return;
    }

    /* ================= TEACH ================= */

    if (lower.startsWith("/day ")) {

      if (!currentUser) {
        addAIMessage(
          "⚠️ Bạn cần <b>đăng nhập</b> để dạy KienoraAI."
        );
        return;
      }

      const content =
        text.substring(5).trim();

      const parts =
        content.split("|").map(x => x.trim());

      if (parts.length < 2) {

        addAIMessage(`
          ⚠️ Sai cú pháp.<br>
          Dùng:<br>
          <code>/day câu hỏi | câu trả lời</code><br>
          hoặc<br>
          <code>/day câu hỏi | câu trả lời | TenFile.pdf | https://link</code>
        `);

        return;
      }

      const item = {
        q: parts[0],
        a: parts[1],
        fileName: parts[2] || "",
        fileUrl: parts[3] || ""
      };

      if (
        item.fileUrl &&
        !isValidHttpUrl(item.fileUrl)
      ) {
        addAIMessage(
          "⚠️ Link tài liệu phải bắt đầu bằng http:// hoặc https://."
        );
        return;
      }

      const result =
        await postApi({
          action: "teach_with_file",
          username: currentUser,
          q: item.q,
          a: item.a,
          fileName: item.fileName,
          fileUrl: item.fileUrl
        });

      if (result.status !== "success") {
        addAIMessage(
          "❌ " +
          escapeHtml(
            result.message ||
            "Không thể lưu tri thức."
          )
        );
        return;
      }

      if (currentRole === "admin") {
        await loadCloudData(false);
      } else {
        personalSheetData.push(item);
      }

      addAIMessage(
        "✅ <b>" +
        escapeHtml(result.message) +
        "</b>"
      );

      return;
    }

    /* ================= ADMIN COMMANDS ================= */

    const adminPrefix =
      [
        "/ds_tt",
        "/duyet_tt",
        "/xoa_tt",
        "/ds_tk",
        "/duyet_tk",
        "/khoa_tk",
        "/xoa_tk",
        "/backup",
        "/logs",
        "/duyet",
        "/pending",
        "/accept",
        "/reject",
        "/users"
      ].some(cmd => lower === cmd || lower.startsWith(cmd + " "));

    if (adminPrefix) {

      if (
        !currentUser ||
        currentRole !== "admin"
      ) {
        addAIMessage(
          "⛔ Lệnh này yêu cầu quyền <b>Quản trị viên</b>."
        );
        return;
      }

      const result =
        await postApi({
          action: "admin_cmd",
          username: currentUser,
          command: text
        });

      addAIMessage(
        result.status === "success"
          ? escapeHtml(result.message || "").replace(/\n/g, "<br>")
          : "⚠️ " +
            escapeHtml(result.message || "Lệnh không thực hiện được.")
      );

      return;
    }

    if (lower === "/xoatoanbo") {

      if (
        !currentUser ||
        currentRole !== "admin"
      ) {
        addAIMessage(
          "⛔ Chỉ Quản trị viên mới có quyền xóa kho chung."
        );
        return;
      }

      if (
        !confirm(
          "Bạn chắc chắn muốn xóa TOÀN BỘ kho tri thức chung?"
        )
      ) {
        addAIMessage(
          "ℹ️ Đã hủy thao tác."
        );
        return;
      }

      const result =
        await postApi({
          action: "sync_shared",
          username: currentUser,
          data: []
        });

      if (result.status === "success") {
        setSharedData([]);
        renderQAListInModal();

        addAIMessage(
          "🗑️ <b>Đã xóa toàn bộ kho tri thức chung.</b>"
        );
      } else {
        addAIMessage(
          "❌ " +
          escapeHtml(result.message || "")
        );
      }

      return;
    }

    if (lower.startsWith("/xoa ")) {

      if (
        !currentUser ||
        currentRole !== "admin"
      ) {
        addAIMessage(
          "⛔ Chỉ Quản trị viên mới có quyền xóa kho chung."
        );
        return;
      }

      const keyword =
        text.substring(5).trim().toLowerCase();

      if (!keyword) {
        addAIMessage(
          "⚠️ Hãy nhập từ khóa cần xóa."
        );
        return;
      }

      const data =
        getLearnedQA();

      const filtered =
        data.filter(item => {
          const q =
            normalizeItem(item).q.toLowerCase();

          const a =
            normalizeItem(item).a.toLowerCase();

          return (
            !q.includes(keyword) &&
            !a.includes(keyword)
          );
        });

      const deleted =
        data.length - filtered.length;

      if (!deleted) {
        addAIMessage(
          "🔍 Không tìm thấy mục chứa <b>" +
          escapeHtml(keyword) +
          "</b>."
        );
        return;
      }

      const result =
        await postApi({
          action: "sync_shared",
          username: currentUser,
          data: filtered
        });

      if (result.status === "success") {
        setSharedData(filtered);
        renderQAListInModal();

        addAIMessage(
          "🗑️ Đã xóa <b>" +
          deleted +
          "</b> mục."
        );
      } else {
        addAIMessage(
          "❌ " +
          escapeHtml(result.message || "")
        );
      }

      return;
    }

    if (lower.startsWith("/tim ")) {

      const keyword =
        text.substring(5).trim();

      if (!keyword) {
        addAIMessage(
          "⚠️ Hãy nhập từ khóa cần tìm."
        );
        return;
      }

      const result =
        await postApi({
          action: "search",
          keyword: keyword
        });

      if (
        result.status !== "success" ||
        !result.data?.length
      ) {
        addAIMessage(
          "🔍 Không tìm thấy tri thức phù hợp."
        );
        return;
      }

      let html =
        `🔍 <b>Tìm thấy ${result.data.length} kết quả:</b>
         <div class="mt-2 space-y-2 max-h-64 overflow-y-auto">`;

      result.data.slice(0, 10).forEach((raw, index) => {

        const item =
          normalizeItem(raw);

        html += `
          <div class="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">

            <p class="font-bold text-indigo-700">
              ${index + 1}. ${escapeHtml(item.q)}
            </p>

            <p class="text-slate-600 mt-1">
              ${escapeHtml(item.a)}
            </p>

            ${
              item.fileName && item.fileUrl
                ? `
                  <a href="${safeUrl(item.fileUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-indigo-600 font-bold mt-1">
                    <i class="fa-solid fa-download"></i>
                    ${escapeHtml(item.fileName)}
                  </a>
                `
                : ""
            }

          </div>
        `;
      });

      html += "</div>";

      addAIMessage(html);
      return;
    }

    /* ================= NORMAL QUESTION ================= */

    const loadingId =
      addLoadingMessage();

    try {

      /*
       * ĐÂY LÀ ĐIỂM QUAN TRỌNG NHẤT:
       * Mọi câu hỏi không phải lệnh đều gửi action "ask"
       * lên Google Apps Script.
       */

      const result =
        await postApi({
          action: "ask",
          username: currentUser || "",
          question: text
        });

      document.getElementById(
        loadingId
      )?.remove();

      if (result.status === "success" && result.data) {

        addAIMessage(
          buildKnowledgeAnswer(result)
        );

      } else {

        if (
          Array.isArray(result.suggestions) &&
          result.suggestions.length
        ) {

          let html = `
            🔍 KienoraAI chưa tìm thấy câu trả lời chính xác.
            Có thể bạn đang muốn hỏi:
            <div class="mt-2 space-y-1.5">
          `;

          result.suggestions
            .slice(0, 5)
            .forEach(item => {

              const x =
                normalizeItem(item);

              html += `
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-2">
                  <b class="text-indigo-700">
                    ${escapeHtml(x.q)}
                  </b>
                </div>
              `;
            });

          html += "</div>";

          addAIMessage(html);

        } else {

          addAIMessage(
            "🤔 KienoraAI chưa tìm thấy tri thức phù hợp.<br>" +
            "Câu hỏi đã được ghi nhận để quản trị viên bổ sung."
          );
        }

        postApi({
          action: "log_missing",
          username: currentUser || "guest",
          missingQuery: text
        }).catch(() => {});
      }

    } catch (error) {

      document.getElementById(
        loadingId
      )?.remove();

      addAIMessage(
        "❌ Không thể kết nối Google Apps Script. " +
        "Vui lòng kiểm tra URL API và quyền triển khai Web App."
      );
    }

  } catch (error) {

    addAIMessage(
      "❌ KienoraAI gặp lỗi: " +
      escapeHtml(error.message || "Không xác định.")
    );

  } finally {

    sendBtn.disabled = false;
    input.focus();
  }
}

/* ================= KNOWLEDGE MANAGER ================= */

async function addNewQAWithFile() {
  const q =
    document.getElementById("newQ").value.trim();

  const a =
    document.getElementById("newA").value.trim();

  const fileName =
    document.getElementById("newFileName").value.trim();

  const fileUrl =
    document.getElementById("newFileUrl").value.trim();

  const btn =
    document.getElementById("saveKnowledgeBtn");

  if (!q || !a) {
    alert(
      "Vui lòng nhập Câu hỏi và Câu trả lời."
    );
    return;
  }

  if (
    fileUrl &&
    !isValidHttpUrl(fileUrl)
  ) {
    alert(
      "Link tài liệu không hợp lệ."
    );
    return;
  }

  if (!currentUser) {
    alert(
      "Bạn cần đăng nhập để lưu tri thức."
    );
    return;
  }

  btn.disabled = true;

  try {

    const result =
      await postApi({
        action: "teach_with_file",
        username: currentUser,
        q,
        a,
        fileName,
        fileUrl
      });

    if (result.status !== "success") {
      throw new Error(
        result.message ||
        "Không thể lưu tri thức."
      );
    }

    clearKnowledgeForm();

    await loadCloudData(false);

    alert(
      "✅ " +
      result.message
    );

    renderQAListInModal();

  } catch (error) {

    alert(
      "❌ " +
      (error.message ||
       "Không thể lưu tri thức.")
    );

  } finally {

    btn.disabled = false;
  }
}

function clearKnowledgeForm() {
  document.getElementById("newQ").value = "";
  document.getElementById("newA").value = "";
  document.getElementById("newFileName").value = "";
  document.getElementById("newFileUrl").value = "";
}

function openQAManager() {
  const modal =
    document.getElementById("qaManagerModal");

  const title =
    document.getElementById("qaModalTitleText");

  const subtitle =
    document.getElementById("qaModalSubtitle");

  const importLabel =
    document.getElementById("importJsonLabel");

  const saveBtn =
    document.getElementById("saveKnowledgeBtn");

  if (currentRole === "admin") {

    title.innerText =
      "Kho tri thức chung KienoraAI";

    subtitle.innerText =
      "Admin có toàn quyền thêm, xóa, nhập và xuất JSON.";

    importLabel.classList.remove("hidden");

    saveBtn.innerHTML =
      '<i class="fa-solid fa-file-arrow-down mr-1"></i> Lưu vào kho chung';

  } else if (currentUser) {

    title.innerText =
      "Kho tri thức cá nhân KienoraAI";

    subtitle.innerText =
      "Tri thức của tài khoản hiện tại.";

    importLabel.classList.add("hidden");

    saveBtn.innerHTML =
      '<i class="fa-solid fa-file-arrow-down mr-1"></i> Lưu vào kho cá nhân';

  } else {

    title.innerText =
      "Kho tri thức KienoraAI";

    subtitle.innerText =
      "Đăng nhập để thêm tri thức.";

    importLabel.classList.add("hidden");

    saveBtn.innerHTML =
      '<i class="fa-solid fa-file-arrow-down mr-1"></i> Lưu tri thức';
  }

  modal.classList.remove("hidden");

  renderQAListInModal();
}

function closeQAManager() {
  document.getElementById(
    "qaManagerModal"
  ).classList.add("hidden");
}

function renderQAListInModal() {
  const container =
    document.getElementById("qaTableList");

  const data =
    currentRole === "admin"
      ? getLearnedQA()
      : personalSheetData;

  if (!data.length) {

    container.innerHTML = `
      <div class="text-slate-400 text-center py-5 italic text-xs">
        Chưa có dữ liệu nào.
      </div>
    `;

    return;
  }

  let html = "";

  data.forEach((rawItem, index) => {

    const item =
      normalizeItem(rawItem);

    const url =
      safeUrl(item.fileUrl);

    html += `
      <div class="bg-white border border-slate-200 rounded-xl p-3 text-xs shadow-sm">

        <div class="flex justify-between items-start gap-3">

          <div class="space-y-1.5 min-w-0 flex-1">

            <p class="font-bold text-indigo-700 break-words">
              <i class="fa-solid fa-circle-question mr-1"></i>
              ${escapeHtml(item.q)}
            </p>

            <p class="text-slate-600 break-words whitespace-pre-wrap">
              <i class="fa-solid fa-comment-dots mr-1 text-emerald-600"></i>
              ${escapeHtml(item.a)}
            </p>

            ${
              item.fileName
                ? `
                  <p class="text-[10px] text-sky-600 font-semibold">
                    <i class="fa-solid fa-paperclip mr-1"></i>
                    ${escapeHtml(item.fileName)}
                  </p>
                `
                : ""
            }

            ${
              url
                ? `
                  <a href="${url}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-[10px] text-indigo-600 font-bold hover:underline">
                    <i class="fa-solid fa-download"></i>
                    Mở / tải tài liệu
                  </a>
                `
                : ""
            }

          </div>

          <button onclick="deleteQAItem(${index})"
            class="text-rose-500 hover:text-rose-700 p-2 transition shrink-0"
            title="Xóa mục này">

            <i class="fa-solid fa-trash-can"></i>
          </button>

        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

async function deleteQAItem(index) {
  if (
    !confirm(
      "Bạn có chắc muốn xóa mục tri thức này?"
    )
  ) {
    return;
  }

  try {

    if (currentRole === "admin") {

      const data =
        getLearnedQA();

      data.splice(index, 1);

      const result =
        await postApi({
          action: "sync_shared",
          username: currentUser,
          data
        });

      if (result.status !== "success") {
        throw new Error(
          result.message ||
          "Không thể xóa."
        );
      }

      setSharedData(data);

      alert(
        "🗑️ Đã xóa khỏi kho tri thức chung."
      );

    } else {

      if (!currentUser) {
        alert("Bạn chưa đăng nhập.");
        return;
      }

      const result =
        await postApi({
          action: "delete_personal",
          username: currentUser,
          index
        });

      if (result.status !== "success") {
        throw new Error(
          result.message ||
          "Không thể xóa."
        );
      }

      personalSheetData =
        normalizeList(result.data);

      alert(
        "🗑️ Đã xóa khỏi kho cá nhân."
      );
    }

    renderQAListInModal();

  } catch (error) {

    alert(
      "❌ " +
      (error.message ||
       "Không thể xóa dữ liệu.")
    );
  }
}

/* ================= JSON BACKUP ================= */

function exportJsonFile() {
  const data =
    currentRole === "admin"
      ? getLearnedQA()
      : personalSheetData;

  const payload = {
    app: "KienoraAI",
    version: 1,
    exportedAt: new Date().toISOString(),
    type:
      currentRole === "admin"
        ? "shared"
        : "personal",
    total: data.length,
    columns: [
      "Q",
      "A",
      "FileName",
      "FileUrl"
    ],
    data: normalizeList(data)
  };

  const blob =
    new Blob(
      [JSON.stringify(payload, null, 2)],
      {
        type: "application/json;charset=utf-8"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    currentRole === "admin"
      ? "kienoraai_kho_tri_thuc_chung_backup.json"
      : "kienoraai_kho_tri_thuc_ca_nhan_backup.json";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  alert(
    "💾 Đã xuất bản sao JSON gồm " +
    data.length +
    " mục."
  );
}

function extractImportData(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (
    parsed &&
    Array.isArray(parsed.data)
  ) {
    return parsed.data;
  }

  if (
    parsed &&
    Array.isArray(parsed.items)
  ) {
    return parsed.items;
  }

  return null;
}

function importJsonFile(event) {
  if (currentRole !== "admin") {

    alert(
      "⛔ Chỉ Quản trị viên mới được nhập JSON vào kho chung."
    );

    event.target.value = "";
    return;
  }

  const file =
    event.target.files?.[0];

  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = async function(e) {

    try {

      const parsed =
        JSON.parse(e.target.result);

      const rawData =
        extractImportData(parsed);

      if (!rawData) {
        throw new Error(
          "INVALID_FORMAT"
        );
      }

      const normalized =
        normalizeList(rawData);

      if (!normalized.length) {
        throw new Error(
          "EMPTY_DATA"
        );
      }

      const invalid =
        normalized.some(
          item => !item.q || !item.a
        );

      if (invalid) {
        throw new Error(
          "INVALID_ITEM"
        );
      }

      const confirmed =
        confirm(
          "File có " +
          normalized.length +
          " mục tri thức.\n\n" +
          "Nếu tiếp tục, kho tri thức chung hiện tại " +
          "sẽ được thay bằng dữ liệu trong file.\n\n" +
          "Bạn có chắc chắn muốn phục hồi?"
        );

      if (!confirmed) {
        return;
      }

      const result =
        await postApi({
          action: "sync_shared",
          username: currentUser,
          data: normalized
        });

      if (result.status !== "success") {
        throw new Error(
          result.message ||
          "Google Sheets từ chối phục hồi."
        );
      }

      setSharedData(normalized);

      renderQAListInModal();

      alert(
        "📥 Phục hồi JSON thành công: " +
        normalized.length +
        " mục."
      );

    } catch (error) {

      alert(
        "❌ Không thể nhập JSON.\n" +
        "Hãy kiểm tra cấu trúc file và quyền Admin."
      );

    } finally {

      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

/* ================= START ================= */

window.addEventListener("load", async function() {
  updateAuthUI();
  await loadCloudData(false);
});
</script>
