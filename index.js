const S = window.SURVEY;
const U = window.SurveyUtil;
const submittedKey = 'bbt_orientation_2569_submitted';
const draftKey = 'bbt_orientation_2569_draft';
const unlockKey = 'bbt_orientation_2569_unlocked';
const adminKeyStore = 'bbt_orientation_2569_master_key';
const attemptsKey = 'bbt_orientation_2569_pin_attempts';
const lockKey = 'bbt_orientation_2569_pin_lock_until';
const sectionTitles = [
  'ข้อมูลทั่วไปของผู้ตอบแบบประเมิน',
  'ความพึงพอใจต่อการจัดโครงการ',
  'ความพึงพอใจรายวัน',
  'ความรู้ ความเข้าใจ และความพร้อมในการปฏิบัติงาน',
  'ความคิดเห็นและข้อเสนอแนะ'
];

let client = null;
let currentSection = 0;

function $(id) { return document.getElementById(id); }

function setupPasswordToggles() {
  document.querySelectorAll('.toggle-password').forEach((button) => {
    button.addEventListener('click', () => {
      const input = $(button.dataset.target);
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(isHidden));
      button.setAttribute('aria-label', isHidden ? 'ซ่อนรหัสเข้าร่วม' : 'แสดงรหัสเข้าร่วม');
      input.focus();
    });
  });
}

function initClient() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY.includes('PASTE_')) {
    $('config-error').classList.remove('hidden');
    $('config-error').textContent = 'ยังไม่ได้ตั้งค่า SUPABASE_ANON_KEY ใน config.js กรุณาใช้ anon/publishable key เท่านั้น ห้ามใช้ sb_secret key ในไฟล์ client';
    return false;
  }
  client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  return true;
}

function renderHeader() {
  $('page-title').textContent = S.title;
  $('page-subtitle').textContent = S.subtitle;
  $('page-meta').textContent = `${S.eventDate} | ${S.venue}`;
  $('anonymity-note').textContent = S.anonymity;
  ['legend-1', 'legend-2', 'legend-3'].forEach((id) => { $(id).textContent = S.legend; });
}

function rating(section, key, label) {
  const name = `${section}_${key}`;
  return `<div class="rating-item" data-rating="${name}">
    <div>${U.html(label)}</div>
    <div class="rating-row">${[5, 4, 3, 2, 1].map((value) => `
      <label class="rating-choice"><input type="radio" name="${name}" value="${value}"> ${value}</label>
    `).join('')}</div>
  </div>`;
}

function renderForm() {
  $('role-options').innerHTML = S.roleOptions.map((role) => `
    <label class="choice"><input type="radio" name="role" value="${U.html(role)}"> ${U.html(role)}</label>
  `).join('');

  $('s2-container').innerHTML = S.s2Groups.map((group, index) => `
    <h3>${index + 1}. ${U.html(group.title)}</h3>
    ${group.items.map(([key, label]) => rating('s2', key, label)).join('')}
  `).join('');
  $('s3-container').innerHTML = S.s3Items.map(([key, label]) => rating('s3', key, label)).join('');
  $('s4-container').innerHTML = S.s4Items.map(([key, label]) => rating('s4', key, label)).join('');
  $('s5-container').innerHTML = S.s5Items.map(([key, label]) => `
    <div class="field full">
      <label for="s5_${key}">${U.html(label)}</label>
      <textarea id="s5_${key}" name="s5_${key}"></textarea>
    </div>
  `).join('');
}

function showForm() {
  $('pin-card').classList.add('hidden');
  $('admin-panel')?.classList.add('hidden');
  $('survey-form').classList.remove('hidden');
  setSection(currentSection, { scroll: false });
}

function showAdminPanel() {
  $('pin-card').classList.add('hidden');
  $('survey-form').classList.add('hidden');
  $('admin-panel')?.classList.remove('hidden');
}

function lockMessage() {
  const until = Number(sessionStorage.getItem(lockKey) || 0);
  if (until > Date.now()) {
    const minutes = Math.ceil((until - Date.now()) / 60000);
    return `กรุณาลองใหม่อีกครั้งใน ${minutes} นาที`;
  }
  return '';
}

async function verifyPin(pin) {
  const { data, error } = await client.rpc('verify_survey_pin', { p_survey_id: window.SURVEY_ID, p_pin: pin });
  if (error) throw error;
  return data === true;
}

async function verifyMasterKey(key) {
  const { data, error } = await client.rpc('verify_master_key', { p_survey_id: window.SURVEY_ID, p_key: key });
  if (error) throw error;
  return data === true;
}

