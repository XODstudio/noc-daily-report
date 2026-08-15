// --- KONEKSI SUPABASE ---
const SUPABASE_URL = 'https://piuwcjsdkcbtzwdwblor.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xLcGMLD9nT_8RMkPe6dsgg_kOsslm0c';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- State Management ---
let reports = JSON.parse(localStorage.getItem('noc_reports')) || [];
let pendingTasks = JSON.parse(localStorage.getItem('noc_pending_tasks')) || [];
let taskList = JSON.parse(localStorage.getItem('noc_task_list')) || [];
let pastedImagesArray = [];
let currentFilter = 'ALL';
let currentTaskFilter = 'ALL';

// --- Tab Switching Logic ---
function switchMainTab(tab) {
  const tabIncidents = document.getElementById('tab-incidents');
  const tabTasks = document.getElementById('tab-tasks');
  const btnIncidents = document.getElementById('tab-btn-incidents');
  const btnTasks = document.getElementById('tab-btn-tasks');

  if (tab === 'incidents') {
    tabIncidents.classList.remove('hidden');
    tabTasks.classList.add('hidden');
    btnIncidents.className = 'px-4 py-2 rounded-md font-semibold bg-sky-600 text-white transition';
    btnTasks.className = 'px-4 py-2 rounded-md font-semibold text-slate-400 hover:text-white transition';
  } else {
    tabIncidents.classList.add('hidden');
    tabTasks.classList.remove('hidden');
    btnTasks.className = 'px-4 py-2 rounded-md font-semibold bg-amber-600 text-white transition';
    btnIncidents.className = 'px-4 py-2 rounded-md font-semibold text-slate-400 hover:text-white transition';
  }
}

// --- Element Selectors ---
const reportForm = document.getElementById('report-form');
const prForm = document.getElementById('pr-form');
const taskForm = document.getElementById('task-form');
const logTableBody = document.getElementById('log-table-body');
const taskTableBody = document.getElementById('task-table-body');
const prContainer = document.getElementById('pr-container');
const pasteArea = document.getElementById('paste-area');
const pastePlaceholder = document.getElementById('paste-placeholder');
const pastePreviewContainer = document.getElementById('paste-preview-container');
const modal = document.getElementById('image-modal');
const modalImgSrc = document.getElementById('modal-img-src');
const modalCaption = document.getElementById('modal-caption');

// Set Tanggal Laporan
const formattedDate = new Date().toLocaleDateString('id-ID', {
  weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
});
document.getElementById('current-date').innerText = formattedDate;
document.getElementById('print-date').innerText = formattedDate;

// --- UPLOAD MULTIPLE SUPABASE ---
async function uploadMultipleToSupabase(imagesArray) {
  if (!imagesArray || imagesArray.length === 0) return [];

  const uploadPromises = imagesArray.map(async (fileOrBase64, index) => {
    try {
      let fileToUpload = fileOrBase64;
      if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:image')) {
        const res = await fetch(fileOrBase64);
        fileToUpload = await res.blob();
      }

      const fileName = `noc_${Date.now()}_${index}.png`;

      const { data, error } = await supabaseClient.storage
        .from('noc-images')
        .upload(fileName, fileToUpload, { contentType: 'image/png' });

      if (error) throw error;

      const { data: publicUrlData } = supabaseClient.storage
        .from('noc-images')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Gagal upload gambar ke Supabase:', err);
      return null;
    }
  });

  const results = await Promise.all(uploadPromises);
  return results.filter(url => url !== null);
}

// --- CTRL + V (Paste Multiple Screenshot) ---
pasteArea.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let item of items) {
    if (item.type.indexOf('image') === 0) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (event) => {
        pastedImagesArray.push(event.target.result);
        renderPastePreviews();
      };
      reader.readAsDataURL(blob);
    }
  }
});

function renderPastePreviews() {
  if (pastedImagesArray.length === 0) {
    pastePlaceholder.classList.remove('hidden');
    pastePreviewContainer.classList.add('hidden');
    pastePreviewContainer.innerHTML = '';
    return;
  }

  pastePlaceholder.classList.add('hidden');
  pastePreviewContainer.classList.remove('hidden');
  pastePreviewContainer.innerHTML = '';

  pastedImagesArray.forEach((imgBase64, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'relative group border border-slate-700 rounded p-1 bg-slate-950';
    wrapper.innerHTML = `
      <img src="${imgBase64}" class="h-16 w-20 object-cover rounded">
      <button type="button" onclick="removePastedImg(${idx})" class="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold hover:bg-rose-500 shadow">✕</button>
    `;
    pastePreviewContainer.appendChild(wrapper);
  });
}

