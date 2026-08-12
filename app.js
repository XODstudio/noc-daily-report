// --- KONEKSI SUPABASE ---
const SUPABASE_URL = 'https://piuwcjsdkcbtzwdwblor.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xLcGMLD9nT_8RMkPe6dsgg_kOsslm0c';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- State Management ---
let reports = JSON.parse(localStorage.getItem('noc_reports')) || [];
let pendingTasks = JSON.parse(localStorage.getItem('noc_pending_tasks')) || [];
let pastedImagesArray = []; // Menggunakan Array untuk Multiple Images!
let currentFilter = 'ALL';

// --- Element Selectors ---
const reportForm = document.getElementById('report-form');
const prForm = document.getElementById('pr-form');
const logTableBody = document.getElementById('log-table-body');
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

// --- FUNGSI UPLOAD BANYAK FOTO KE SUPABASE ---
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

// --- CTRL + V (Paste Multiple Screenshots) ---
pasteArea.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let item of items) {
    if (item.type.indexOf('image') === 0) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (event) => {
        pastedImagesArray.push(event.target.result); // Tambah foto ke Array
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

// --- SHORTCUT PRESET PROBLEM ---
function setPresetProblem(text) {
  const problemInput = document.getElementById('problem');
  problemInput.value = text;
  problemInput.focus();
}

// --- UPDATE STATS WIDGETS ---
function updateStats() {
  document.getElementById('stat-total').innerText = reports.length;
  document.getElementById('stat-open').innerText = reports.filter(r => r.status === 'OPEN').length;
  document.getElementById('stat-critical').innerText = reports.filter(r => r.severity === 'Critical').length;
  document.getElementById('stat-pr').innerText = pendingTasks.length;
}

// --- MODAL PREVIEW FOTO ---
function openModal(imgUrl, ticketId) {
  modalImgSrc.src = imgUrl;
  modalCaption.innerText = `Bukti Screenshot / Foto untuk: ${ticketId}`;
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  modalImgSrc.src = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// --- RENDER LOGIC ---
function render() {
  renderLogTable();
  renderPR();
  updateStats();
}

function renderLogTable() {
  logTableBody.innerHTML = '';

  let filteredReports = reports;
  if (currentFilter === 'OPEN') {
    filteredReports = reports.filter(r => r.status === 'OPEN');
  } else if (currentFilter === 'CRITICAL') {
    filteredReports = reports.filter(r => r.severity === 'Critical');
  }

  if (filteredReports.length === 0) {
    logTableBody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500">Belum ada catatan insiden.</td></tr>`;
    return;
  }

  filteredReports.forEach((item, index) => {
    let badgeColor = 'border-red-500/30 bg-red-500/10 text-red-400';
    if (item.status === 'IN PROGRESS') badgeColor = 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
    if (item.status === 'RESOLVED') badgeColor = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';

    let sevBadge = 'border-slate-600 bg-slate-700 text-slate-300';
    if (item.severity === 'Major') sevBadge = 'border-orange-500/50 bg-orange-500/10 text-orange-400';
    if (item.severity === 'Critical') sevBadge = 'border-rose-600/70 bg-rose-600/10 text-rose-300';

    // Render Thumbnail Foto Banyak
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

// --- SUBMIT LOGIC MULTIPLE UPLOAD ---
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

  // Upload Semua Gambar ke Supabase
  const uploadedUrls = await uploadMultipleToSupabase(rawImagesToUpload);

  const newLog = {
    id: Date.now(),
    time: timeStr,
    ticketId: document.getElementById('ticket-id').value,
    status: document.getElementById('status').value,
    severity: document.getElementById('severity').value,
    problem: document.getElementById('problem').value,
    action: document.getElementById('action').value,
    images: uploadedUrls // Menyimpan Array URL Gambar
  };

  reports.push(newLog);
  localStorage.setItem('noc_reports', JSON.stringify(reports));
  render();
  reportForm.reset();
  resetPasteArea();

  btnSubmit.innerText = originalBtnText;
  btnSubmit.disabled = false;
});

// Submit PR
prForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = document.getElementById('pr-text').value;
  pendingTasks.push(text);
  localStorage.setItem('noc_pending_tasks', JSON.stringify(pendingTasks));
  render();
  prForm.reset();
});

function deleteReport(index) {
  if (confirm('Hapus log ini?')) {
    reports.splice(index, 1);
    localStorage.setItem('noc_reports', JSON.stringify(reports));
    render();
  }
}

function deletePR(index) {
  pendingTasks.splice(index, 1);
  localStorage.setItem('noc_pending_tasks', JSON.stringify(pendingTasks));
  render();
}

function clearShift() {
  if (confirm('Reset log insiden shift ini? (PR tidak terhapus)')) {
    reports = [];
    localStorage.setItem('noc_reports', JSON.stringify(reports));
    render();
  }
}

function filterLogs(type) {
  currentFilter = type;
  renderLogTable();
}

// COPY WHATSAPP WITH MULTIPLE CLOUD LINKS
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
    alert('Laporan berhasil di-copy! Semua link foto publik sudah tersusun rapi.');
  });
});

// Initial Render
render();