function recordWrongPin() {
  const attempts = Number(sessionStorage.getItem(attemptsKey) || 0) + 1;
  sessionStorage.setItem(attemptsKey, String(attempts));
  if (attempts >= 5) {
    sessionStorage.setItem(lockKey, String(Date.now() + 5 * 60 * 1000));
    sessionStorage.setItem(attemptsKey, '0');
  }
}

function readRating(section, key) {
  const checked = document.querySelector(`input[name="${section}_${key}"]:checked`);
  return checked ? Number(checked.value) : null;
}

function clearMissing() {
  document.querySelectorAll('.missing').forEach((el) => el.classList.remove('missing'));
}

function addMissing(selector, missing, key) {
  document.querySelector(selector)?.classList.add('missing');
  missing.push(key);
}

function sectionMetricItems(index) {
  if (index === 1) return S.s2Groups.flatMap((group) => group.items).map(([key]) => ({ section: 's2', key }));
  if (index === 2) return S.s3Items.map(([key]) => ({ section: 's3', key }));
  if (index === 3) return S.s4Items.map(([key]) => ({ section: 's4', key }));
  return [];
}

function missingForSection(index, mark) {
  if (mark) clearMissing();
  const missing = [];
  if (index === 0) {
    ['gender', 'role'].forEach((name) => {
      if (!document.querySelector(`input[name="${name}"]:checked`)) {
        if (mark) addMissing(`[data-field="${name}"]`, missing, name);
        else missing.push(name);
      }
    });
    ['age', 'graduation_year'].forEach((id) => {
      if (!$(id).value) {
        if (mark) addMissing(`[data-field="${id}"]`, missing, id);
        else missing.push(id);
      }
    });
  }
  sectionMetricItems(index).forEach((item) => {
    if (readRating(item.section, item.key) === null) {
      const key = `${item.section}_${item.key}`;
      if (mark) addMissing(`[data-rating="${key}"]`, missing, key);
      else missing.push(key);
    }
  });
  return missing;
}