function removePastedImg(index) {
  pastedImagesArray.splice(index, 1);
  renderPastePreviews();
}

function resetPasteArea() {
  pastedImagesArray = [];
  renderPastePreviews();
}

// --- MODAL PREVIEW FOTO ---
function openModal(imgUrl, ticketId) {
  modalImgSrc.src = imgUrl;
  modalCaption.innerText = `Bukti Foto: ${ticketId}`;
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  modalImgSrc.src = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

function setPresetProblem(text) {
  const problemInput = document.getElementById('problem');
  problemInput.value = text;
  problemInput.focus();
}

function updateStats() {
  document.getElementById('stat-total').innerText = reports.length;
  document.getElementById('stat-open').innerText = reports.filter(r => r.status === 'OPEN').length;
  document.getElementById('stat-critical').innerText = reports.filter(r => r.severity === 'Critical').length;
  document.getElementById('stat-pr').innerText = pendingTasks.length;
}

// --- RENDER INCIDENTS ---
function renderLogTable() {
  logTableBody.innerHTML = '';

  let filtered = reports;
  if (currentFilter === 'OPEN') filtered = reports.filter(r => r.status === 'OPEN');
  if (currentFilter === 'CRITICAL') filtered = reports.filter(r => r.severity === 'Critical');

  if (filtered.length === 0) {
    logTableBody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500">Belum ada catatan insiden shift ini.</td></tr>`;
    return;
  }

  filtered.forEach((item, index) => {
    let badgeColor = 'border-red-500/30 bg-red-500/10 text-red-400';
    if (item.status === 'IN PROGRESS') badgeColor = 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
    if (item.status === 'RESOLVED') badgeColor = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';

    let sevBadge = 'border-slate-600 bg-slate-700 text-slate-300';
    if (item.severity === 'Major') sevBadge = 'border-orange-500/50 bg-orange-500/10 text-orange-400';
    if (item.severity === 'Critical') sevBadge = 'border-rose-600/70 bg-rose-600/10 text-rose-300';

    let imgPreview = `<span class="text-slate-600">-</span>`;
    if (item.images && item.images.length > 0) {
      imgPreview = `<div class="flex gap-1 overflow-x-auto max-w-[120px]">`;
      item.images.forEach((url) => {
        imgPreview += `<img src="${url}" class="h-8 w-10 object-cover rounded border border-slate-600 cursor-pointer hover:opacity-80 transition" onclick="openModal('${url}', '${item.ticketId}')">`;
      });
      imgPreview += `</div>`;
    }

    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-750/30 transition';
    row.innerHTML = `
      <td class="p-3 text-slate-400 font-mono">${item.time}</td>
      <td class="p-3 no-print">${imgPreview}</td>
      <td class="p-3 font-semibold text-slate-200">${item.ticketId}</td>
      <td class="p-3">${item.problem}</td>
      <td class="p-3 text-slate-400">${item.action || '-'}</td>
      <td class="p-3"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold border ${sevBadge}">${item.severity}</span></td>
      <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}">${item.status}</span></td>
      <td class="p-3 text-center sticky right-0 bg-slate-800 no-print">
        <button onclick="deleteReport(${index})" class="text-rose-400 hover:text-rose-300">Hapus</button>
      </td>
    `;
    logTableBody.appendChild(row);
  });
}

function renderPR() {
  prContainer.innerHTML = '';
  if (pendingTasks.length === 0) {
    prContainer.innerHTML = `<p class="text-xs text-slate-500">Tidak ada PR shift ini.</p>`;
    return;
  }

  pendingTasks.forEach((task, index) => {
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-700 text-xs text-slate-200';
    div.innerHTML = `
      <span>• ${task}</span>
      <button onclick="deletePR(${index})" class="no-print text-slate-500 hover:text-rose-400 text-xs ml-2">✓ Selesai</button>
    `;
    prContainer.appendChild(div);
  });
}

// --- RENDER TASK & MAINTENANCE ---
function renderTasks() {
  taskTableBody.innerHTML = '';

  let filtered = taskList;
  if (currentTaskFilter !== 'ALL') {
    filtered = taskList.filter(t => t.status === currentTaskFilter);
  }

  if (filtered.length === 0) {
    taskTableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500">Belum ada daftar task / maintenance.</td></tr>`;
    return;
  }

  filtered.forEach((task, idx) => {
    let statBadge = 'bg-slate-700 text-slate-300 border-slate-600';
    if (task.status === 'SCHEDULED') statBadge = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    if (task.status === 'PENDING') statBadge = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    if (task.status === 'IN PROGRESS') statBadge = 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    if (task.status === 'DONE') statBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-750/30 transition';
    row.innerHTML = `
      <td class="p-3 font-mono text-slate-400">${task.schedule ? task.schedule.replace('T', ' ') : 'Fleksibel'}</td>
      <td class="p-3 text-slate-300"><span class="bg-slate-700/60 px-2 py-0.5 rounded text-[10px] border border-slate-600">${task.category}</span></td>
      <td class="p-3 font-semibold text-slate-100">${task.title}</td>
      <td class="p-3 text-slate-400">${task.pic || '-'}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${statBadge}">${task.status}</span></td>
      <td class="p-3 text-center sticky right-0 bg-slate-800">
        <div class="flex justify-center gap-1">
          ${task.status !== 'DONE' ? `<button onclick="updateTaskStatus(${idx}, 'DONE')" class="text-[10px] bg-emerald-600/80 hover:bg-emerald-500 text-white px-2 py-1 rounded">✓ Done</button>` : ''}
          ${task.status === 'SCHEDULED' ? `<button onclick="updateTaskStatus(${idx}, 'IN PROGRESS')" class="text-[10px] bg-sky-600/80 hover:bg-sky-500 text-white px-2 py-1 rounded">Mulai</button>` : ''}
          <button onclick="deleteTask(${idx})" class="text-[10px] text-rose-400 hover:underline ml-1">Hapus</button>
        </div>
      </td>
    `;
    taskTableBody.appendChild(row);
  });
}

function updateTaskStatus(index, newStatus) {
  taskList[index].status = newStatus;
  localStorage.setItem('noc_task_list', JSON.stringify(taskList));
  renderTasks();
}

function deleteTask(index) {
  if (confirm('Hapus task ini?')) {
    taskList.splice(index, 1);
    localStorage.setItem('noc_task_list', JSON.stringify(taskList));
    renderTasks();
  }
}

// --- SUBMIT INCIDENT FORM ---
reportForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const btnSubmit = reportForm.querySelector('button[type="submit"]');
  const originalBtnText = btnSubmit.innerText;
  btnSubmit.innerText = 'Mengunggah Foto...';
  btnSubmit.disabled = true;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const fileInput = document.getElementById('ticket-image');
  const file = fileInput.files[0];

  let rawImagesToUpload = [...pastedImagesArray];

  if (file) {
    const fileBase64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (evt) => resolve(evt.target.result);
      reader.readAsDataURL(file);
    });
    rawImagesToUpload.push(fileBase64);
  }

  const uploadedUrls = await uploadMultipleToSupabase(rawImagesToUpload);

  const newLog = {
    id: Date.now(),
    time: timeStr,
    ticketId: document.getElementById('ticket-id').value,
    status: document.getElementById('status').value,
    severity: document.getElementById('severity').value,
    problem: document.getElementById('problem').value,
    action: document.getElementById('action').value,
    images: uploadedUrls
  };

  reports.push(newLog);
  localStorage.setItem('noc_reports', JSON.stringify(reports));
  renderLogTable();
  updateStats();
  reportForm.reset();
  resetPasteArea();

  btnSubmit.innerText = originalBtnText;
  btnSubmit.disabled = false;
});

