/**
 * AI Là Gián Điệp — app.js v3
 * ================================================
 * Modules:
 *   StorageManager  — đọc/ghi LocalStorage
 *   DataManager     — tải data.json, chọn keyword
 *   GameManager     — khởi tạo game, phân vai
 *   LogManager      — ghi nhật ký hoạt động (reset mỗi game)
 *   CardManager     — tạo và quản lý từng thẻ bài
 *   UIManager       — điều hướng màn hình, xử lý events
 * ================================================
 */

'use strict';

const NAME_CONFIG = [
  ['Tokyo', 'Hà Nội', 'Bangkok', 'Viêng Chăn', 'Singapore','Paris', 'London', 'New York', 'Sydney', 'Moscow'],
  ['Hà Nội', 'Vinh', 'Huế', 'Nha Trang', 'Sài Gòn', 'Cao Bằng', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng', 'Phú Quốc'],
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
];

/* ================================================================
   MODULE: StorageManager
   ================================================================ */
const StorageManager = (() => {
  const KEY = 'ai_la_gian_diep';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ..._default(), ...JSON.parse(raw) } : _default();
    } catch { return _default(); }
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { console.error('[Storage]', e); }
  }

  // Keyword history
  function getPlayedWords() { return load().playedWords || []; }

  function addPlayedWord(word) {
    const d = load();
    if (!d.playedWords.includes(word)) { d.playedWords.push(word); save(d); }
  }

  function resetPlayedWords() {
    const d = load(); d.playedWords = []; save(d);
  }

  // Settings
  function getSettings() { return load().settings || {}; }

  function saveSettings(s) {
    const d = load(); d.settings = { ...d.settings, ...s }; save(d);
  }

  // Game history
  function addGameHistory(record) {
    const d = load();
    d.gameHistory.unshift(record);
    if (d.gameHistory.length > 50) d.gameHistory = d.gameHistory.slice(0, 50);
    save(d);
  }

  function _default() {
    return {
      playedWords: [],
      gameHistory: [],
      settings: { spyCount: 1, whiteHatEnabled: false, whiteHatCount: 1 },
    };
  }

  return { getPlayedWords, addPlayedWord, resetPlayedWords, getSettings, saveSettings, addGameHistory };
})();


/* ================================================================
   MODULE: DataManager
   Schema: { civilian, spy, whitehat }
   whitehat field: null = Mũ Trắng không có keyword, string = có keyword
   ================================================================ */
const DataManager = (() => {
  let _cache = null;
  let _encodeMap = null;

  async function loadPairs() {
    if (_cache) return _cache;
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Không tải được data.json');
    const rawPairs = await res.json();
    const encodeRes = await fetch('encode.json');
    if (encodeRes.ok) {
      _encodeMap = await encodeRes.json();
    }
    _cache = _decodePairs(rawPairs);
    return _cache;
  }

  function _decodePairs(pairs) {
    if (!Array.isArray(pairs)) return [];
    return pairs.map(pair => {
      if (!pair || typeof pair !== 'object') return pair;
      const decoded = {};
      ['civilian', 'spy', 'whitehat'].forEach(key => {
        const value = pair[key];
        if (typeof value === 'string') {
          decoded[key] = _decodeString(value);
        } else {
          decoded[key] = value;
        }
      });
      return decoded;
    });
  }

  function _decodeString(value) {
    if (!value || typeof value !== 'string') return value;
    if (!_encodeMap || typeof _encodeMap !== 'object') return value;

    const decodeMap = Object.fromEntries(
      Object.entries(_encodeMap).map(([plainChar, encodedChar]) => [encodedChar, plainChar])
    );

    return value.split('').map(char => {
      if (Object.prototype.hasOwnProperty.call(decodeMap, char)) {
        return decodeMap[char];
      }
      return char;
    }).join('');
  }

  /**
   * Chọn ngẫu nhiên cặp từ khoá chưa chơi.
   * @param {string[]} played - mảng từ khoá civilian đã dùng
   * @returns {{ civilian, spy, whitehat } | null}
   */
  async function pickRandomPair(played = []) {
    const pairs = await loadPairs();
    const avail = pairs.filter(p => !played.includes(p.civilian));
    if (!avail.length) return null;
    return avail[Math.floor(Math.random() * avail.length)];
  }

  return { loadPairs, pickRandomPair };
})();