function validateSection(index) {
  const missing = missingForSection(index, true);
  if (missing.length) {
    $('validation-message').textContent = `กรุณาตอบคำถามที่เหลือ ${missing.length} ข้อ`;
    document.querySelector('.missing')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  $('validation-message').textContent = '';
  return true;
}

function validate() {
  for (let index = 0; index < sectionTitles.length; index += 1) {
    if (missingForSection(index, false).length) {
      setSection(index);
      return validateSection(index);
    }
  }
  clearMissing();
  $('validation-message').textContent = '';
  return true;
}

function sectionComplete(index) {
  return missingForSection(index, false).length === 0;
}

function renderProgress() {
  $('section-progress').innerHTML = sectionTitles.map((title, index) => {
    const state = index === currentSection ? 'is-current' : (sectionComplete(index) ? 'is-complete' : '');
    const label = sectionComplete(index) ? `✓ ส่วนที่ ${index + 1}` : `ส่วนที่ ${index + 1}`;
    return `<li class="${state}" aria-current="${index === currentSection ? 'step' : 'false'}" title="${U.html(title)}">${label}</li>`;
  }).join('');
}

function setSection(index, options = {}) {
  const { scroll = true } = options;
  currentSection = Math.max(0, Math.min(sectionTitles.length - 1, index));
  document.querySelectorAll('.survey-section').forEach((section, sectionIndex) => {
    section.hidden = sectionIndex !== currentSection;
  });
  $('progress-count').textContent = `ส่วนที่ ${currentSection + 1} จาก ${sectionTitles.length}`;
  $('progress-title').textContent = sectionTitles[currentSection];
  $('previous-section').disabled = currentSection === 0;
  $('next-section').classList.toggle('hidden', currentSection === sectionTitles.length - 1);
  $('submit-button').classList.toggle('hidden', currentSection !== sectionTitles.length - 1);
  $('validation-message').textContent = '';
  clearMissing();
  renderProgress();
  saveDraft();
  if (scroll) $('survey-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function collectDraft() {
  const draft = { currentSection, fields: {}, radios: {} };
  document.querySelectorAll('#survey-form input, #survey-form textarea').forEach((field) => {
    if (field.type === 'radio') {
      if (field.checked) draft.radios[field.name] = field.value;
      return;
    }
    draft.fields[field.id || field.name] = field.value;
  });
  return draft;
}

function saveDraft() {
  if (!$('survey-form') || localStorage.getItem(submittedKey)) return;
  try {
    localStorage.setItem(draftKey, JSON.stringify(collectDraft()));
    if ($('draft-status')) $('draft-status').textContent = 'บันทึกคำตอบไว้ในเครื่องนี้แล้ว';
  } catch (error) {
    if ($('draft-status')) $('draft-status').textContent = 'ไม่สามารถบันทึกคำตอบในเครื่องนี้ได้';
  }
}

function restoreDraft() {
  const raw = localStorage.getItem(draftKey);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    Object.entries(draft.fields || {}).forEach(([id, value]) => {
      const field = $(id);
      if (field) field.value = value;
    });
    Object.entries(draft.radios || {}).forEach(([name, value]) => {
      document.querySelectorAll('#survey-form input[type="radio"]').forEach((field) => {
        if (field.name === name && field.value === value) field.checked = true;
      });
    });
    if (Number.isInteger(draft.currentSection)) currentSection = draft.currentSection;
    if ($('draft-status')) $('draft-status').textContent = 'กู้คืนคำตอบที่บันทึกไว้ในเครื่องนี้แล้ว';
  } catch (error) {
    localStorage.removeItem(draftKey);
  }
}

function payload() {
  return {
    demographics: {
      gender: document.querySelector('input[name="gender"]:checked').value,
      age: Number($('age').value),
      role: document.querySelector('input[name="role"]:checked').value,
      institution: $('institution').value.trim() || null,
      graduation_year: Number($('graduation_year').value)
    },
    s2: Object.fromEntries(S.s2Groups.flatMap((group) => group.items).map(([key]) => [key, readRating('s2', key)])),
    s3: Object.fromEntries(S.s3Items.map(([key]) => [key, readRating('s3', key)])),
    s4: Object.fromEntries(S.s4Items.map(([key]) => [key, readRating('s4', key)])),
    s5: Object.fromEntries(S.s5Items.map(([key]) => [key, $(`s5_${key}`).value.trim()]))
  };
}

function bind() {
  $('previous-section').addEventListener('click', () => setSection(currentSection - 1));
  $('next-section').addEventListener('click', () => {
    if (validateSection(currentSection)) setSection(currentSection + 1);
  });
  $('survey-form').addEventListener('input', saveDraft);
  $('survey-form').addEventListener('change', () => {
    saveDraft();
    renderProgress();
  });

  $('pin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const locked = lockMessage();
    if (locked) {
      $('pin-message').textContent = locked;
      $('pin-message').className = 'small error';
      return;
    }
    const button = event.submitter;
    button.disabled = true;
    $('pin-message').textContent = '';
    try {
      const key = $('pin').value;
      if (await verifyPin(key)) {
        sessionStorage.setItem(unlockKey, '1');
        sessionStorage.removeItem(attemptsKey);
        showForm();
      } else if (await verifyMasterKey(key)) {
        sessionStorage.setItem(adminKeyStore, key);
        $('pin').value = '';
        sessionStorage.removeItem(attemptsKey);
        showAdminPanel();
      } else {
        recordWrongPin();
        $('pin-message').textContent = lockMessage() || 'รหัสไม่ถูกต้อง';
        $('pin-message').className = 'small error';
      }
    } catch (error) {
      console.error(error);
      $('pin-message').textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
      $('pin-message').className = 'small error';
    } finally {
      button.disabled = false;
    }
  });

  $('admin-panel-logout').addEventListener('click', () => {
    sessionStorage.removeItem(adminKeyStore);
    $('admin-panel').classList.add('hidden');
    $('pin-card').classList.remove('hidden');
  });

  $('survey-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validate()) return;
    const button = $('submit-button');
    button.disabled = true;
    button.textContent = 'กำลังส่ง...';
    try {
      const { error } = await client.from('orientation_responses_2569').insert({ payload: payload() });
      if (error) throw error;
      localStorage.setItem(submittedKey, new Date().toISOString().slice(0, 10));
      localStorage.removeItem(draftKey);
      $('survey-form').classList.add('hidden');
      $('thank-you').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error(error);
      $('validation-message').textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
      button.disabled = false;
      button.textContent = 'ส่งแบบประเมิน';
    }
  });
}

setupPasswordToggles();
renderHeader();
renderForm();
if (localStorage.getItem(submittedKey)) {
  localStorage.removeItem(draftKey);
  $('pin-card').classList.add('hidden');
  $('already-submitted').classList.remove('hidden');
} else if (initClient()) {
  restoreDraft();
  setSection(currentSection, { scroll: false });
  bind();
  if (sessionStorage.getItem(adminKeyStore)) showAdminPanel();
  if (sessionStorage.getItem(unlockKey) === '1') showForm();
}
