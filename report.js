const U = window.SurveyUtil;
const S = window.SURVEY;
const keyStore = 'bbt_orientation_2569_master_key';
let client = null;
let responses = [];
let summary = [];

function $(id) { return document.getElementById(id); }

function setupPasswordToggles() {
  document.querySelectorAll('.toggle-password').forEach((button) => {
    button.addEventListener('click', () => {
      const input = $(button.dataset.target);
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(isHidden));
      button.setAttribute('aria-label', isHidden ? 'ซ่อน Master Key' : 'แสดง Master Key');
      input.focus();
    });
  });
}

function initClient() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY.includes('PASTE_')) {
    $('gate-message').textContent = 'ยังไม่ได้ตั้งค่า SUPABASE_ANON_KEY ใน config.js';
    $('gate-message').className = 'small error';
    return false;
  }
  client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  return true;
}

async function verify(key) {
  const { data, error } = await client.rpc('verify_master_key', { p_survey_id: window.SURVEY_ID, p_key: key });
  if (error) throw error;
  return data === true;
}

async function load(key) {
  const { data, error } = await client.rpc('get_responses', { p_survey_id: window.SURVEY_ID, p_key: key });
  if (error) throw error;
  responses = data || [];
  summary = U.summarize(responses);
  render();
}

function generatedDate() {
  return new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function svgBar(value) {
  const width = Math.max(0, Math.min(5, value || 0)) * 60;
  return `<svg class="svg-bar" width="330" height="28" viewBox="0 0 330 28" role="img">
    <rect x="0" y="8" width="300" height="10" rx="5" fill="#d9e4e1"></rect>
    <rect x="0" y="8" width="${width}" height="10" rx="5" fill="#1f6f68"></rect>
    <text x="310" y="18">${U.fmt(value)}</text>
  </svg>`;
}

function distribution(item) {
  return `<table><thead><tr><th class="num">5</th><th class="num">4</th><th class="num">3</th><th class="num">2</th><th class="num">1</th><th class="num">Mean</th><th class="num">SD</th><th class="num">N</th></tr></thead>
    <tbody><tr><td class="num">${item.counts[5]}</td><td class="num">${item.counts[4]}</td><td class="num">${item.counts[3]}</td><td class="num">${item.counts[2]}</td><td class="num">${item.counts[1]}</td><td class="num">${U.fmt(item.mean)}</td><td class="num">${U.fmt(item.sd)}</td><td class="num">${item.n}</td></tr></tbody></table>`;
}

function countValues(values) {
  return values.reduce((acc, value) => {
    if (value === null || value === undefined || value === '') return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
}

function modeFromCounts(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return entries[0] || null;
}

function demographics() {
  const demo = responses.map((row) => row.payload?.demographics || {});
  const roleCounts = countValues(demo.map((item) => item.role));
  const yearCounts = countValues(demo.map((item) => item.graduation_year));
  const ageValues = demo.map((item) => item.age).filter((value) => Number.isFinite(Number(value)));
  const ageMean = mean(ageValues);
  const yearMode = modeFromCounts(yearCounts);
  const roleEntries = Object.entries(roleCounts);
  const roleSafe = roleEntries.length > 0 && roleEntries.every(([, count]) => count >= 3);

  return {
    total: responses.length,
    ageMean,
    ageRange: ageValues.length ? `${Math.min(...ageValues)}-${Math.max(...ageValues)}` : '-',
    yearMode,
    roleCounts,
    roleSafe
  };
}

function demographicsHtml(demo, mode = 'screen') {
  const roleRows = Object.entries(demo.roleCounts).map(([role, count]) => (
    `<tr><td>${U.html(role)}</td><td class="num">${demo.roleSafe ? count : 'ปกปิด'}</td></tr>`
  )).join('');
  const yearText = demo.yearMode ? `${U.html(demo.yearMode[0])} (${demo.yearMode[1]} คน)` : '-';

  return `<div class="${mode === 'screen' ? 'demographic-grid' : ''}">
    <div class="panel"><div class="muted">ผู้ตอบทั้งหมด</div><div class="metric-value">${demo.total}</div></div>
    <div class="panel"><div class="muted">อายุเฉลี่ย</div><div class="metric-value">${U.fmt(demo.ageMean)}</div><div class="small muted">ช่วงอายุ ${U.html(demo.ageRange)} ปี</div></div>
    <div class="panel"><div class="muted">ปีที่จบการศึกษาที่พบบ่อย</div><div class="metric-value metric-text">${yearText}</div></div>
    <div class="panel demographic-table">
      <div class="muted">ตำแหน่ง</div>
      ${roleRows ? `<table><tbody>${roleRows}</tbody></table>` : '<p class="muted">ไม่มีข้อมูล</p>'}
      ${demo.roleSafe ? '' : '<p class="small muted">ไม่แสดงจำนวนกลุ่มย่อยที่น้อยกว่า 3 คน เพื่อปกป้องความเป็นส่วนตัว</p>'}
    </div>
  </div>`;
}

function compactBar(value) {
  const width = Math.max(0, Math.min(5, value || 0)) * 24;
  return `<svg class="compact-bar" width="120" height="10" viewBox="0 0 120 10" aria-hidden="true">
    <rect x="0" y="0" width="120" height="10" rx="5"></rect>
    <rect x="0" y="0" width="${width}" height="10" rx="5"></rect>
  </svg>`;
}

function listItems(items, emptyText) {
  return items.length
    ? `<ol>${items.map((item) => `<li><span>${U.html(item.label)}</span><strong>${U.fmt(item.mean)}</strong></li>`).join('')}</ol>`
    : `<p class="muted">${emptyText}</p>`;
}

function scoreStatus(item) {
  const flag = U.flag(item.mean);
  if (flag === 'จุดแข็ง') return '<span class="badge good">จุดแข็ง</span>';
  if (flag === 'ควรปรับปรุง') return '<span class="badge bad">ควรติดตาม</span>';
  return '<span class="badge neutral">ปกติ</span>';
}

function chunks(items, size) {
  const pages = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

function dashboardHtml(overall, top, low, improvements, strengths, demo) {
  const answeredComments = S.s5Items.reduce((total, [key]) => (
    total + responses.filter((row) => row.payload?.s5?.[key]?.trim()).length
  ), 0);

  return `<section class="report-dashboard no-print">
    <div class="report-dashboard-head">
      <div>
        <div class="brand-kicker">Report Dashboard</div>
        <h1>ภาพรวมรายงาน</h1>
        <p class="subtitle">${U.html(S.subtitle)}</p>
      </div>
      <div class="report-dashboard-meta">
        <span>${U.html(generatedDate())}</span>
        <span>เอกสารภายใน - ไม่ระบุตัวตน</span>
      </div>
    </div>

    <div class="report-dashboard-grid">
      <div class="card metric"><div class="muted">จำนวนผู้ตอบ</div><div class="metric-value">${responses.length}</div></div>
      <div class="card metric"><div class="muted">ความพึงพอใจโดยรวม</div><div class="metric-value">${U.fmt(overall?.mean)}</div></div>
      <div class="card metric"><div class="muted">หัวข้อควรติดตาม</div><div class="metric-value">${improvements.length}</div></div>
      <div class="card metric"><div class="muted">ความคิดเห็นที่ได้รับ</div><div class="metric-value">${answeredComments}</div></div>
    </div>

    <div class="report-dashboard-columns">
      <section class="card">
        <h2>จุดแข็งสูงสุด</h2>
        ${listItems(top, 'ยังไม่มีข้อมูลเพียงพอ')}
      </section>
      <section class="card">
        <h2>หัวข้อที่ควรติดตาม</h2>
        ${listItems(low, 'ยังไม่มีข้อมูลเพียงพอ')}
      </section>
    </div>

    <section class="card">
      <h2>ข้อมูลผู้ตอบ</h2>
      ${demographicsHtml(demo, 'screen')}
    </section>

    <section class="card">
      <h2>ค่าเฉลี่ยรายหัวข้อ</h2>
      <div class="dashboard-metric-list">
        ${summary.filter((item) => item.mean !== null).map((item) => `
          <details class="dashboard-metric-row">
            <summary>
              <span>${U.html(item.label)}</span>
              ${compactBar(item.mean)}
              <strong>${U.fmt(item.mean)}</strong>
              ${scoreStatus(item)}
            </summary>
            <div class="dashboard-metric-detail">${distribution(item)}</div>
          </details>
        `).join('')}
      </div>
    </section>
  </section>`;
}

function metricPages(items) {
  return chunks(items, 5).map((pageItems, index) => `<section class="report-page">
    <h2>รายละเอียดคะแนน ${items.length > 5 ? `(${index + 1}/${Math.ceil(items.length / 5)})` : ''}</h2>
    ${pageItems.map((item) => `<div class="panel report-metric-panel">
      <h3>${U.html(item.label)}</h3>
      ${svgBar(item.mean)}
      ${distribution(item)}
    </div>`).join('')}
  </section>`).join('');
}

function commentsHtml() {
  return S.s5Items.map(([key, label]) => {
    const comments = responses.map((row) => row.payload?.s5?.[key]?.trim()).filter(Boolean);
    return `<h3>${U.html(label)}</h3>${comments.length ? comments.map((text) => `<div class="comment">${U.html(text)}</div>`).join('') : '<p class="muted">ไม่มีคำตอบ</p>'}`;
  }).join('');
}

function render() {
  $('gate').classList.add('hidden');
  $('report').classList.remove('hidden');
  const overall = summary.find((item) => item.section === 's4' && item.key === '6');
  const sorted = [...summary].filter((item) => item.mean !== null).sort((a, b) => b.mean - a.mean);
  const top = sorted.slice(0, 3);
  const low = [...sorted].sort((a, b) => a.mean - b.mean).slice(0, 3);
  const strengths = summary.filter((item) => U.flag(item.mean) === 'จุดแข็ง');
  const improvements = summary.filter((item) => U.flag(item.mean) === 'ควรปรับปรุง');
  const demo = demographics();

  $('report-body').innerHTML = `
    ${dashboardHtml(overall, top, low, improvements, strengths, demo)}

    <section class="report-page cover-page">
      <div class="brand-kicker">รพ.บางบัวทอง</div>
      <h1>รายงานผลการประเมินความพึงพอใจ</h1>
      <p class="subtitle">${U.html(S.subtitle)}</p>
      <p class="meta">${U.html(S.eventDate)}</p>
      <p class="meta">${U.html(S.venue)}</p>
      <div class="stats-grid cover-stats">
        <div class="panel"><div class="muted">จำนวนผู้ตอบ</div><div class="metric-value">${responses.length}</div></div>
        <div class="panel"><div class="muted">ความพึงพอใจโดยรวม</div><div class="metric-value">${U.fmt(overall?.mean)}</div></div>
      </div>
      <p class="meta cover-generated">จัดทำเมื่อ ${generatedDate()}</p>
      <p class="muted">เอกสารภายใน - ไม่ระบุตัวตน</p>
    </section>

    <section class="report-page">
      <h2>สรุปสำหรับผู้บริหาร</h2>
      <p>ค่าเฉลี่ยความพึงพอใจโดยรวม: <strong>${U.fmt(overall?.mean)}</strong></p>
      <h3>จุดแข็งสูงสุด 3 อันดับ</h3>
      ${listItems(top, 'ยังไม่มีข้อมูลเพียงพอ')}
      <h3>หัวข้อที่ควรติดตาม 3 อันดับ</h3>
      ${listItems(low, 'ยังไม่มีข้อมูลเพียงพอ')}
    </section>

    <section class="report-page">
      <h2>ข้อมูลทั่วไปของผู้ตอบแบบประเมิน</h2>
      ${demographicsHtml(demo, 'print')}
      <p class="small muted">รายงานนี้ไม่แสดงข้อมูลกลุ่มย่อยที่มีจำนวนน้อยกว่า 3 คน เพื่อปกป้องความเป็นส่วนตัวของผู้ตอบแบบประเมิน</p>
    </section>

    ${metricPages(summary)}

    <section class="report-page">
      <h2>ข้อเสนอแนะเชิงคุณภาพ</h2>
      <h3>ควรปรับปรุง</h3>
      ${improvements.length ? `<ul>${improvements.map((item) => `<li>${U.html(item.label)}: ${U.fmt(item.mean)}</li>`).join('')}</ul>` : '<p class="muted">ไม่มีหัวข้อที่มีค่าเฉลี่ยต่ำกว่า 3.5</p>'}
      <h3>จุดแข็ง</h3>
      ${strengths.length ? `<ul>${strengths.map((item) => `<li>${U.html(item.label)}: ${U.fmt(item.mean)}</li>`).join('')}</ul>` : '<p class="muted">ไม่มีหัวข้อที่มีค่าเฉลี่ยตั้งแต่ 4.5 ขึ้นไป</p>'}
    </section>

    <section class="report-page">
      <h2>ความคิดเห็นและข้อเสนอแนะ</h2>
      ${commentsHtml()}
      <p class="muted">เอกสารภายใน - ไม่ระบุตัวตน</p>
    </section>`;
}

function bind() {
  $('print-report')?.addEventListener('click', () => window.print());

  $('key-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const key = $('master-key').value;
    event.submitter.disabled = true;
    try {
      if (await verify(key)) {
        sessionStorage.setItem(keyStore, key);
        await load(key);
      } else {
        $('gate-message').textContent = 'Master Key ไม่ถูกต้อง';
        $('gate-message').className = 'small error';
      }
    } catch (error) {
      console.error(error);
      $('gate-message').textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
      $('gate-message').className = 'small error';
    } finally {
      event.submitter.disabled = false;
    }
  });
}

setupPasswordToggles();

if (initClient()) {
  bind();
  const saved = sessionStorage.getItem(keyStore);
  if (saved) load(saved).catch(() => sessionStorage.removeItem(keyStore));
}