/* ================================================================
   MODULE: GameManager
   ================================================================ */
const GameManager = (() => {
  let _current = null;

  /**
   * @param {object} cfg
   * @param {string[]} cfg.players
   * @param {number}  cfg.spyCount
   * @param {number}  cfg.civilianCount
   * @param {boolean} cfg.whiteHatEnabled
   * @param {number}  cfg.whiteHatCount
   * @param {{ civilian, spy, whitehat }} cfg.keyword
   */
  function initGame({ players, spyCount, civilianCount, whiteHatEnabled, whiteHatCount, keyword }) {
    const roles = [];
    for (let i = 0; i < spyCount; i++)      roles.push('spy');
    for (let i = 0; i < civilianCount; i++) roles.push('civilian');
    if (whiteHatEnabled) {
      for (let i = 0; i < whiteHatCount; i++) roles.push('whitehat');
    }

    _shuffle(roles);

    const playerList = players.map((name, i) => {
      const role = roles[i];
      return { id: i, name, role, keyword: _kwFor(role, keyword) };
    });

    _current = { playerList, keyword, createdAt: Date.now() };
    return playerList;
  }

  /**
   * Keyword theo vai trò:
   *  - civilian  → keyword.civilian
   *  - spy       → keyword.spy
   *  - whitehat  → keyword.whitehat (có thể null)
   */
  function _kwFor(role, kw) {
    if (role === 'civilian') return kw.civilian;
    if (role === 'spy')      return kw.spy;
    // whitehat: nếu data có trường whitehat thì dùng, không thì null
    return kw.whitehat || null;
  }

  function _shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  function getCurrentGame() { return _current; }

  return { initGame, getCurrentGame };
})();


/* ================================================================
   MODULE: LogManager
   Nhật ký hoạt động trong một phiên game (reset khi game mới)
   ================================================================ */
const LogManager = (() => {
  let _el  = null; // ul#log-list
  // Đếm số lần unlock per player: { playerName: count }
  const _unlockCount    = {};
  // Đếm số lần "Lật tất cả"
  let _revealAllCount   = 0;

  function init(listEl) {
    _el = listEl;
    reset();
  }

  function reset() {
    if (_el) _el.innerHTML = '<li class="log-empty">Chưa có hoạt động.</li>';
    Object.keys(_unlockCount).forEach(k => delete _unlockCount[k]);
    _revealAllCount = 0;
  }

  /**
   * Ghi log: nhân vật X đã mở khoá N lần
   * @param {string} playerName
   */
  function logUnlock(playerName) {
    _unlockCount[playerName] = (_unlockCount[playerName] || 0) + 1;
    const n = _unlockCount[playerName];
    _add(`${playerName} đã mở khoá <strong>${n}</strong> lần`, 'log-unlock');
  }

  /**
   * Ghi log: đã click "Lật tất cả" X lần
   */
  function logRevealAll() {
    _revealAllCount++;
    _add(`Đã click "Lật tất cả" <strong>${_revealAllCount}</strong> lần`, 'log-reveal');
  }

  /**
   * Ghi log thông tin chung (màu vàng)
   * @param {string} msg
   */
  function logInfo(msg) {
    _add(msg, 'log-info');
  }

  function _add(html, cls = '') {
    if (!_el) return;
    // Xoá empty placeholder nếu còn
    const empty = _el.querySelector('.log-empty');
    if (empty) empty.remove();

    const li = document.createElement('li');
    li.className = `log-item ${cls}`;
    const now = new Date();
    const t   = `${_pad(now.getHours())}:${_pad(now.getMinutes())}:${_pad(now.getSeconds())}`;
    li.innerHTML = `${html}<span class="log-time">${t}</span>`;
    _el.prepend(li); // mới nhất lên đầu
  }

  function _pad(n) { return String(n).padStart(2, '0'); }

  return { init, reset, logUnlock, logRevealAll, logInfo };
})();


/* ================================================================
   MODULE: CardManager
   ================================================================ */
