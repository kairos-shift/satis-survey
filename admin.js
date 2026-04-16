const U = window.SurveyUtil;
const S = window.SURVEY;
const keyStore = 'bbt_orientation_2569_master_key';
const attemptsKey = 'bbt_orientation_2569_master_attempts';
const lockKey = 'bbt_orientation_2569_master_lock_until';
let client = null;
let responses = [];
let summary = [];
let chart = null;

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

function lockMessage() {
  const until = Number(sessionStorage.getItem(lockKey) || 0);
  return until > Date.now() ? `กรุณาลองใหม่อีกครั้งใน ${Math.ceil((until - Date.now()) / 60000)} นาที` : '';
}

function wrongAttempt() {
  const attempts = Number(sessionStorage.getItem(attemptsKey) || 0) + 1;
  sessionStorage.setItem(attemptsKey, String(attempts));
  if (attempts >= 5) {
    sessionStorage.setItem(lockKey, String(Date.now() + 5 * 60 * 1000));
    sessionStorage.setItem(attemptsKey, '0');
  }
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

function render() {
  $('gate').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
  $('response-count').textContent = responses.length;
  const overall = summary.find((item) => item.section === 's4' && item.key === '6');
  $('overall-mean').textContent = U.fmt(overall?.mean);
  renderChart();
  renderTable();
  renderRoleBreakdown();
  renderComments();
}

function renderChart() {
  const sorted = [...summary].filter((item) => item.mean !== null).sort((a, b) => b.mean - a.mean);
  const labels = sorted.map((item) => item.label.length > 48 ? `${item.label.slice(0, 48)}...` : item.label);
  const data = sorted.map((item) => Number(item.mean.toFixed(2)));
  if (chart) chart.destroy();
  chart = new Chart($('means-chart'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Mean', data, backgroundColor: '#1f6f68', borderRadius: 4 }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      scales: {
        x: { min: 0, max: 5, grid: { color: '#d9e4e1' } },
        y: { grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderTable() {
  $('summary-table').innerHTML = `<table>
    <thead><tr><th>หัวข้อ</th><th class="num">N</th><th class="num">Mean</th><th class="num">SD</th><th class="num">5</th><th class="num">4</th><th class="num">3</th><th class="num">2</th><th class="num">1</th><th>QI</th></tr></thead>
    <tbody>${summary.map((item) => {
      const flag = U.flag(item.mean);
      return `<tr>
        <td>${U.html(item.label)}</td><td class="num">${item.n}</td><td class="num">${U.fmt(item.mean)}</td><td class="num">${U.fmt(item.sd)}</td>
        <td class="num">${item.counts[5]}</td><td class="num">${item.counts[4]}</td><td class="num">${item.counts[3]}</td><td class="num">${item.counts[2]}</td><td class="num">${item.counts[1]}</td>
        <td>${flag ? `<span class="badge ${flag === 'จุดแข็ง' ? 'good' : 'bad'}">${flag}</span>` : ''}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function roleCounts() {
  return S.roleOptions.map((role) => [role, responses.filter((row) => row.payload?.demographics?.role === role).length]);
}

function roleAllowed() {
  const counts = roleCounts();
  return counts.every(([, count]) => count >= 3);
}

function renderRoleBreakdown() {
  if (!roleAllowed()) {
    $('role-breakdown').innerHTML = '<p class="muted">ไม่แสดงข้อมูลแยกตำแหน่ง (กลุ่มย่อยน้อยเกินไปเพื่อปกป้องความเป็นส่วนตัว)</p>';
    return;
  }
  const rows = U.allMetricItems().map((item) => {
    const cells = S.roleOptions.map((role) => {
      const values = U.valuesFor(responses.filter((row) => row.payload?.demographics?.role === role), item.section, item.key);
      return `<td class="num">${U.fmt(U.stats(values).mean)}</td>`;
    }).join('');
    return `<tr><td>${U.html(item.label)}</td>${cells}</tr>`;
  }).join('');
  $('role-breakdown').innerHTML = `<div class="table-wrap"><table><thead><tr><th>หัวข้อ</th>${S.roleOptions.map((role) => `<th class="num">${U.html(role)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderComments() {
  const showRole = roleAllowed();
  $('comments').innerHTML = S.s5Items.map(([key, label]) => {
    const comments = responses
      .map((row) => ({ text: row.payload?.s5?.[key]?.trim(), role: row.payload?.demographics?.role }))
      .filter((item) => item.text);
    return `<section><h3>${U.html(label)}</h3>${comments.length ? comments.map((item) => `
      <div class="comment">${U.html(item.text)}${showRole ? `<div class="small muted">${U.html(item.role)}</div>` : ''}</div>
    `).join('') : '<p class="muted">ไม่มีคำตอบ</p>'}</section>`;
  }).join('');
}

function exportExcel() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary.map((item) => ({
    Item: `${item.section}_${item.key}`,
    'Label (Thai)': item.label,
    N: item.n,
    Mean: item.mean === null ? '' : Number(item.mean.toFixed(2)),
    SD: item.sd === null ? '' : Number(item.sd.toFixed(2)),
    5: item.counts[5],
    4: item.counts[4],
    3: item.counts[3],
    2: item.counts[2],
    1: item.counts[1],
    'QI Flag': U.flag(item.mean)
  }))), 'Summary');

  const raw = responses.map((row) => {
    const base = {
      response_id: row.id,
      submitted_date: row.submitted_date,
      gender: row.payload?.demographics?.gender,
      age: row.payload?.demographics?.age,
      role: row.payload?.demographics?.role,
      institution: row.payload?.demographics?.institution,
      graduation_year: row.payload?.demographics?.graduation_year
    };
    U.allMetricItems().forEach((item) => { base[`${item.section}_${item.key}`] = row.payload?.[item.section]?.[item.key]; });
    S.s5Items.forEach(([key]) => { base[`s5_${key}`] = row.payload?.s5?.[key]; });
    return base;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(raw), 'Raw');

  const showRole = roleAllowed();
  const comments = [];
  responses.forEach((row) => S.s5Items.forEach(([key, label]) => {
    const text = row.payload?.s5?.[key]?.trim();
    if (text) comments.push({ Question: label, 'Response Text': text, 'Role Bucket': showRole ? row.payload?.demographics?.role : '' });
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(comments), 'Comments');
  XLSX.writeFile(wb, `BBT_ปฐมนิเทศ_2569_ผลประเมิน_${U.today()}.xlsx`);
}

function bind() {
  $('key-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const locked = lockMessage();
    if (locked) {
      $('gate-message').textContent = locked;
      $('gate-message').className = 'small error';
      return;
    }
    const button = event.submitter;
    button.disabled = true;
    try {
      const key = $('master-key').value;
      if (await verify(key)) {
        sessionStorage.setItem(keyStore, key);
        await load(key);
      } else {
        wrongAttempt();
        $('gate-message').textContent = lockMessage() || 'Master Key ไม่ถูกต้อง';
        $('gate-message').className = 'small error';
      }
    } catch (error) {
      console.error(error);
      $('gate-message').textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
      $('gate-message').className = 'small error';
    } finally {
      button.disabled = false;
    }
  });
  $('excel').addEventListener('click', exportExcel);
  $('logout').addEventListener('click', () => {
    sessionStorage.removeItem(keyStore);
    location.reload();
  });
  $('hub-logout')?.addEventListener('click', () => {
    sessionStorage.removeItem(keyStore);
    location.reload();
  });
}

setupPasswordToggles();

if (initClient()) {
  bind();
  const saved = sessionStorage.getItem(keyStore);
  if (saved) load(saved).catch(() => sessionStorage.removeItem(keyStore));
}
