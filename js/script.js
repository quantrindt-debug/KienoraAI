if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(reg => console.log("KienoraAI Service Worker:", reg.scope))
      .catch(err => console.error("Service Worker lỗi:", err));
  });
}
const API_URL = "https://script.google.com/macros/s/AKfycby8GRv6ew_QapByIvYL3RS3dqhwsuUKU3XykLmJE8vyWoDZeGmEqAn40-I2fQHQk918/exec"; 
    
    let currentUser = localStorage.getItem('kienora_current_user') || null;
    let currentRole = localStorage.getItem('kienora_current_role') || null;
    let sharedSheetData = [];
    let personalSheetData = [];

    async function loadCloudData() {
      try {
        let url = API_URL + "?action=get_data";
        if (currentUser) {
          url += "&username=" + encodeURIComponent(currentUser);
        }
        let response = await fetch(url);
        let data = await response.json();
        
        if (data.sheet1) {
          sharedSheetData = data.sheet1;
          localStorage.setItem('kienora_learned_qa', JSON.stringify(data.sheet1));
        }
        if (data.personal) {
          personalSheetData = data.personal;
        }
      } catch (e) {
        sharedSheetData = JSON.parse(localStorage.getItem('kienora_learned_qa')) || [];
      }
    }

    window.onload = function() {
      updateAuthUI();
      loadCloudData();
    };

    function updateAuthUI() {
      const dot = document.getElementById('authStatusDot');
      const text = document.getElementById('authUsernameText');
      const buttons = document.getElementById('authButtons');

      if (currentUser) {
        dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse";
        text.innerText = currentUser + (currentRole === 'admin' ? ' (Quản trị)' : ' (Cá nhân)');
        buttons.innerHTML = `<button onclick="logout()" class="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-xl font-bold transition">Đăng xuất</button>`;
      } else {
        dot.className = "w-2.5 h-2.5 rounded-full bg-slate-400";
        text.innerText = "Khách (Chưa đăng nhập)";
        buttons.innerHTML = `
          <button onclick="openAuthModal('login')" class="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-xl font-bold transition shadow-sm">Đăng nhập</button>
          <button onclick="openAuthModal('register')" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-xl font-bold transition">Đăng ký</button>
        `;
      }
    }

    let authMode = 'login';
    function openAuthModal(mode) {
      authMode = mode;
      document.getElementById('authModal').classList.remove('hidden');
      document.getElementById('modalUsername').value = '';
      document.getElementById('modalPassword').value = '';
      
      const title = document.getElementById('authModalTitle');
      const btn = document.getElementById('authSubmitBtn');
      const extra = document.getElementById('registerExtraField');

      if (mode === 'register') {
        title.innerText = "Đăng ký tài khoản mới";
        btn.innerText = "Gửi yêu cầu đăng ký";
        extra.classList.remove('hidden');
      } else {
        title.innerText = "Đăng nhập hệ thống";
        btn.innerText = "Đăng nhập";
        extra.classList.add('hidden');
      }
    }

    function closeAuthModal() {
      document.getElementById('authModal').classList.add('hidden');
    }

    async function submitAuthForm() {
      const username = document.getElementById('modalUsername').value.trim();
      const password = document.getElementById('modalPassword').value.trim();
      const email = document.getElementById('modalEmail').value.trim();

      if (!username || !password) {
        alert('Vui lòng điền đầy đủ tên đăng nhập và mật khẩu!');
        return;
      }

      if (authMode === 'register') {
        try {
          let res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "register", username, password, email })
          });
          let result = await res.json();
          alert(result.message);
          if (result.status === 'success') closeAuthModal();
        } catch (e) {
          alert('Lỗi kết nối máy chủ!');
        }
      } else {
        try {
          let res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "login", username, password })
          });
          let result = await res.json();
          if (result.status === 'success') {
            currentUser = result.username;
            currentRole = result.role;
            localStorage.setItem('kienora_current_user', currentUser);
            localStorage.setItem('kienora_current_role', currentRole);
            updateAuthUI();
            closeAuthModal();
            loadCloudData();
            alert('🎉 Đăng nhập thành công!');
          } else {
            alert(result.message);
          }
        } catch (e) {
          alert('Lỗi kết nối máy chủ!');
        }
      }
    }

    function logout() {
      currentUser = null;
      currentRole = null;
      localStorage.removeItem('kienora_current_user');
      localStorage.removeItem('kienora_current_role');
      personalSheetData = [];
      updateAuthUI();
      loadCloudData();
      alert('Đã đăng xuất tài khoản.');
    }

    function getLearnedQA() {
      return sharedSheetData.length > 0 ? sharedSheetData : (JSON.parse(localStorage.getItem('kienora_learned_qa')) || []);
    }

    async function syncToCloud(newData) {
      if (currentRole !== 'admin') {
        alert('⛔ Bạn không có quyền chỉnh sửa/xóa kho tri thức chung. Chỉ Quản trị viên mới được thực hiện thao tác này!');
        return;
      }
      sharedSheetData = newData;
      localStorage.setItem('kienora_learned_qa', JSON.stringify(newData));
      try {
        await fetch(API_URL, {
          method: "POST",
          body: JSON.stringify({ action: "sync_shared", data: newData })
        });
      } catch (e) {
        console.log("Lỗi đồng bộ đám mây.");
      }
    }

    function toggleCommandBox() {
      const box = document.getElementById('commandBoxContainer');
      const icon = document.getElementById('cmdIcon');
      
      if (box.classList.contains('hidden')) {
        box.classList.remove('hidden');
        setTimeout(() => {
          box.classList.remove('scale-95', 'opacity-0');
          box.classList.add('scale-100', 'opacity-100');
          document.getElementById('cmdInput').focus();
        }, 10);
        icon.classList.remove('fa-wand-magic-sparkles');
        icon.classList.add('fa-xmark');
      } else {
        box.classList.remove('scale-100', 'opacity-100');
        box.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { box.classList.add('hidden'); }, 200);
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-wand-magic-sparkles');
      }
    }

    function handleCmdKeyPress(event) {
      if (event.key === 'Enter') executeUserCommand();
    }

    async function addNewQAWithFile() {
      const q = document.getElementById('newQ').value.trim();
      const a = document.getElementById('newA').value.trim();
      const fileName = document.getElementById('newFileName').value.trim();
      const fileUrl = document.getElementById('newFileUrl').value.trim();

      if (!q || !a) {
        alert('Vui lòng nhập tối thiểu Câu hỏi và Câu trả lời!');
        return;
      }

      if (currentRole === 'admin') {
        let qaData = getLearnedQA();
        qaData.push({ q: q.toLowerCase(), a, fileName, fileUrl });
        await syncToCloudWithFile(qaData, { q: q.toLowerCase(), a, fileName, fileUrl });
        alert('✅ Admin đã thêm thành công vào kho tri thức chung!');
      } else {
        try {
          let res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "teach", username: currentUser, q: q.toLowerCase(), a, fileName, fileUrl })
          });
          personalSheetData.push({ Q: q.toLowerCase(), A: a, FileName: fileName, FileUrl: fileUrl });
          alert('✅ Đã lưu vào kho tri thức cá nhân và gửi yêu cầu kiểm duyệt!');
        } catch(e) {
          alert('Lỗi kết nối lưu kho cá nhân!');
        }
      }

      document.getElementById('newQ').value = '';
      document.getElementById('newA').value = '';
      document.getElementById('newFileName').value = '';
      document.getElementById('newFileUrl').value = '';
      
      renderQAListInModal();
    }

    async function syncToCloudWithFile(newData, newItem) {
      sharedSheetData = newData;
      localStorage.setItem('kienora_learned_qa', JSON.stringify(newData));
      try {
        await fetch(API_URL, {
          method: "POST",
          body: JSON.stringify({ 
            action: "teach_with_file",
            username: currentUser || "admin",
            q: newItem.q,
            a: newItem.a,
            fileName: newItem.fileName,
            fileUrl: newItem.fileUrl,
            data: newData 
          })
        });
      } catch (e) {
        console.log("Lỗi đồng bộ đám mây tệp đính kèm.");
      }
    }

    function exportJsonFile() {
      const data = JSON.stringify(currentRole === 'admin' ? getLearnedQA() : personalSheetData, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentRole === 'admin' ? 'kienora_kien_thuc_chung.json' : 'kienora_kien_thuc_can_nhan.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function importJsonFile(event) {
      if (currentRole !== 'admin') {
        alert('⛔ Tính năng nhập tệp JSON vào kho chung chỉ dành cho Quản trị viên!');
        return;
      }
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const parsedData = JSON.parse(e.target.result);
          if (Array.isArray(parsedData)) {
            await syncToCloud(parsedData);
            renderQAListInModal();
            alert(`📥 Nhập file thành công! Đã cập nhật ${parsedData.length} mục vào kho chung.`);
          } else {
            alert('⚠️ Cấu trúc tệp JSON không hợp lệ!');
          }
        } catch (err) {
          alert('❌ Lỗi đọc tệp JSON!');
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    }

    // HÀM TÌM KIẾM THÔNG MINH MỚI (Khớp linh hoạt bất kỳ từ nào trong câu)
    function smartMatch(userText, targetQuery) {
      if (!targetQuery) return false;
      let cleanUser = userText.toLowerCase().trim();
      let cleanTarget = targetQuery.toLowerCase().trim();

      // Khớp chính xác tuyệt đối hoặc chứa toàn bộ cụm từ
      if (cleanUser === cleanTarget || cleanTarget.includes(cleanUser) || cleanUser.includes(cleanTarget)) {
        return true;
      }

      // Tách các từ đơn lẻ để dò chéo (giúp tìm thấy dù gõ đảo lộn từ)
      let userWords = cleanUser.split(/\s+/).filter(w => w.length > 1);
      let targetWords = cleanTarget.split(/\s+/).filter(w => w.length > 1);

      if (userWords.length === 0 || targetWords.length === 0) return false;

      let matchedCount = 0;
      for (let uw of userWords) {
        if (targetWords.some(tw => tw.includes(uw) || uw.includes(tw))) {
          matchedCount++;
        }
      }

      // Nếu khớp từ 50% số từ trở lên hoặc từ khóa quan trọng trùng nhau thì nhận diện
      let threshold = Math.ceil(userWords.length * 0.5);
      return matchedCount >= threshold;
    }

    function generateAIResponse(userInput) {
      const text = userInput.trim();
      const lowerText = text.toLowerCase();
      const learnedList = getLearnedQA();

      if (lowerText === '/help' || lowerText === '/giupdo') {
        let helpHTML = `🤖 <b>HƯỚNG DẪN HỆ THỐNG LỆNH KIENORAAI</b><br><br>
        <b>1. Hệ thống & Trợ giúp:</b><br>
        • <code class="text-indigo-600 font-bold">/help</code> - Xem danh sách toàn bộ lệnh.<br>
        • <code class="text-indigo-600 font-bold">/lammoi</code> / <code class="text-indigo-600 font-bold">/sync</code> - Đồng bộ dữ liệu mới nhất từ Google Sheets.<br>
        • <code class="text-indigo-600 font-bold">/thongtin</code> / <code class="text-indigo-600 font-bold">/info</code> - Xem thông tin tài khoản.<br>
        • <code class="text-indigo-600 font-bold">/thongke</code> - Thống kê dữ liệu hệ thống.<br><br>

        <b>2. Quản lý Tri thức:</b><br>
        • <code class="text-indigo-600 font-bold">/quanly</code> / <code class="text-indigo-600 font-bold">/ql</code> - Mở bảng quản lý trực quan.<br>
        • <code class="text-indigo-600 font-bold">/day [hỏi] | [đáp]</code> - Dạy AI kiến thức mới.<br>
        • <code class="text-indigo-600 font-bold">/tim [từ_khóa]</code> - Tìm kiếm nhanh trong kho tri thức.`;

        if (currentRole === 'admin') {
          helpHTML += `<br>
          • <code class="text-indigo-600 font-bold">/xoa [cụm_từ]</code> - Xóa mục chung (Chỉ Admin).<br>
          • <code class="text-indigo-600 font-bold">/xoatoanbo</code> - Xóa sạch kho chung (Chỉ Admin).`;
        }

        helpHTML += `<br><br><b>3. Tra cứu & Tiện ích Học sinh:</b><br>
        • <code class="text-indigo-600 font-bold">/diem [mã_hs]</code> - Tra cứu hồ sơ/điểm số học sinh.<br>
        • <code class="text-indigo-600 font-bold">/lich</code> / <code class="text-indigo-600 font-bold">/thoikhoabieu</code> - Xem lịch công tác, thời khóa biểu.<br>
        • <code class="text-indigo-600 font-bold">/thongbao</code> - Xem thông báo mới từ nhà trường.`;

        if (currentUser && currentRole === 'admin') {
          helpHTML += `<br><br><b>🛡️ 4. Nhóm lệnh Quản trị (Admin):</b><br>
          • <code class="text-rose-600 font-bold">/ds_tk</code> - Xem danh sách tài khoản người dùng.<br>
          • <code class="text-rose-600 font-bold">/duyet_tk [user]</code> - Duyệt tài khoản người dùng.<br>
          • <code class="text-rose-600 font-bold">/khoa_tk [user]</code> - Khóa / xóa tài khoản người dùng.<br>
          • <code class="text-rose-600 font-bold">/ds_tt</code> - Xem danh sách tri thức chờ duyệt.<br>
          • <code class="text-rose-600 font-bold">/duyet_tt [dòng]</code> - Phê duyệt tri thức theo dòng.<br>
          • <code class="text-rose-600 font-bold">/xoa_tt [dòng]</code> - Xóa / từ chối tri thức theo dòng.<br>
          • <code class="text-rose-600 font-bold">/backup</code> - Sao lưu toàn bộ hệ thống.<br>
          • <code class="text-rose-600 font-bold">/logs</code> - Xem nhật ký hoạt động hệ thống.`;
        }
        return helpHTML;
      }

      if (lowerText === '/xinchao' || lowerText === 'hi' || lowerText === 'hello') {
        return `👋 Xin chào! Tôi là trợ lý ảo KienoraAI chuyên hỗ trợ quản lý hồ sơ học sinh và tra cứu thông tin. Bạn cần tôi giúp gì hôm nay? Hãy gõ <code class="text-indigo-600 font-bold">/help</code> để xem danh sách lệnh nhé!`;
      }

      if (lowerText === '/thongtin' || lowerText === '/info') {
        let userDisplay = currentUser ? `<b>${currentUser}</b> (${currentRole === 'admin' ? 'Quản trị viên' : 'Cá nhân'})` : 'Chưa đăng nhập (Khách)';
        return `ℹ️ <b>Thông tin hệ thống KienoraAI:</b><br>
        • Tài khoản: ${userDisplay}<br>
        • Kho tri thức chung: ${learnedList.length} mục<br>
        • Kho cá nhân của bạn: ${personalSheetData.length} mục<br>
        • Trạng thái kết nối: 🟢 Trực tuyến`;
      }

      if (lowerText === '/thongke') {
        return `📊 <b>Thống kê dữ liệu hệ thống:</b><br>
        • Tổng số tri thức chung: <b>${learnedList.length}</b> câu hỏi/đáp án.<br>
        • Tổng số tri thức cá nhân của bạn: <b>${personalSheetData.length}</b> mục.<br>
        • Hệ thống hoạt động ổn định và đồng bộ thời gian thực với Google Sheets.`;
      }

      if (lowerText === '/lammoi' || lowerText === '/sync') {
        loadCloudData();
        return `🔄 <b>Đã đồng bộ lại dữ liệu mới nhất từ Google Sheets!</b>`;
      }

      if (lowerText === '/quanly' || lowerText === '/ql') {
        openQAManager();
        return `🗂️ <b>Đã mở bảng quản lý trực quan!</b>`;
      }

      if (lowerText === '/xoatoanbo') {
        if (currentRole !== 'admin') {
          return `⛔ <b>Từ chối truy cập:</b> Bạn không có quyền xóa kho tri thức chung. Thao tác này chỉ dành cho <b>Quản trị viên (Admin)</b>.`;
        }
        syncToCloud([]);
        return `🗑️ <b>Đã xóa sạch toàn bộ kho tri thức chung!</b>`;
      }

      if (lowerText.startsWith('/xoa ')) {
        if (currentRole !== 'admin') {
          return `⛔ <b>Từ chối truy cập:</b> Bạn không có quyền xóa dữ liệu trên kho tri thức chung. Chỉ <b>Quản trị viên (Admin)</b> mới được thực hiện.`;
        }
        const keyword = text.substring(5).trim().toLowerCase();
        if (!keyword) return `⚠️ Vui lòng nhập cụm từ cần xóa (VD: <code class="text-indigo-600">/xoa [từ]</code>)`;
        
        let beforeCount = learnedList.length;
        let filteredList = learnedList.filter(item => {
          let qVal = item.q || item.Q || "";
          let aVal = item.a || item.A || "";
          return !qVal.toLowerCase().includes(keyword) && !aVal.toLowerCase().includes(keyword);
        });
        let deletedCount = beforeCount - filteredList.length;

        if (deletedCount === 0) return `🔍 Không tìm thấy mục nào chứa "<b>${escapeHtml(keyword)}</b>".`;
        syncToCloud(filteredList);
        return `🗑️ <b>Đã xóa thành công ${deletedCount} mục chung</b> chứa từ "<b>${escapeHtml(keyword)}</b>"!`;
      }

      if (lowerText.startsWith('/tim ')) {
        const keyword = text.substring(5).trim().toLowerCase();
        if (!keyword) return `⚠️ Vui lòng nhập từ khóa cần tìm!`;
        
        let results = learnedList.filter(item => {
          let qVal = item.q || item.Q || "";
          let aVal = item.a || item.A || "";
          return qVal.toLowerCase().includes(keyword) || aVal.toLowerCase().includes(keyword);
        });
        if (results.length === 0) return `🔍 Không tìm thấy kết quả cho "<b>${escapeHtml(keyword)}</b>".`;

        let resHtml = `🔍 <b>Tìm thấy ${results.length} kết quả:</b><div class="mt-2 space-y-1.5 max-h-48 overflow-y-auto">`;
        results.forEach((item, idx) => {
          let qVal = item.q || item.Q || "";
          let aVal = item.a || item.A || "";
          resHtml += `
            <div class="bg-indigo-50 p-2 rounded-xl text-xs space-y-0.5 border border-indigo-100">
              <p class="font-bold text-indigo-700">${idx + 1}. Q: ${escapeHtml(qVal)}</p>
              <p class="text-slate-600">A: ${escapeHtml(aVal)}</p>
            </div>
          `;
        });
        resHtml += `</div>`;
        return resHtml;
      }

      if (lowerText.startsWith('/day ')) {
        if (!currentUser) {
          return `⚠️ Bạn cần <b class="text-rose-600">đăng nhập</b> tài khoản mới có quyền dạy AI!`;
        }

        let content = text.substring(5).trim();
        const parts = content.split('|');
        if (parts.length === 2) {
          const q = parts[0].trim().toLowerCase();
          const a = parts[1].trim();

          fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "teach", username: currentUser, q, a })
          });

          personalSheetData.push({ Q: q, A: a, FileName: "", FileUrl: "" });
          return `✅ <b>Đã học thành công!</b> Đã lưu vào kho riêng của bạn và gửi yêu cầu kiểm duyệt lên hệ thống chính.`;
        } else {
          return `⚠️ Sai cú pháp! Dùng: <code class="text-indigo-600">/day câu hỏi | câu trả lời</code>`;
        }
      }

      if (lowerText === '/thongbao') {
        return `📢 <b>Thông báo mới từ nhà trường:</b><br>
        1. Triển khai cập nhật hồ sơ học sinh khối 10 năm học mới.<br>
        2. Giáo viên chủ nhiệm kiểm tra lại danh sách học sinh trên hệ thống KienoraAI.<br>
        3. Sử dụng lệnh <code class="text-indigo-600">/day</code> để cập nhật thêm kiến thức mới.`;
      }

      if (lowerText === '/lich' || lowerText === '/thoikhoabieu') {
        return `📅 <b>Lịch công tác / Thời khóa biểu:</b><br>
        • Sáng thứ Hai: Chào cờ đầu tuần và họp hội đồng giáo viên.<br>
        • Từ thứ Hai đến thứ Sáu: Cập nhật dữ liệu học sinh, xử lý hồ sơ đăng ký.`;
      }

      if (lowerText.startsWith('/diem ')) {
        const maHS = text.substring(6).trim();
        if (!maHS) return `⚠️ Vui lòng nhập mã học sinh (VD: <code class="text-indigo-600">/diem HS123</code>)`;
        return `🔍 Đang tra cứu thông tin hồ sơ/điểm số cho mã học sinh: <b>${escapeHtml(maHS)}</b>.<br><i>(Tính năng kết nối bảng điểm chi tiết đang được đồng bộ).</i>`;
      }

      const adminCommands = ['/duyet', '/pending', '/accept', '/reject', '/users', '/backup', '/logs'];
      if (adminCommands.some(cmd => lowerText.startsWith(cmd))) {
        if (!currentUser || currentRole !== 'admin') {
          return `⛔ <b>Từ chối truy cập:</b> Lệnh này yêu cầu quyền <b>Quản trị viên (Admin)</b>.`;
        }
        if (lowerText === '/duyet' || lowerText === '/pending') return "ADMIN_CMD_FORWARD";
        if (lowerText.startsWith('/accept ')) return `✅ Đã phê duyệt thành công mục vào kho tri thức chung!`;
        if (lowerText.startsWith('/reject ')) return `❌ Đã từ chối và loại bỏ mục khỏi danh sách chờ.`;
        if (lowerText === '/users') return `👥 <b>Danh sách phân quyền hệ thống KienoraAI:</b><br>• Quản trị viên & Người dùng cá nhân.`;
        if (lowerText === '/backup') return `💾 <b>Đang tạo gói sao lưu hệ thống chung...</b>`;
        if (lowerText === '/logs') return `📜 <b>Nhật ký hoạt động hệ thống gần nhất.</b>`;
      }

      // TRỢ LÝ TRA CỨU KÉP VỚI THUẬT TOÁN SMARTMATCH MỚI
      if (currentUser && personalSheetData.length > 0) {
        let foundPersonal = personalSheetData.find(item => {
          let qVal = item.q || item.Q || "";
          return smartMatch(lowerText, qVal);
        });
        if (foundPersonal) {
          let aVal = foundPersonal.a || foundPersonal.A || "";
          return `<div class="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-bold mb-1 inline-block">🔒 Kho tri thức cá nhân của bạn</div><p>${escapeHtml(aVal)}</p>`;
        }
      }

      let foundShared = learnedList.find(item => {
        let qVal = item.q || item.Q || "";
        return smartMatch(lowerText, qVal);
      });

      if (foundShared) {
        let aVal = foundShared.a || foundShared.A || "";
        let fileUrl = foundShared.fileUrl || foundShared.FileUrl || "";
        let fileName = foundShared.fileName || foundShared.FileName || "";

        let responseHTML = `<div class="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold mb-1 inline-block">🌐 Kho tri thức chung</div><p>${escapeHtml(aVal)}</p>`;
        if (fileUrl && fileName) {
          responseHTML += `
            <div class="mt-3 bg-white border border-indigo-100 rounded-2xl p-3 flex items-center justify-between shadow-sm">
              <div class="flex items-center gap-2.5 overflow-hidden">
                <div class="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <i class="fa-solid fa-file-lines"></i>
                </div>
                <div class="truncate">
                  <p class="font-bold text-xs text-slate-800 truncate">${escapeHtml(fileName)}</p>
                  <p class="text-[10px] text-slate-400">Tài liệu đính kèm</p>
                </div>
              </div>
              <a href="${fileUrl}" target="_blank" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0">
                <i class="fa-solid fa-download"></i> Tải về
              </a>
            </div>
          `;
        }
        return responseHTML;
      }

      fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "log_missing", missingQuery: text })
      });

      return `Hmm, hệ thống chưa có dữ liệu về vấn đề này. Câu hỏi của bạn đã được ghi lại để Quản trị viên tham khảo bổ sung! Gõ lệnh <code class="text-indigo-600">/lammoi</code> để cập nhật dữ liệu mới nhất hoặc gõ <code class="text-indigo-600">/help</code> để xem hướng dẫn.`;
    }

    async function executeUserCommand() {
      const input = document.getElementById('cmdInput');
      const msgContainer = document.getElementById('cmdMessages');
      const text = input.value.trim();

      if (!text) return;

      msgContainer.insertAdjacentHTML('beforeend', `
        <div class="flex items-start justify-end gap-2">
          <div class="bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-sm shadow-sm max-w-[85%] text-xs">
            ${escapeHtml(text)}
          </div>
          <div class="w-7 h-7 bg-slate-300 text-slate-700 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold">Bạn</div>
        </div>
      `);
      
      input.value = '';
      msgContainer.scrollTop = msgContainer.scrollHeight;

      const lowerText = text.toLowerCase();
      if (
        lowerText.startsWith("/duyet") || 
        lowerText.startsWith("/pending") || 
        lowerText.startsWith("/ds_tt") || 
        lowerText.startsWith("/duyet_tt") || 
        lowerText.startsWith("/xoa_tt") || 
        lowerText.startsWith("/ds_tk") ||
        lowerText.startsWith("/khoa_tk") ||
        lowerText.startsWith("/logs") ||
        lowerText.startsWith("/users")
      ) {
        const loadId = "load_" + Date.now();
        msgContainer.insertAdjacentHTML('beforeend', `
          <div id="${loadId}" class="flex items-start gap-2">
            <div class="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold">AI</div>
            <div class="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 text-slate-400 text-xs italic">
              Đang kết nối Google Sheets...
            </div>
          </div>
        `);
        msgContainer.scrollTop = msgContainer.scrollHeight;

        try {
          let res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ 
              action: "admin_cmd", 
              username: currentUser, 
              command: text 
            })
          });
          let result = await res.json();
          document.getElementById(loadId)?.remove();

          let replyMessage = (result.status === "success") ? result.message.replace(/\n/g, '<br>') : ("⚠️ " + result.message);
          
          msgContainer.insertAdjacentHTML('beforeend', `
            <div class="flex items-start gap-2">
              <div class="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold">AI</div>
              <div class="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 max-w-[85%] leading-relaxed text-xs">
                ${replyMessage}
              </div>
            </div>
          `);
        } catch (e) {
          document.getElementById(loadId)?.remove();
          msgContainer.insertAdjacentHTML('beforeend', `
            <div class="flex items-start gap-2">
              <div class="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold">AI</div>
              <div class="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 max-w-[85%] leading-relaxed text-xs text-rose-600">
                ❌ Lỗi kết nối tới máy chủ Google Apps Script!
              </div>
            </div>
          `);
        }
        msgContainer.scrollTop = msgContainer.scrollHeight;
        return;
      }

      setTimeout(() => {
        const botReply = generateAIResponse(text);
        msgContainer.insertAdjacentHTML('beforeend', `
          <div class="flex items-start gap-2">
            <div class="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold">AI</div>
            <div class="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 max-w-[85%] leading-relaxed text-xs">
              ${botReply}
            </div>
          </div>
        `);
        msgContainer.scrollTop = msgContainer.scrollHeight;
      }, 300);
    }

    function escapeHtml(string) {
      return String(string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function openQAManager() {
      const modal = document.getElementById('qaManagerModal');
      const modalTitle = document.getElementById('qaModalTitleText');
      
      if (currentRole === 'admin') {
        if (modalTitle) modalTitle.innerText = "Quản lý kho tri thức chung (Toàn quyền Admin)";
      } else {
        if (modalTitle) modalTitle.innerText = "Quản lý kho tri thức cá nhân của bạn";
      }

      modal.classList.remove('hidden');
      renderQAListInModal();
    }

    function closeQAManager() {
      document.getElementById('qaManagerModal').classList.add('hidden');
    }

    function renderQAListInModal() {
      const container = document.getElementById('qaTableList');
      let qaData = (currentRole === 'admin') ? getLearnedQA() : personalSheetData;

      if (!qaData || qaData.length === 0) {
        container.innerHTML = `<div class="text-slate-400 text-center py-4 italic text-xs">Chưa có dữ liệu nào...</div>`;
        return;
      }

      let html = '';
      qaData.forEach((item, index) => {
        let qVal = item.q || item.Q || "";
        let aVal = item.a || item.A || "";
        let fileName = item.fileName || item.FileName || "";

        html += `
          <div class="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center text-xs shadow-sm">
            <div class="space-y-1 max-w-[80%]">
              <p class="font-bold text-indigo-700"><i class="fa-solid fa-circle-question mr-1"></i> ${qVal}</p>
              <p class="text-slate-600"><i class="fa-solid fa-comment-dots mr-1 text-emerald-600"></i> ${aVal}</p>
              ${fileName ? `<p class="text-[10px] text-sky-600 font-semibold"><i class="fa-solid fa-paperclip mr-1"></i> ${fileName}</p>` : ''}
            </div>
            <button onclick="deleteQAItem(${index})" class="text-rose-500 hover:text-rose-700 p-2 transition" title="Xóa mục này">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;
      });
      container.innerHTML = html;
    }

    async function deleteQAItem(index) {
      if (currentRole === 'admin') {
        let qaData = getLearnedQA();
        qaData.splice(index, 1);
        await syncToCloud(qaData);
      } else {
        personalSheetData.splice(index, 1);
        alert('🗑️ Đã xóa mục khỏi kho cá nhân của bạn.');
      }
      renderQAListInModal();
    }
//Cài đặt app trên điện thoại
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;

  const installBtn = document.getElementById("installAppBtn");
  if (installBtn) {
    installBtn.classList.remove("hidden");
  }
});

async function installKienoraAI() {
  if (!deferredInstallPrompt) {
    alert(
      "Trình duyệt chưa cung cấp nút cài đặt tự động. " +
      "Hãy mở menu trình duyệt và chọn 'Cài đặt ứng dụng' hoặc 'Thêm vào màn hình chính'."
    );
    return;
  }

  deferredInstallPrompt.prompt();

  const result = await deferredInstallPrompt.userChoice;

  if (result.outcome === "accepted") {
    console.log("KienoraAI đã được cài đặt.");
  }

  deferredInstallPrompt = null;

  const installBtn = document.getElementById("installAppBtn");
  if (installBtn) {
    installBtn.classList.add("hidden");
  }
}

window.addEventListener("appinstalled", () => {
  const installBtn = document.getElementById("installAppBtn");
  if (installBtn) {
    installBtn.classList.add("hidden");
  }

  deferredInstallPrompt = null;
});
//thêm tạm thời để test
async function testKienoraAPI() {
  try {
    const result = await postApi({
      action: "ask",
      username: currentUser || "",
      question: "Hello"
    });

    console.log("KIENORA API TEST:", result);

    alert(
      "API trả về:\n\n" +
      JSON.stringify(result, null, 2)
    );

  } catch (error) {
    console.error("API TEST ERROR:", error);

    alert(
      "API lỗi:\n\n" +
      error.message
    );
  }
}