const CardManager = (() => {
  const _flipped = {}; // id → bool
  const _locked  = {}; // id → bool
  let   _players = []; // tham chiếu để tìm tên

  /**
   * Render toàn bộ lưới thẻ
   * @param {Element}  container
   * @param {object[]} players
   * @param {Function} onAllLocked - callback khi tất cả thẻ bị khoá
   */
  function renderCards(container, players, onAllLocked) {
    _players = players;
    container.innerHTML = '';
    Object.keys(_flipped).forEach(k => delete _flipped[k]);
    Object.keys(_locked).forEach(k => delete _locked[k]);

    players.forEach(p => {
      container.appendChild(_buildCard(p, onAllLocked));
    });
  }

  /** Lật tất cả thẻ chưa khoá */
  function flipAll() {
    document.querySelectorAll('.card-wrapper:not(.locked)').forEach(el => {
      const id = el.dataset.id;
      _flipped[id] = true;
      el.classList.add('flipped');
      _updateHideBtn(el, true);
    });
  }

  /** Ẩn tất cả thẻ chưa khoá */
  function hideAll() {
    document.querySelectorAll('.card-wrapper:not(.locked)').forEach(el => {
      const id = el.dataset.id;
      _flipped[id] = false;
      el.classList.remove('flipped');
      _updateHideBtn(el, false);
    });
  }

  /** Kiểm tra tất cả thẻ đã khoá chưa */
  function areAllLocked() {
    const wrappers = document.querySelectorAll('.card-wrapper');
    if (!wrappers.length) return false;
    return [...wrappers].every(el => el.classList.contains('locked'));
  }

  /* ── Builders ─────────────────────────────────────────── */

  function _buildCard(player, onAllLocked) {
    const id = player.id;

    const wrapper = document.createElement('div');
    wrapper.className = `card-wrapper role-${player.role}`;
    wrapper.dataset.id = id;

    // Lock icon overlay
    const lockIcon = document.createElement('span');
    lockIcon.className = 'card-lock-icon';
    lockIcon.textContent = '🔒';
    lockIcon.setAttribute('aria-hidden', 'true');

    // Inner (flippable)
    const inner = document.createElement('div');
    inner.className = 'card-inner';
    inner.setAttribute('role', 'button');
    inner.setAttribute('tabindex', '0');
    inner.setAttribute('aria-label', `Thẻ bài của ${player.name}`);
    inner.appendChild(_buildFront(player));
    inner.appendChild(_buildBack(player));

    inner.addEventListener('click', () => _handleFlip(wrapper, id));
    inner.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _handleFlip(wrapper, id); }
    });

    wrapper.appendChild(lockIcon);
    wrapper.appendChild(inner);

    // Controls (lock toggle + hide button)
    const controls = _buildControls(wrapper, player, id, onAllLocked);

    const group = document.createElement('div');
    group.className = 'card-group';
    group.appendChild(wrapper);
    group.appendChild(controls);

    return group;
  }

  function _buildFront(player) {
    const face = document.createElement('div');
    face.className = 'card-face card-front';
    face.innerHTML = `
      <div class="card-tap-icon">🃏</div>
      <div class="card-player-name">${_esc(player.name)}</div>
      <div class="card-tap-hint">Bấm để xem</div>`;
    return face;
  }

  function _buildBack(player) {
    const face = document.createElement('div');
    face.className = 'card-face card-back';

    const cfg = {
      spy:      { icon: '🕵️', label: 'Gián Điệp', cls: 'role-spy-text' },
      civilian: { icon: '👤', label: 'Dân Thường', cls: 'role-civilian-text' },
      whitehat: { icon: '🤍', label: 'Mũ Trắng',   cls: 'role-whitehat-text' },
    }[player.role];

    const kw = player.keyword
      ? `<div class="card-keyword-label">Từ khoá</div>
         <div class="card-keyword-value ${cfg.cls}">${_esc(player.keyword)}</div>`
      : `<div class="card-no-keyword">✦ Không có từ khoá ✦</div>`;

    face.innerHTML = `
      <div class="card-role-icon">${cfg.icon}</div>
      <div class="card-role-label">Vai trò</div>
      <div class="card-role-name ${cfg.cls}">${cfg.label}</div>
      ${kw}`;
    return face;
  }

  function _buildControls(wrapper, player, id, onAllLocked) {
    const bar = document.createElement('div');
    bar.className = 'card-controls';

    /* --- Bootstrap switch for lock --- */
    const switchWrap  = document.createElement('div');
    switchWrap.className = 'lock-switch-wrap form-check form-switch mb-0';

    const switchInput = document.createElement('input');
    switchInput.type      = 'checkbox';
    switchInput.className = 'form-check-input';
    switchInput.id        = `lock-switch-${id}`;
    switchInput.setAttribute('role', 'switch');

    const switchLabel = document.createElement('label');
    switchLabel.className = 'form-check-label';
    switchLabel.htmlFor   = `lock-switch-${id}`;
    switchLabel.textContent = 'Khoá thẻ';

    switchInput.addEventListener('change', () => {
      _handleLock(wrapper, id, player, switchInput.checked, onAllLocked);
    });

    switchWrap.appendChild(switchInput);
    switchWrap.appendChild(switchLabel);

    /* --- Hide button --- */
    const hideBtn = document.createElement('button');
    hideBtn.className       = 'card-hide-btn';
    hideBtn.dataset.cardId  = id;
    hideBtn.textContent     = '🙈 Ẩn';
    hideBtn.title           = 'Ẩn thông tin';
    hideBtn.style.display   = 'none';
    hideBtn.addEventListener('click', e => {
      e.stopPropagation();
      _flipped[id] = false;
      wrapper.classList.remove('flipped');
      hideBtn.style.display = 'none';
    });

    bar.appendChild(switchWrap);
    bar.appendChild(hideBtn);
    return bar;
  }

  /* ── Event handlers ────────────────────────────────────── */

  function _handleFlip(wrapper, id) {
    if (_locked[id]) return;
    _flipped[id] = !_flipped[id];
    wrapper.classList.toggle('flipped', _flipped[id]);
    _updateHideBtn(wrapper, _flipped[id]);
  }

  function _handleLock(wrapper, id, player, locked, onAllLocked) {
    _locked[id] = locked;
    wrapper.classList.toggle('locked', locked);

    if (locked) {
      // Khoá: ẩn thẻ nếu đang mở
      if (_flipped[id]) {
        _flipped[id] = false;
        wrapper.classList.remove('flipped');
        _updateHideBtn(wrapper, false);
      }
    } else {
      // Mở khoá: ghi log
      LogManager.logUnlock(player.name);
    }

    // Kiểm tra tất cả đã khoá
    if (locked && areAllLocked() && typeof onAllLocked === 'function') {
      // Delay nhỏ để animation hoàn thành
      setTimeout(onAllLocked, 300);
    }
  }

  function _updateHideBtn(wrapper, show) {
    const id  = wrapper.dataset.id;
    const grp = wrapper.closest('.card-group') || wrapper.parentElement;
    const btn = grp ? grp.querySelector(`.card-hide-btn[data-card-id="${id}"]`) : null;
    if (btn) btn.style.display = show ? 'inline-block' : 'none';
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { renderCards, flipAll, hideAll, areAllLocked };
})();