// --- SUBMIT TASK FORM ---
taskForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const newTask = {
    id: Date.now(),
    title: document.getElementById('task-title').value,
    category: document.getElementById('task-category').value,
    status: document.getElementById('task-status').value,
    schedule: document.getElementById('task-schedule').value,
    pic: document.getElementById('task-pic').value
  };

  taskList.push(newTask);
  localStorage.setItem('noc_task_list', JSON.stringify(taskList));
  renderTasks();
  taskForm.reset();
});

// PR Submit
prForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = document.getElementById('pr-text').value;
  pendingTasks.push(text);
  localStorage.setItem('noc_pending_tasks', JSON.stringify(pendingTasks));
  renderPR();
  updateStats();
  prForm.reset();
});

function deleteReport(index) {
  if (confirm('Hapus log ini?')) {
    reports.splice(index, 1);
    localStorage.setItem('noc_reports', JSON.stringify(reports));
    renderLogTable();
    updateStats();
  }
}

function deletePR(index) {
  pendingTasks.splice(index, 1);
  localStorage.setItem('noc_pending_tasks', JSON.stringify(pendingTasks));
  renderPR();
  updateStats();
}

function clearShift() {
  if (confirm('Reset log insiden shift ini? (PR dan Task tidak terhapus)')) {
    reports = [];
    localStorage.setItem('noc_reports', JSON.stringify(reports));
    renderLogTable();
    updateStats();
  }
}

function filterLogs(type) {
  currentFilter = type;
  renderLogTable();
}

function filterTasks(status) {
  currentTaskFilter = status;
  renderTasks();
}

// --- COPY WHATSAPP: INCIDENTS ---
document.getElementById('btn-copy').addEventListener('click', () => {
  if (reports.length === 0) { alert('Belum ada log!'); return; }

  let txt = `*NOC DAILY REPORT SHIFT*\n`;
  txt += `Tanggal: ${formattedDate}\n`;
  txt += `=====================================\n\n`;
  txt += `📜 *A. INSIDEN HARI INI*\n`;

  reports.forEach((item, i) => {
    let stat = item.status === 'RESOLVED' ? '✅' : (item.status === 'IN PROGRESS' ? '⚠️' : '🚨');
    txt += `${i + 1}. *[${stat} ${item.status}]* [${item.severity}] ${item.ticketId}\n`;
    txt += `   • Jam: ${item.time} WIB\n`;
    txt += `   • Problem: ${item.problem}\n`;
    txt += `   • Action: ${item.action || '-'}\n`;
    
    if (item.images && item.images.length > 0) {
      txt += `   • Bukti Foto (${item.images.length}):\n`;
      item.images.forEach((url, idx) => {
        txt += `     ${idx + 1}. ${url}\n`;
      });
    }
    txt += `\n`;
  });

  txt += `=====================================\n`;
  txt += `📌 *B. PEKERJAAN RUMAH (PR HANDOVER)*\n`;
  if (pendingTasks.length === 0) {
    txt += `  - Nihil\n`;
  } else {
    pendingTasks.forEach((t, i) => txt += `  ${i + 1}. ${t}\n`);
  }

  navigator.clipboard.writeText(txt).then(() => {
    alert('Laporan Insiden Harian berhasil di-copy ke Clipboard!');
  });
});

// --- COPY WHATSAPP: TASK & AGENDA ---
document.getElementById('btn-copy-tasks').addEventListener('click', () => {
  if (taskList.length === 0) { alert('Belum ada task / agenda!'); return; }

  let txt = `*NOC AGENDA & TASK MONITORING*\n`;
  txt += `Update: ${formattedDate}\n`;
  txt += `=====================================\n\n`;

  taskList.forEach((t, i) => {
    let icon = t.status === 'DONE' ? '✅' : (t.status === 'IN PROGRESS' ? '⚙️' : (t.status === 'PENDING' ? '⏳' : '📅'));
    txt += `${i + 1}. [${icon} ${t.status}] *${t.title}*\n`;
    txt += `   • Kategori: ${t.category}\n`;
    txt += `   • Jadwal: ${t.schedule ? t.schedule.replace('T', ' ') + ' WIB' : 'Fleksibel'}\n`;
    txt += `   • PIC: ${t.pic || '-'}\n\n`;
  });

  navigator.clipboard.writeText(txt).then(() => {
    alert('Daftar Agenda Task berhasil di-copy ke Clipboard!');
  });
});

// Initial Render All
renderLogTable();
renderPR();
renderTasks();
updateStats();