/* ================================================================
   MODULE: UIManager
   ================================================================ */
const UIManager = (() => {
  const $ = id => document.getElementById(id);

  /* -- Screen refs -- */
  const screenSetup = $('screen-setup');
  const screenGame  = $('screen-game');

  /* -- Setup form -- */
  const playersInput    = $('players-input');
  const playerCountDisp = $('player-count-display');
  const spyCountEl      = $('spy-count');
  const civilianCountEl = $('civilian-count');
  const whitehatToggle  = $('whitehat-toggle');
  const whitehatControl = $('whitehat-control');
  const whitehatCountEl = $('whitehat-count');
  const summaryText     = $('summary-text');
  const validationError = $('validation-error');
  const btnStart        = $('btn-start');
  const btnGenerateNames = $('btn-generate-names');
  const btnClearNames   = $('btn-clear-names');
  const btnResetHistory = $('btn-reset-history');
  const historyList     = $('history-list');

  /* -- Game screen -- */
  const btnNewGame      = $('btn-new-game');
  const btnRevealAll    = $('btn-reveal-all');
  const btnHideAll      = $('btn-hide-all');
  const btnShowKeywords = $('btn-show-keywords');
  const btnClearLog     = $('btn-clear-log');
  const cardsGrid       = $('cards-grid');
  const roundInfo       = $('round-info');
  const keywordBanner   = $('keyword-banner');
  const kwCivilianWord  = $('kw-civilian-word');
  const kwSpyWord       = $('kw-spy-word');
  const kwWhitehatWrap  = $('kw-whitehat-wrap');
  const kwWhitehatWord  = $('kw-whitehat-word');
  const logList         = $('log-list');

  /* -- Modals -- */
  const modalReset          = $('modal-reset');
  const modalResetConfirm   = $('modal-reset-confirm');
  const modalResetCancel    = $('modal-reset-cancel');
  const modalNewGame        = $('modal-new-game');
  const modalNewGameConfirm = $('modal-newgame-confirm');
  const modalNewGameCancel  = $('modal-newgame-cancel');
  const modalRevealKw       = $('modal-reveal-kw');
  const modalRevealYes      = $('modal-reveal-yes');
  const modalRevealNo       = $('modal-reveal-no');
  const modalFirstPlayer    = $('modal-first-player');
  const fpName              = $('fp-name');
  const modalFpClose        = $('modal-fp-close');
  const modalRevealLocked   = $('modal-reveal-locked');
  const modalLockedYes      = $('modal-locked-yes');
  const modalLockedNo       = $('modal-locked-no');

  /* -- Tab nav -- */
  const tabs   = document.querySelectorAll('.home-tab');
  const panels = document.querySelectorAll('.tab-panel');

  /** Khởi tạo toàn bộ event listeners */
  function init() {
    LogManager.init(logList);
    _loadSavedSettings();
    _renderHistory();

    /* ─ Tab navigation ─ */
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        $(`tab-${tab.dataset.tab}`).classList.add('active');
      });
    });

    /* ─ Setup form ─ */
    playersInput.addEventListener('input', _onPlayersInput);

    document.querySelectorAll('.num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const el  = $(btn.dataset.target);
        const op  = btn.dataset.op;
        let val   = parseInt(el.value) || 0;
        val = op === 'inc' ? val + 1 : val - 1;
        el.value  = Math.max(parseInt(el.min)||1, Math.min(parseInt(el.max)||99, val));
        _updateSummary();
      });
    });

    [spyCountEl, civilianCountEl, whitehatCountEl].forEach(el =>
      el.addEventListener('input', _updateSummary));

    whitehatToggle.addEventListener('change', () => {
      whitehatControl.style.display = whitehatToggle.checked ? 'flex' : 'none';
      _updateSummary();
    });

    btnStart.addEventListener('click', _onStartGame);
    btnGenerateNames.addEventListener('click', _onGenerateNames);
    btnClearNames.addEventListener('click', _onClearNames);

    /* ─ History ─ */
    btnResetHistory.addEventListener('click', () => {
      StorageManager.resetPlayedWords();
      _renderHistory();
    });

    /* ─ Game screen ─ */
    // Req #5: Game mới → confirm
    btnNewGame.addEventListener('click', () => _openModal(modalNewGame));
    modalNewGameConfirm.addEventListener('click', () => {
      _closeModal(modalNewGame);
      LogManager.reset();
      _showScreen(screenSetup);
    });
    modalNewGameCancel.addEventListener('click', () => _closeModal(modalNewGame));

    // Req #6: Lật tất cả → nếu tất cả locked thì hỏi confirm
    btnRevealAll.addEventListener('click', _onRevealAll);
    modalLockedYes.addEventListener('click', () => {
      _closeModal(modalRevealLocked);
      _doRevealAll();
    });
    modalLockedNo.addEventListener('click', () => _closeModal(modalRevealLocked));

    btnHideAll.addEventListener('click', () => CardManager.hideAll());

    // Req #2: Tiết lộ từ khoá → confirm
    btnShowKeywords.addEventListener('click', () => _openModal(modalRevealKw));
    modalRevealYes.addEventListener('click', () => {
      _closeModal(modalRevealKw);
      _doRevealKeywords();
    });
    modalRevealNo.addEventListener('click', () => _closeModal(modalRevealKw));

    /* ─ Log panel ─ */
    btnClearLog.addEventListener('click', () => LogManager.reset());

    /* ─ First player modal close ─ */
    modalFpClose.addEventListener('click', () => _closeModal(modalFirstPlayer));

    /* ─ Reset keywords modal ─ */
    modalResetConfirm.addEventListener('click', () => {
      StorageManager.resetPlayedWords();
      _renderHistory();
      _closeModal(modalReset);
      _onStartGame();
    });
    modalResetCancel.addEventListener('click', () => _closeModal(modalReset));

    /* ─ Close modals on overlay click ─ */
    [modalReset, modalNewGame, modalRevealKw, modalFirstPlayer, modalRevealLocked]
      .forEach(m => m.addEventListener('click', e => { if (e.target === m) _closeModal(m); }));

    _updateSummary();
    _syncGenerateButtonState();
  }

  /* ══ Setup handlers ══════════════════════════════════════════ */

  function _onPlayersInput() {
    playerCountDisp.textContent = _parseNames(playersInput.value).length;
    _updateSummary();
  }

  function _updateSummary() {
    const spy  = parseInt(spyCountEl.value)      || 0;
    const civ  = parseInt(civilianCountEl.value)  || 0;
    const wh   = whitehatToggle.checked ? (parseInt(whitehatCountEl.value)||0) : 0;
    const tot  = spy + civ + wh;
    let msg    = `Tổng: ${tot} người chơi (${spy} Gián điệp + ${civ} Dân`;
    if (wh) msg += ` + ${wh} Mũ Trắng`;
    summaryText.textContent = msg + ')';
    _syncGenerateButtonState(tot);
  }

  function _syncGenerateButtonState(total = null) {
    if (!btnGenerateNames) return;
    const required = total ?? _getRequiredPlayerCount();
    const maxSingleSetSize = Math.max(...NAME_CONFIG.map(set => set.filter(Boolean).length));
    const canGenerate = required > 0 && required <= 10 && required <= maxSingleSetSize;
    btnGenerateNames.disabled = !canGenerate;
    btnGenerateNames.classList.toggle('is-disabled', !canGenerate);
    if (btnGenerateNames.disabled) {
      btnGenerateNames.title = 'Chỉ có thể tự động tạo khi tổng số người chơi phù hợp với một bộ tên duy nhất';
    } else {
      btnGenerateNames.title = 'Tự động tạo danh sách người chơi';
    }
  }

  function _onGenerateNames() {
    validationError.style.display = 'none';
    const total = _getRequiredPlayerCount();

    if (total > 10) {
      _showError('Không thể tự động tạo danh sách khi tổng số người chơi vượt quá 10.');
      return;
    }

    const generated = generatePlayerNames(NAME_CONFIG, total);

    if (!generated.length) {
      _showError('Không đủ tên trong cấu hình để tạo danh sách cho số người này từ một bộ tên duy nhất.');
      return;
    }

    playersInput.value = generated.join('\n');
    playerCountDisp.textContent = generated.length;
    _updateSummary();
  }

  function _onClearNames() {
    playersInput.value = '';
    playerCountDisp.textContent = '0';
    validationError.style.display = 'none';
    _updateSummary();
  }

  async function _onStartGame() {
    validationError.style.display = 'none';

    const names = _parseNames(playersInput.value);
    const spy   = parseInt(spyCountEl.value)      || 0;
    const civ   = parseInt(civilianCountEl.value)  || 0;
    const wh    = whitehatToggle.checked ? (parseInt(whitehatCountEl.value)||0) : 0;
    const total = spy + civ + wh;

    // Validation
    if (!names.length)         { _showError('Vui lòng nhập ít nhất một tên người chơi.'); return; }
    if (total > 10)            { _showError('Tổng số người chơi tối đa là 10.'); return; }
    if (names.length !== total){ _showError(`Số tên (${names.length}) không khớp tổng vai trò (${total}).`); return; }
    if (spy < 1)               { _showError('Phải có ít nhất 1 Gián điệp.'); return; }
    if (civ < 1)               { _showError('Phải có ít nhất 1 Dân thường.'); return; }

    const duplicateNames = findDuplicateNames(names);
    if (duplicateNames.length) {
      _showError(`Tên trùng lặp không được phép: ${duplicateNames.join(', ')}`);
      return;
    }

    // Lưu settings
    StorageManager.saveSettings({ spyCount: spy, whiteHatEnabled: whitehatToggle.checked, whiteHatCount: wh });

    // Chọn keyword — lưu NGAY trước khi render (req #7)
    let pair;
    try { pair = await DataManager.pickRandomPair(StorageManager.getPlayedWords()); }
    catch { _showError('Không tải được data.json. Hãy chạy qua local server (http://).'); return; }

    if (!pair) { _openModal(modalReset); return; }

    // Lưu ngay khi click Bắt đầu (req #7)
    StorageManager.addPlayedWord(pair.civilian);
    _renderHistory(); // cập nhật ngay UI lịch sử

    // Khởi tạo game
    const players = GameManager.initGame({
      players: names, spyCount: spy, civilianCount: civ,
      whiteHatEnabled: whitehatToggle.checked, whiteHatCount: wh,
      keyword: pair,
    });

    _showGameScreen(players, pair, { spy, civ, wh });
  }

  /* ══ Game screen ═════════════════════════════════════════════ */

  function _showGameScreen(players, keyword, counts) {
    // Badges
    roundInfo.innerHTML =
      `<span class="badge spy">🕵️ ${counts.spy}</span>` +
      `<span class="badge civilian">👤 ${counts.civ}</span>` +
      (counts.wh ? `<span class="badge whitehat">🤍 ${counts.wh}</span>` : '');

    // Reset keyword banner
    keywordBanner.style.display = 'none';
    kwCivilianWord.textContent  = keyword.civilian;
    kwSpyWord.textContent       = keyword.spy;

    if (keyword.whitehat) {
      kwWhitehatWrap.style.display = 'inline';
      kwWhitehatWord.textContent   = keyword.whitehat;
    } else {
      kwWhitehatWrap.style.display = 'none';
    }

    btnShowKeywords.disabled    = false;
    btnShowKeywords.textContent = '⚠️ Tiết lộ từ khoá';

    // Reset log
    LogManager.reset();
    LogManager.logInfo(`Game bắt đầu — Từ khoá: <strong>${keyword.civilian}</strong>`);

    // Render cards; callback khi tất cả đã khoá → req #4
    CardManager.renderCards(cardsGrid, players, () => _onAllCardsLocked(players));

    _showScreen(screenGame);
  }

  /**
   * Req #4: Khi tất cả thẻ đã khoá → random người bắt đầu
   * Người bắt đầu KHÔNG phải Mũ Trắng
   */
  function _onAllCardsLocked(players) {
    const eligible = players.filter(p => p.role !== 'whitehat');
    if (!eligible.length) return; // tất cả là mũ trắng — hiếm gặp

    const chosen = eligible[Math.floor(Math.random() * eligible.length)];

    fpName.textContent = chosen.name;

    LogManager.logInfo(`🎲 Người bắt đầu: <strong>${chosen.name}</strong>`);
    _openModal(modalFirstPlayer);
  }

  /* ── Reveal all (req #6) ──────────────────────────────────── */

  function _onRevealAll() {
    if (CardManager.areAllLocked()) {
      _openModal(modalRevealLocked);
    } else {
      _doRevealAll();
    }
  }

  function _doRevealAll() {
    CardManager.flipAll();
    LogManager.logRevealAll();
  }

  /* ── Reveal keywords ──────────────────────────────────────── */

  function _doRevealKeywords() {
    keywordBanner.style.display = 'flex';
    btnShowKeywords.disabled    = true;
    btnShowKeywords.textContent = '✓ Đã tiết lộ';
    LogManager.logInfo('⚠️ Từ khoá đã được tiết lộ công khai');
  }

  /* ══ History ══════════════════════════════════════════════════ */

  function _renderHistory() {
    const played = StorageManager.getPlayedWords();
    if (!played.length) {
      historyList.innerHTML = '<p class="empty-hint">Chưa có từ khoá nào được chơi.</p>';
      return;
    }
    historyList.innerHTML = [...played].reverse()
      .map(w => `<span class="history-tag">${_esc(w)}</span>`)
      .join('');
  }

  /* ══ Helpers ══════════════════════════════════════════════════ */

  function _loadSavedSettings() {
    const s = StorageManager.getSettings();
    if (s.spyCount)        spyCountEl.value     = s.spyCount;
    if (s.whiteHatEnabled) { whitehatToggle.checked = true; whitehatControl.style.display = 'flex'; }
    if (s.whiteHatCount)   whitehatCountEl.value = s.whiteHatCount;
    _updateSummary();
  }

  function _getRequiredPlayerCount() {
    const spy = parseInt(spyCountEl.value) || 0;
    const civ = parseInt(civilianCountEl.value) || 0;
    const wh  = whitehatToggle.checked ? (parseInt(whitehatCountEl.value) || 0) : 0;
    return spy + civ + wh;
  }

  function _parseNames(raw) {
    return raw.split('\n').map(s => s.trim()).filter(Boolean);
  }

  function _showError(msg) {
    validationError.textContent    = '⚠ ' + msg;
    validationError.style.display  = 'block';
    validationError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function _openModal(m)  { m.style.display  = 'flex'; }
  function _closeModal(m) { m.style.display  = 'none'; }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init };
})();


/* ================================================================
   ENTRY POINT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => UIManager.init());
