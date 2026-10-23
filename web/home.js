/*
 * The home screen for web-app TVs (LG webOS, Samsung Tizen), with the Android app's design and behavior (HomeView):
 *  - top: the "For You" title and the tabs (Explore, Movies, Shows); icon-only glass buttons at the right (Live TV,
 *    HDMI Inputs, Settings) and the crypto quotes at the end of the tab row;
 *  - three picks for this hour in the selected tab; the background is the first one's photo, blurred and almost white;
 *  - the glass shelf with the apps; ↓ opens the drawer (inputs, shortcuts, weather, prices); ↑ or Back closes it;
 *  - a night look from sunset to sunrise; a screensaver after a few idle minutes.
 * The remote's arrows, OK and Back move the focus; a pointer (LG's Magic Remote) focuses what it points at.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function sym(name, parent, size) {
    var s = el('span', 'sym', parent);
    s.style.webkitMaskImage = 'url(symbols/' + name + '.png)';
    s.style.maskImage = 'url(symbols/' + name + '.png)';
    if (size) { s.style.width = size + 'px'; s.style.height = size + 'px'; }
    return s;
  }

  function coin(i, parent) {
    var c = window.COINS && window.COINS[i];
    if (!c) return;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    for (var k = 0; k < c.length; k++) {
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', c[k]);
      p.setAttribute('fill-rule', 'evenodd');
      svg.appendChild(p);
    }
    parent.appendChild(svg);
  }

  function hasClass(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function setClass(e, c, on) {
    if (!e) return;
    if (on && !hasClass(e, c)) e.className = (e.className + ' ' + c).replace(/^\s+/, '');
    else if (!on && hasClass(e, c)) e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  var stage = $('stage'), body = document.body;

  /** The 1920 × 1080 stage fills the window (on the TV it already is 1920 × 1080). */
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.webkitTransform = stage.style.transform = s === 1 ? '' : 'scale(' + s + ')';
  }

  // MARK: - Apps on the shelf

  /** Shelf apps in this order when installed, like the Android app: key, LG app id, name on the TV, brand gradient. */
  var SHELF = [
    ['stremio', /stremio/, /stremio/i, ['#7B5BF5', '#3D2A9E']],
    ['netflix', /^netflix$/, /netflix/i, ['#0A0A0A', '#000000']],
    ['max', /hbo|wbd/, /^(hbo )?max$|hbo max/i, ['#5C30E8', '#221684']],
    ['appletv', /appletv|apple\.tv/, /apple tv/i, ['#1C1C1E', '#000000']],
    ['prime', /^amazon$/, /prime video/i, ['#2AA8FF', '#0A68D4']],
    ['spotify', /spotify/, /spotify/i, ['#1DB954', '#0F7A36']],
    ['youtube', /youtube/, /^youtube$/i, ['#1C1C1E', '#09090A']],
    ['disney', /disney/, /disney/i, ['#173584', '#08143F']],
    ['hulu', /^hulu/, /hulu/i, ['#1CE783', '#0B8F4E']],
    ['paramount', /paramount|cbs/, /paramount/i, ['#0064FF', '#002A86']],
    ['peacock', /peacock/, /peacock/i, ['#1C1C1E', '#000000']],
    ['nfl', /nfl/, /^nfl/i, ['#013369', '#00163D']],
    ['globoplay', /globoplay/, /globoplay/i, ['#FF8A1F', '#FF2D5A']],
    ['jellyfin', /jellyfin/i, /jellyfin/i, ['#AA5CC3', '#00A4DC']]
  ];
  var MAX_SHELF = 8;

  function shelfKey(app) {
    for (var i = 0; i < SHELF.length; i++) if (SHELF[i][1].test(app.id) || SHELF[i][2].test(app.title)) return SHELF[i];
    return null;
  }

  function darken(hex, f) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#161618';
    var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')';
  }

  /** A name that fits the tile on one line (the font shrinks for long names). */
  function wordFit(title, width, max) {
    return Math.max(18, Math.min(max, Math.floor(width * 0.8 / (Math.max(4, title.length) * 0.56))));
  }

  /** An app's face: its own icon on its brand color (or its name, when the icon can't be read). */
  function face(app, box, wordSize) {
    var k = shelfKey(app);
    var top = k ? k[3][0] : app.color ? darken(app.color, 0.92) : '#2A2A2E';
    var bottom = k ? k[3][1] : app.color ? darken(app.color, 0.62) : '#161618';
    box.style.background = '-webkit-linear-gradient(top, ' + top + ', ' + bottom + ')';
    box.style.background = 'linear-gradient(' + top + ', ' + bottom + ')';
    var word = el('div', 'word', box, app.title);
    if (wordSize) word.style.fontSize = wordSize + 'px';
    if (app.icon) {
      var img = el('img', '', box);
      word.style.visibility = 'hidden';
      img.onerror = function () { img.parentNode.removeChild(img); word.style.visibility = ''; };
      img.src = app.icon;
    }
  }

  var apps = [], shelf = [], others = [], inputs = [];

  function pickShelf() {
    var chosen = Prefs.shelf(), out = [];
    if (chosen) {
      for (var i = 0; i < chosen.length && out.length < MAX_SHELF; i++) {
        for (var j = 0; j < apps.length; j++) if (apps[j].id === chosen[i]) out.push(apps[j]);
      }
    } else {
      for (var s = 0; s < SHELF.length && out.length < MAX_SHELF; s++) {
        for (var a = 0; a < apps.length; a++) {
          if ((SHELF[s][1].test(apps[a].id) || SHELF[s][2].test(apps[a].title)) && out.indexOf(apps[a]) < 0) { out.push(apps[a]); break; }
        }
      }
      if (!out.length) out = apps.slice(0, MAX_SHELF);
    }
    shelf = out;
    others = apps.filter(function (x) { return shelf.indexOf(x) < 0; });
  }

  // MARK: - Focus

  var Z = {TOP: 'top', CARDS: 'cards', SHELF: 'shelf', DRAWER: 'drawer', APPS: 'apps', SETTINGS: 'settings', EDIT: 'edit', LANG: 'lang'};
  var st = {zone: Z.SHELF, top: 0, tab: 0, card: 0, shelf: 0, drawer: 0, grid: 0, row: 0, edit: 0, lang: 0};
  var cards = [];

  function sheetOpen() { return st.zone === Z.APPS || st.zone === Z.SETTINGS || st.zone === Z.EDIT || st.zone === Z.LANG; }

  function updateFocus() {
    var i, list;
    list = $('tabs').children;
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'on', i === st.tab);
      setClass(list[i], 'focus', st.zone === Z.TOP && st.top === i);
    }
    list = $('buttons').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.TOP && st.top === 3 + i);
    setClass($('quotes'), 'hide', st.zone === Z.TOP && st.top >= 3);
    list = $('cards').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.CARDS && st.card === i);
    list = $('tiles').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.SHELF && st.shelf === i);
    list = document.querySelectorAll('#drawer .key');
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.DRAWER && st.drawer === i);
    list = document.querySelectorAll('#apps .cell');
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.APPS && st.grid === i);
    var rows = Math.max(1, Math.ceil(others.length / 5)), r = Math.floor(st.grid / 5), first = Math.max(0, Math.min(rows - 3, r - 1));
    $('apps').lastChild.style.webkitTransform = $('apps').lastChild.style.transform = 'translateY(' + (-first * 239) + 'px)';
    focusRows($('settings'), st.row, st.zone === Z.SETTINGS);
    focusRows($('shelfedit'), st.edit, st.zone === Z.EDIT);
    focusRows($('langpick'), st.lang, st.zone === Z.LANG);
    if (langHint) langHint.textContent = (st.lang + 1) + ' / ' + languageChoices().length + '  ·  ' + tr('OK picks, Back cancels.');
    setClass(body, 'drawer-open', st.zone === Z.DRAWER);
  }

  function focusRows(sheet, index, on) {
    var rows = sheet.querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) setClass(rows[i], 'focus', on && i === index);
    var holder = sheet.querySelector('.rows');
    if (!holder) return;
    var visible = 7, first = Math.max(0, Math.min(rows.length - visible, index - 3));
    holder.style.webkitTransform = holder.style.transform = 'translateY(' + (-first * 78) + 'px)';
  }

  function nearest(nodes, x) {
    var best = 0, bestD = 1e9;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect(), d = Math.abs((r.left + r.right) / 2 - x);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function centerX(node) {
    if (!node) return 960;
    var r = node.getBoundingClientRect();
    return (r.left + r.right) / 2;
  }

  // MARK: - Top: title, tabs, buttons, quotes

  var TAB_KIND = [null, 'movie', 'tv'];

  /** The title: a greeting for the time of day, with the person's name when config.properties has one. */
  function greet() {
    var h = new Date().getHours();
    var hello = h >= 5 && h < 12 ? tr('Good morning') : h >= 12 && h < 18 ? tr('Good afternoon') : tr('Good evening');
    var text = CONFIG.userName ? hello + ', ' + CONFIG.userName : hello;
    var title = $('title');
    if (title.textContent !== text) title.textContent = text;
  }

  function renderTop() {
    greet();
    var tabs = $('tabs');
    tabs.innerHTML = '';
    var names = [tr('Explore'), tr('Movies'), tr('Shows')];
    for (var i = 0; i < 3; i++) {
      var t = el('button', 'tab', tabs, names[i]);
      hover(t, Z.TOP, i);
    }
    var buttons = $('buttons');
    buttons.innerHTML = '';
    var defs = [['live_tv', tr('light|Live TV')], ['hdmi', tr('HDMI Inputs')], ['settings', tr('light|Settings')]];
    for (var b = 0; b < 3; b++) {
      var r = el('button', 'round' + (b === 2 ? ' last' : ''), buttons);
      r.style.left = (1596 + 88 * b) + 'px';
      sym(defs[b][0], r);
      el('div', 'tip', r, defs[b][1]);
      hover(r, Z.TOP, 3 + b);
    }
  }

  function renderQuotes() {
    var q = $('quotes'), coins = Data.activeCoins();
    q.innerHTML = '';
    for (var i = 0; i < coins.length; i++) {
      var item = el('span', 'q', q);
      coin(coins[i], item);
      el('span', '', item, Data.compact(Data.prices[coins[i]]));
    }
  }

  // MARK: - Picks and background

  function renderCards() {
    var list = Data.picks(TAB_KIND[st.tab]);
    var holder = $('cards');
    setClass(body, 'no-picks', !list.length);
    var same = list.length === cards.length;
    for (var i = 0; same && i < list.length; i++) same = list[i].id === cards[i].id && list[i].backdrop === cards[i].backdrop && list[i].meta === cards[i].meta;
    if (same && holder.children.length === list.length) return;
    cards = list;
    holder.innerHTML = '';
    var rects = [[80, 1040], [1160, 320], [1520, 320]];
    for (var c = 0; c < list.length; c++) {
      var p = list[c], card = el('div', 'card', holder);
      card.style.left = rects[c][0] + 'px';
      card.style.width = rects[c][1] + 'px';
      var img = el('div', 'img', card);
      img.style.backgroundImage = 'url(' + Data.image(p.backdrop, c === 0 ? 'w1280' : 'w780') + ')';
      el('div', 'name', card, p.title);
      if (c === 0 && p.meta) el('div', 'meta', card, p.meta);
      hover(card, Z.CARDS, c);
    }
    st.card = Math.min(st.card, Math.max(0, list.length - 1));
    if (!list.length && st.zone === Z.CARDS) st.zone = Z.SHELF;
    backdrop(list.length ? Data.image(list[0].backdrop, 'w300') : '');
    updateFocus();
  }

  var bgUrl = null, bgFront = 'bgA';

  /** The first pick's photo as the background: drawn tiny and stretched, it's already as soft as a heavy blur. */
  function backdrop(url) {
    if (url === bgUrl) return;
    bgUrl = url;
    var next = bgFront === 'bgA' ? 'bgB' : 'bgA';
    if (!url) {
      setClass($('bgA'), 'on', false);
      setClass($('bgB'), 'on', false);
      return;
    }
    var img = new Image();
    img.onload = function () {
      if (bgUrl !== url) return;
      var canvas = $(next), ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setClass(canvas, 'on', true);
      setClass($(bgFront), 'on', false);
      bgFront = next;
    };
    img.src = url;
  }

  function renderClock() {
    var d = new Date(), c = $('clock');
    c.firstChild.textContent = formatDate('format|h:mm', d.getTime());
    c.lastChild.textContent = formatDate('format|EEEE, MMMM d', d.getTime());
    greet();
  }

  // MARK: - Shelf

  function renderShelf() {
    var n = shelf.length, gap = 48, pad = 40;
    // 16:9 tiles, as on Android: never taller than 126, and the glass keeps its bottom edge.
    var tw = Math.min(126 * 16 / 9, (1760 - Math.max(0, n - 1) * gap) / Math.max(1, n)), th = tw * 9 / 16;
    var width = n * tw + Math.max(0, n - 1) * gap, left = (1920 - width) / 2;
    var platter = $('platter');
    platter.style.display = n ? '' : 'none';
    platter.style.left = (left - pad) + 'px';
    platter.style.width = (width + 2 * pad) + 'px';
    platter.style.top = (814 + 126 - th) + 'px';
    platter.style.height = (th + 2 * pad) + 'px';
    $('quotes').style.right = (1920 - left - width) + 'px';
    var tiles = $('tiles');
    tiles.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var t = el('div', 'tile', tiles);
      t.style.left = (left + i * (tw + gap)) + 'px';
      t.style.top = (854 + 126 - th) + 'px';
      t.style.width = tw + 'px';
      t.style.height = th + 'px';
      face(shelf[i], t, wordFit(shelf[i].title, tw, 30));
      hover(t, Z.SHELF, i);
    }
    st.shelf = Math.min(st.shelf, Math.max(0, n - 1));
  }

  // MARK: - Drawer

  var drawerItems = [], drawerInputs = 0;

  function renderDrawer() {
    var d = $('drawer');
    d.innerHTML = '';
    drawerItems = [];
    for (var i = 0; i < inputs.length; i++) {
      var x = inputs[i];
      drawerItems.push({label: x.label || tr('Live TV'), symbol: x.symbol, off: !x.connected, run: launcher(x.id, x.label)});
    }
    drawerInputs = drawerItems.length;
    drawerItems.push({label: tr('All Apps'), symbol: 'apps', run: openApps});
    drawerItems.push({label: tr('Home Settings'), symbol: 'settings', run: openSettings});
    drawerItems.push({label: tr('TV Settings'), symbol: 'tv_settings', run: tvSettings});
    var n = drawerItems.length, gap = 18, groupGap = 56, groups = drawerInputs > 0 && drawerInputs < n ? 2 : 1;
    var tw = Math.min(230, (1760 - Math.max(0, n - groups) * gap - (groups - 1) * groupGap) / Math.max(1, n));
    var xPos = 80;
    for (var k = 0; k < n; k++) {
      if (k === drawerInputs && k > 0) {
        xPos += groupGap - gap;
        el('div', 'row-title', d, tr('Shortcuts')).style.left = (xPos + 4) + 'px';
      }
      if (k === 0 && drawerInputs) el('div', 'row-title', d, tr('Inputs')).style.left = '84px';
      var item = drawerItems[k], key = el('div', 'key glass' + (item.off ? ' off' : ''), d);
      key.style.left = xPos + 'px';
      key.style.width = tw + 'px';
      sym(item.symbol, key);
      el('div', 'label', key, item.label);
      hover(key, Z.DRAWER, k);
      xPos += tw + gap;
    }
    renderPanels();
    updateFocus();
  }

  function renderPanels() {
    var d = $('drawer');
    var old = d.querySelectorAll('.panel');
    for (var o = 0; o < old.length; o++) d.removeChild(old[o]);
    var wx = Prefs.weather(), coins = Data.activeCoins(), qt = coins.length > 0, sy = Prefs.system();
    var n = (wx ? 1 : 0) + (qt ? 1 : 0) + (sy ? 1 : 0);
    // Widths of the cards in the row (weather, prices, system), 16 px apart, inside 1760 px.
    var widths = n === 3 ? [780, 470, 478] : n === 2 ? (wx ? [1030, 714] : [880, 864]) : [1760];
    var x = 80, at = 0;
    function panel(id, render) {
      var p = el('div', 'panel glass', d);
      p.id = id;
      p.style.left = x + 'px';
      p.style.width = widths[at] + 'px';
      x += widths[at++] + 16;
      render(p);
    }
    if (wx) panel('weather', renderWeather);
    if (qt) panel('prices', function (p) { renderPrices(p, coins); });
    if (sy) panel('system', renderSystem);
    if (!sy) stopSystem();
  }

  // MARK: - System card: the TV's CPU, memory, screen and model

  var sysInfo = null, sysAsked = false, sysLoad = {}, sysTimer = 0, sysRefs = {};

  function sysRow(card, top, name, bar) {
    var row = el('div', 'srow', card);
    row.style.top = top + 'px';
    el('span', 'k', row, name);
    var fill = null;
    if (bar) fill = el('i', '', el('span', 'bar', row));
    return {v: el('span', 'v', row), bar: fill};
  }

  function renderSystem(card) {
    el('div', 'head', card, tr('This TV'));
    sysRefs = {side: el('div', 'side', card),
      cpu: sysRow(card, 78, tr('CPU'), true), mem: sysRow(card, 120, tr('Memory'), true),
      screen: sysRow(card, 162, tr('Display'), false), model: sysRow(card, 204, tr('Model'), false),
      os: sysRow(card, 246, tr('System'), false)};
    if (!sysAsked) {
      sysAsked = true;
      TV.info(function (i) { sysInfo = i; paintSystem(); });
    }
    paintSystem();
  }

  function level(fill, f) {
    fill.style.webkitTransform = fill.style.transform = 'scaleX(' + Math.max(0.02, Math.min(1, f)) + ')';
    fill.className = f > 0.85 ? 'hot' : f > 0.6 ? 'warm' : '';
  }

  function paintSystem() {
    var r = sysRefs, i = sysInfo || {}, l = sysLoad;
    if (!r.cpu || !r.cpu.v.parentNode) return;
    var cpu = typeof l.cpu === 'number';
    r.cpu.v.textContent = cpu ? Math.round(l.cpu * 100) + '%' : '–';
    level(r.cpu.bar, cpu ? l.cpu : 0);
    if (l.heap) {
      r.mem.v.textContent = Math.round(l.heap.used) + ' MB';
      level(r.mem.bar, l.heap.used / l.heap.limit);
    } else {
      r.mem.v.textContent = i.memory ? '≈ ' + i.memory + ' GB' : '–';
      level(r.mem.bar, 0);
    }
    r.screen.v.textContent = [i.screen, i.panel].filter(Boolean).join(' · ') || '–';
    r.model.v.textContent = i.model || '–';
    r.os.v.textContent = [i.os, i.cores ? trf('{n} cores', {n: i.cores}) : ''].filter(Boolean).join(' · ') || '–';
    r.side.textContent = i.network === 'WIFI' ? 'Wi-Fi' : i.network === 'ETHERNET' ? 'Ethernet' : '';
  }

  /** The load is read every 2 s, only while the drawer is open. */
  function startSystem() {
    stopSystem();
    if (!Prefs.system()) return;
    function poll() { TV.load(function (v) { sysLoad = v; paintSystem(); }); }
    poll();
    sysTimer = setInterval(poll, 2000);
  }

  function stopSystem() {
    if (sysTimer) { clearInterval(sysTimer); sysTimer = 0; }
  }

  function renderWeather(card) {
    el('div', 'head', card, Data.city || tr('Weather'));
    var w = Data.weather;
    if (!w) {
      el('div', 'cond', card, tr('No weather data right now.')).style.top = '96px';
      return;
    }
    var now = el('div', 'now', card);
    sym(Data.symbol(w.code, w.isDay), now);
    el('span', 'temp', now, Data.degrees(w.temp));
    el('div', 'cond', card, Data.condition(w.code, w.isDay));
    el('div', 'range', card, trf('H:{max}', {max: Data.degrees(w.max)}) + '   ' + trf('L:{min}', {min: Data.degrees(w.min)}));
    el('div', 'split', card);
    var narrow = parseFloat(card.style.width) < 900, count = narrow ? 4 : 6;
    var hours = el('div', 'hours', card), width = parseFloat(card.style.width) - 30 - 422, hw = width / count;
    for (var i = 0; i < w.hours.length && i < count; i++) {
      var h = el('div', 'hour', hours), x = w.hours[i];
      h.style.left = (hw * i) + 'px';
      h.style.width = hw + 'px';
      el('div', 't', h, Data.hour(x.at));
      sym(Data.symbol(x.code, x.day), h);
      el('div', 'd', h, Data.degrees(x.temp));
    }
    var sun = el('div', 'sun', card);
    if (w.sunrise) { var a = el('span', '', sun); sym('sunrise', a); a.appendChild(document.createTextNode(narrow ? Data.time(w.sunrise) : trf('Sunrise {time}', {time: Data.time(w.sunrise)}))); }
    if (w.sunset) { var b = el('span', '', sun); sym('sunset', b); b.appendChild(document.createTextNode(narrow ? Data.time(w.sunset) : trf('Sunset {time}', {time: Data.time(w.sunset)}))); }
  }

  function renderPrices(card, coins) {
    var narrow = parseFloat(card.style.width) < 600;
    if (narrow) card.className += ' narrow';
    el('div', 'head', card, tr('Crypto'));
    var stale = Data.staleness(Data.pricesAt, 5 * 60000);
    el('div', 'side', card, stale ? trf('quotes|{ago}', {ago: stale}) : tr('24h change'));
    for (var j = 0; j < coins.length; j++) {
      var i = coins[j], row = el('div', 'coin', card);
      row.style.top = (86 + 52 * j) + 'px';
      coin(i, row);
      el('span', 'n', row, narrow ? ['BTC', 'ETH', 'SOL', 'USD'][i] : Data.coinName(i));
      el('span', 'p', row, Data.money(Data.prices[i]));
      var ch = Data.changes[i];
      if (!isNaN(ch)) el('span', 'c ' + (ch >= 0 ? 'up' : 'down'), row, Data.change(ch));
    }
  }

  function openDrawer() {
    if (!drawerItems.length) return;
    var tiles = $('tiles').children;
    st.zone = Z.DRAWER;
    st.drawer = Math.min(drawerItems.length - 1, nearest(document.querySelectorAll('#drawer .key'), centerX(tiles[st.shelf])));
    updateFocus();
    startSystem();
  }

  function closeDrawer() {
    var keys = document.querySelectorAll('#drawer .key');
    st.zone = Z.SHELF;
    stopSystem();
    if (shelf.length) st.shelf = nearest($('tiles').children, centerX(keys[st.drawer]));
    updateFocus();
  }

  // MARK: - All Apps

  function renderApps() {
    var sheet = $('apps');
    sheet.firstChild.textContent = tr('All Apps');
    var grid = sheet.lastChild;
    grid.innerHTML = '';
    for (var i = 0; i < others.length; i++) {
      var r = Math.floor(i / 5), c = i % 5, cell = el('div', 'cell', grid);
      cell.style.left = (130 + c * 340) + 'px';
      cell.style.top = (196 + r * 239) + 'px';
      face(others[i], el('div', 'face', cell), wordFit(others[i].title, 300, 34));
      el('div', 'label', cell, others[i].title);
      hover(cell, Z.APPS, i);
    }
  }

  function openApps() {
    renderApps();
    st.zone = Z.APPS;
    st.grid = 0;
    setClass($('apps'), 'open', true);
    updateFocus();
  }

  function closeSheets() {
    setClass($('apps'), 'open', false);
    setClass($('settings'), 'open', false);
    setClass($('shelfedit'), 'open', false);
    setClass($('langpick'), 'open', false);
    langHint = null;
    st.zone = Z.SHELF;
    updateFocus();
  }

  // MARK: - Home Settings

  function settingRows() {
    var unit = Prefs.temperature(), theme = Prefs.theme();
    var auto = tr('Automatic'), picked = pickedLanguage();
    var rows = [
      {label: tr('Language'), value: picked === 'auto' ? auto : I18N.languageName(picked), opens: true, language: true,
        step: function (d) { if (d >= 0) openLanguages(); }},
      {label: tr('Temperature'), value: unit === 'C' ? '°C' : unit === 'F' ? '°F' : tr('unit|Automatic'),
        step: function (d) { cycle('temperature', ['auto', 'C', 'F'], unit, d); renderPanels(); }},
      {label: tr('Theme'), value: theme === 'light' ? tr('Light') : theme === 'dark' ? tr('Dark') : auto,
        step: function (d) { cycle('theme', ['auto', 'light', 'dark'], theme, d); checkNight(); }},
      {label: tr('Weather widget'), toggle: Prefs.weather(),
        step: function () { Prefs.set('weather', !Prefs.weather()); renderPanels(); }},
      {label: tr('System widget'), toggle: Prefs.system(),
        step: function () { Prefs.set('system', !Prefs.system()); renderPanels(); }},
      {label: tr('Quotes widget'), toggle: Prefs.quotes(),
        step: function () { Prefs.set('quotes', !Prefs.quotes()); Data.settingsChanged(); }}
    ];
    var names = ['Bitcoin', 'Ethereum', 'Solana', tr('Dollar')];
    var count = Data.currency === 'BRL' ? 4 : 3;
    for (var i = 0; i < count; i++) {
      (function (i) {
        rows.push({label: names[i], toggle: Prefs.quotes() && Prefs.coin(i), dim: !Prefs.quotes(),
          step: function () { if (Prefs.quotes()) { Prefs.setCoin(i, !Prefs.coin(i)); Data.settingsChanged(); } }});
      })(i);
    }
    rows.push({label: tr('Shelf'), value: '›', step: function (d) { if (d >= 0) openShelfEdit(); }});
    rows.push({label: tr('TV Settings'), value: '›', step: function (d) { if (d >= 0) tvSettings(); }});
    return rows;
  }

  function cycle(name, values, current, d) {
    var i = values.indexOf(current);
    Prefs.set(name, values[(i + (d || 1) + values.length) % values.length]);
  }

  var rowsNow = [];

  function renderSettings() {
    var box = $('settings').firstChild;
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('settings', title);
    title.appendChild(document.createTextNode(tr('Home Settings')));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    rowsNow = settingRows();
    list.style.height = Math.min(rowsNow.length, 7) * 78 + 'px';
    for (var i = 0; i < rowsNow.length; i++) {
      var r = rowsNow[i], row = el('div', 'row' + (r.dim ? ' dim' : ''), holder, r.label);
      if (r.toggle !== undefined) setClass(el('div', 'toggle', row), 'on', r.toggle);
      else {
        var v = el('span', 'value', row);
        if (r.value === '›') v.textContent = '›';
        else if (r.opens) { v.appendChild(document.createTextNode(r.value)); el('span', 'chev', v, '›'); }
        else { el('span', 'chev', v, '‹'); v.appendChild(document.createTextNode(r.value)); el('span', 'chev', v, '›'); }
      }
      hover(row, Z.SETTINGS, i);
    }
    el('div', 'hint', box, tr('OK or the arrows change the value.'));
    updateFocus();
  }

  function openSettings() {
    st.zone = Z.SETTINGS;
    st.row = 0;
    renderSettings();
    setClass($('settings'), 'open', true);
    updateFocus();
  }

  // MARK: - Language: a list of every catalogue in its own name, as on Android (moving through it doesn't switch the app)

  var langHint = null;

  function languageChoices() {
    return ['auto'].concat(I18N.languages());
  }

  /** The language in use: "auto", or the catalogue the setting resolved to ("pt-BR" in config.properties is "pt"). */
  function pickedLanguage() {
    return Prefs.language() === 'auto' ? 'auto' : I18N.lang;
  }

  function renderLanguages() {
    var box = $('langpick').firstChild, choices = languageChoices(), current = choices.indexOf(pickedLanguage());
    box.innerHTML = '';
    el('div', 'title', box, tr('Language'));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = Math.min(choices.length, 7) * 78 + 'px';
    for (var i = 0; i < choices.length; i++) {
      var row = el('div', 'row', holder, choices[i] === 'auto' ? tr('Automatic') : I18N.languageName(choices[i]));
      if (i === current) sym('check', el('span', 'value', row));
      hover(row, Z.LANG, i);
    }
    langHint = el('div', 'hint', box);
    updateFocus();
  }

  function openLanguages() {
    setClass($('settings'), 'open', false);
    st.zone = Z.LANG;
    st.lang = Math.max(0, languageChoices().indexOf(pickedLanguage()));
    renderLanguages();
    setClass($('langpick'), 'open', true);
    updateFocus();
  }

  /** OK: the language under the focus; Back: none. Either way, back to Home Settings, on the Language row. */
  function closeLanguages(pick) {
    setClass($('langpick'), 'open', false);
    langHint = null;
    var code = languageChoices()[st.lang];
    if (pick && code !== pickedLanguage()) {
      Prefs.set('language', code);
      I18N.set(Prefs.language());
      renderAll();
      Data.refresh();   // the picks' titles and genres come in the new language
    }
    openSettings();
    for (var i = 0; i < rowsNow.length; i++) if (rowsNow[i].language) st.row = i;
    updateFocus();
  }

  // MARK: - Shelf editor: which apps, in what order

  function editList() {
    var ids = shelf.map(function (a) { return a.id; });
    return {ids: ids, rows: apps.slice().sort(function (a, b) {
      var ia = ids.indexOf(a.id), ib = ids.indexOf(b.id);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
    })};
  }

  function renderShelfEdit() {
    var box = $('shelfedit').firstChild, e = editList();
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('apps', title);
    title.appendChild(document.createTextNode(tr('Shelf')));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = Math.min(e.rows.length, 7) * 78 + 'px';
    for (var i = 0; i < e.rows.length; i++) {
      var a = e.rows[i], at = e.ids.indexOf(a.id), row = el('div', 'row', holder, a.title);
      el('span', 'value', row, at >= 0 ? '#' + (at + 1) : tr('shelf|Off'));
      hover(row, Z.EDIT, i);
    }
    el('div', 'hint', box, trf('OK adds or removes (up to {n}). ← → change the order.', {n: MAX_SHELF}));
    updateFocus();
  }

  function openShelfEdit() {
    setClass($('settings'), 'open', false);
    st.zone = Z.EDIT;
    st.edit = 0;
    renderShelfEdit();
    setClass($('shelfedit'), 'open', true);
    updateFocus();
  }

  function editShelf(dx) {
    var e = editList(), app = e.rows[st.edit];
    if (!app) return;
    var ids = e.ids.slice(), at = ids.indexOf(app.id);
    if (dx === 0) {
      if (at >= 0) ids.splice(at, 1);
      else if (ids.length < MAX_SHELF) ids.push(app.id);
      else { toast(trf('The shelf holds up to {n} apps.', {n: MAX_SHELF})); return; }
    } else {
      if (at < 0) return;
      var to = Math.max(0, Math.min(ids.length - 1, at + dx));
      ids.splice(at, 1);
      ids.splice(to, 0, app.id);
    }
    Prefs.set('shelf', ids);
    pickShelf();
    renderShelf();
    var again = editList();
    for (var i = 0; i < again.rows.length; i++) if (again.rows[i].id === app.id) st.edit = i;
    renderShelfEdit();
  }

  // MARK: - Opening things

  function launcher(id, name) {
    return function () {
      TV.launch(id, null, function (ok) {
        if (!ok) toast(trf("Couldn't open {app}.", {app: name || id}));
      });
    };
  }

  function tvSettings() {
    TV.settings(function (ok) {
      if (!ok) toast(tr("Couldn't open TV Settings"));
    });
  }

  function liveTV() {
    for (var i = 0; i < inputs.length; i++) if (inputs[i].key === 'live') return inputs[i];
    return null;
  }

  function activate() {
    switch (st.zone) {
      case Z.TOP:
        if (st.top < 3) return;
        if (st.top === 3) { var live = liveTV(); if (live) launcher(live.id, tr('Live TV'))(); }
        else if (st.top === 4) { st.zone = Z.SHELF; openDrawer(); st.drawer = 1 < drawerInputs ? 1 : 0; updateFocus(); }
        else openSettings();
        return;
      case Z.CARDS:
        var p = cards[st.card], app = p && Data.appFor(p.app);
        if (app) launcher(app.id, app.title)();
        return;
      case Z.SHELF:
        if (shelf[st.shelf]) launcher(shelf[st.shelf].id, shelf[st.shelf].title)();
        return;
      case Z.DRAWER:
        if (drawerItems[st.drawer]) drawerItems[st.drawer].run();
        return;
      case Z.APPS:
        if (others[st.grid]) launcher(others[st.grid].id, others[st.grid].title)();
        return;
      case Z.SETTINGS:
        if (rowsNow[st.row]) { rowsNow[st.row].step(1); if (st.zone === Z.SETTINGS) renderSettings(); }
        return;
      case Z.EDIT:
        editShelf(0);
        return;
      case Z.LANG:
        closeLanguages(true);
        return;
    }
  }

  function selectTab(i) {
    if (i === st.tab) return;
    st.tab = i;
    renderCards();
  }

  function move(dx, dy) {
    var tiles = $('tiles').children, cardNodes = $('cards').children;
    switch (st.zone) {
      case Z.SHELF:
        if (dx) st.shelf = Math.max(0, Math.min(shelf.length - 1, st.shelf + dx));
        else if (dy > 0) { openDrawer(); return; }
        else if (dy < 0) {
          if (cards.length) { st.zone = Z.CARDS; st.card = nearest(cardNodes, centerX(tiles[st.shelf])); }
          else { st.zone = Z.TOP; st.top = st.tab; }
        }
        break;
      case Z.CARDS:
        if (dx) st.card = Math.max(0, Math.min(cards.length - 1, st.card + dx));
        else if (dy < 0) { st.zone = Z.TOP; st.top = st.tab; }
        else if (shelf.length) { st.zone = Z.SHELF; st.shelf = nearest(tiles, centerX(cardNodes[st.card])); }
        break;
      case Z.TOP:
        if (dx) {
          st.top = Math.max(0, Math.min(5, st.top + dx));
          if (st.top < 3) selectTab(st.top);   // as on Apple TV: focusing a tab selects it
        } else if (dy > 0) {
          if (cards.length) { st.zone = Z.CARDS; st.card = Math.min(cards.length - 1, st.top < 3 ? 0 : cards.length - 1); }
          else st.zone = Z.SHELF;
        }
        break;
      case Z.DRAWER:
        if (dx) st.drawer = Math.max(0, Math.min(drawerItems.length - 1, st.drawer + dx));
        else if (dy < 0) { closeDrawer(); return; }
        break;
      case Z.APPS:
        var g = st.grid + dx + dy * 5;
        if (g >= 0 && g < others.length && (dx === 0 || Math.floor(g / 5) === Math.floor(st.grid / 5))) st.grid = g;
        break;
      case Z.SETTINGS:
        if (dy) st.row = Math.max(0, Math.min(rowsNow.length - 1, st.row + dy));
        else if (dx && rowsNow[st.row]) {
          var r = rowsNow[st.row];
          if (r.value !== '›') { r.step(dx); if (st.zone === Z.SETTINGS) renderSettings(); }
        }
        break;
      case Z.EDIT:
        if (dy) st.edit = Math.max(0, Math.min(apps.length - 1, st.edit + dy));
        else if (dx) editShelf(dx);
        break;
      case Z.LANG:
        if (dy) st.lang = Math.max(0, Math.min(languageChoices().length - 1, st.lang + dy));
        break;
    }
    updateFocus();
  }

  function back() {
    if (st.zone === Z.EDIT) { setClass($('shelfedit'), 'open', false); openSettings(); st.row = rowsNow.length - 2; updateFocus(); return; }
    if (st.zone === Z.LANG) { closeLanguages(false); return; }
    if (sheetOpen()) { closeSheets(); return; }
    if (st.zone === Z.DRAWER) { closeDrawer(); return; }
    if (st.zone !== Z.SHELF && shelf.length) { st.zone = Z.SHELF; updateFocus(); return; }
    TV.back();
  }

  /** The pointer focuses what it's over (the Magic Remote, or a mouse when previewing). */
  function hover(node, zone, index) {
    node.onmouseover = function () {
      if (saverOn || (sheetOpen() !== (zone === Z.APPS || zone === Z.SETTINGS || zone === Z.EDIT || zone === Z.LANG))) return;
      if (zone === Z.DRAWER && st.zone !== Z.DRAWER) return;
      if (zone !== Z.DRAWER && st.zone === Z.DRAWER && zone !== Z.SHELF) return;
      if (zone === Z.SHELF && st.zone === Z.DRAWER) closeDrawer();
      st.zone = zone;
      if (zone === Z.TOP) { st.top = index; if (index < 3) selectTab(index); }
      else if (zone === Z.CARDS) st.card = index;
      else if (zone === Z.SHELF) st.shelf = index;
      else if (zone === Z.DRAWER) st.drawer = index;
      else if (zone === Z.APPS) st.grid = index;
      else if (zone === Z.SETTINGS) st.row = index;
      else if (zone === Z.EDIT) st.edit = index;
      else if (zone === Z.LANG) st.lang = index;
      updateFocus();
    };
    node.onclick = function () { node.onmouseover(); activate(); };
  }

  // MARK: - Toast

  var toastTimer = 0;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    setClass(t, 'on', true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { setClass(t, 'on', false); }, 6000);
  }

  // MARK: - Night, clock, screensaver

  function checkNight() {
    setClass(body, 'night', Data.isNight(Date.now()));
  }

  var saverOn = false, idleAt = Date.now(), saverIndex = 0, saverTimer = 0, SAVER_AFTER = 5 * 60000;

  // MARK: - The screensaver kitten: tries every way to catch the bouncing clock, then hides and peeks in from the edges

  var palTimer = 0, saverRaf = 0, palStep = null;
  var motion = {x: 0, y: 0, w: 500, h: 200, vx: 130, vy: 96, k: 1};
  var PAL_W = 300, PAL_H = 300;   // the cat's box on screen: it follows the photo that is showing
  var PAL_MAX_H = 330, PAL_MAX_W = 420;
  // The family's cats, as cut-out photos (web/gatas/gNN.webp). Every wall hit and every bump on the clock brings another.
  var CATS = window.CATS || [];   // [{f: 'gatas/g01.webp', w, h}], generated at build: the sizes are known before the photos load
  var catPics = [], catOrder = [], catPos = 0, lastCat = -1, palChange = null, saverClock = null;
  var palKey = null, palLite = null, palWatch = null, perfLite = false, showFps = false, saverFps = null;   // remote keys, low-power mode, the fps readout

  function loadCats() {
    if (catPics.length) return;
    for (var i = 0; i < CATS.length; i++) { var im = new Image(); im.src = CATS[i].f; catPics.push(im); }
  }
  loadCats();   // at start, so they are in memory when the screensaver comes

  /** The next cat: a shuffled round, so all of them show before one repeats. */
  function nextCat() {
    if (catPos >= catOrder.length) {
      catOrder = [];
      for (var i = 0; i < catPics.length; i++) catOrder.push(i);
      for (var j = catOrder.length - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1)), t = catOrder[j];
        catOrder[j] = catOrder[k]; catOrder[k] = t;
      }
      if (catOrder.length > 1 && catOrder[0] === lastCat) { var x = catOrder[0]; catOrder[0] = catOrder[1]; catOrder[1] = x; }
      catPos = 0;
    }
    lastCat = catOrder[catPos++];
    return lastCat;
  }

  function startPal(saver) {
    if (!CATS.length) return;   // no cat photos in this build (web/gatas): just the clock
    var tint = el('div', 'tint', saver);   // a soft glow in the cat's colour, under it
    var buddy = el('div', 'buddy', saver), bob = el('div', 'bob', buddy), bflip = el('div', 'bflip', bob), bpic = el('img', 'bpic', bflip);
    var wrap = el('div', 'pal', saver), rot = el('div', 'rot', wrap), inner = el('div', 'in', rot);
    var shadow = el('div', 'shadow', wrap), zzz = el('div', 'zzz', wrap);
    zzz.innerHTML = '<i>z</i><i>z</i><i>Z</i>';
    bpic.alt = '';
    loadCats();
    inner.innerHTML = '<div class="eyes"><div class="swap"><div class="flip"><img class="pic" alt=""></div></div></div>';
    var eyes = inner.querySelector('.eyes'), swap = inner.querySelector('.swap'), svg = inner.querySelector('.flip'), pic = inner.querySelector('.pic');
    var bumpCd = 0, changedAt = 0;

    var chasing = false, px = 0, py = 0, side = 1, act = null, wait = 1.5, curSpot = 'bottom';
    var running = false, lean = 0, lastPx = 0, bx = 0, by = 0, bw = 0, bh = 0, bOn = false, peekBox = null, peekAbort = false, relocating = false, lastReloc = 0;
    var entering = false, leaving = false, dropIn = false, enterT = 0;
    var axis = 'y';   // which way "away" is: 'y' (the cat's own down, so the rotation decides), 'xl' (off the left edge), 'xr' (off the right)
    function slide(d) {
      var t = axis === 'y' ? 'translateY(' + d + 'px)' : 'translateX(' + (axis === 'xl' ? -d : d) + 'px)';
      inner.style.webkitTransform = inner.style.transform = t;
    }
    /** Head turned: tilted by deg and shifted by px, around its feet. */
    function tilt(deg, shift, skew) {
      eyes.style.webkitTransform = eyes.style.transform = 'translateX(' + shift + 'px) rotate(' + deg + 'deg)' + (skew ? ' skewX(' + skew.toFixed(1) + 'deg)' : '');
    }
    function look(x) { tilt(0, x, 0); }
    function fade(on) { inner.style.opacity = on ? '1' : '0'; }
    function after(ms, fn) { palTimer = setTimeout(function () { if (saverOn) fn(); }, ms); }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function instant(fn) {
      inner.style.webkitTransition = inner.style.transition = 'none';
      fn();
      void inner.offsetWidth;   // apply that state before animating out of it
      inner.style.webkitTransition = inner.style.transition = '';
    }

    // The ways it tries: jump at it, pounce, swat with both paws, sit and stare, stretch, or take a nap. [kind, seconds, weight]
    var ACTS = [['hop', 0.9, 30], ['pounce', 1.3, 26], ['swat', 1.4, 20], ['sit', 1.6, 12], ['stretch', 1.4, 12], ['nap', 3.6, 9]];

    function startAct() {
      var total = 0, i;
      for (i = 0; i < ACTS.length; i++) total += ACTS[i][2];
      var roll = Math.random() * total;
      for (i = 0; i < ACTS.length - 1; i++) { roll -= ACTS[i][2]; if (roll < 0) break; }
      act = {kind: ACTS[i][0], dur: ACTS[i][1], t: 0};
      var forced = (location.hash.match(/act=(\w+)/) || [])[1];   // to try one: #act=nap
      if (forced) for (var f = 0; f < ACTS.length; f++) if (ACTS[f][0] === forced) act = {kind: forced, dur: ACTS[f][1], t: 0};
      running = false;
      wrap.className = 'pal chase act-' + act.kind;
    }

    function endAct() {
      act = null;
      wait = rnd(0.8, 2.4);
      running = false;
      wrap.className = 'pal chase';
    }

    /** Shows cat i, and sizes the cat's box to its photo. */
    function setCat(i) {
      var c = CATS[i];
      if (!c) return;
      var sc = Math.min(PAL_MAX_H / c.h, PAL_MAX_W / c.w);
      PAL_W = Math.round(c.w * sc);
      PAL_H = Math.round(c.h * sc);
      wrap.style.width = PAL_W + 'px';
      wrap.style.height = PAL_H + 'px';
      pic.src = c.f;
      if (c.c) {
        var rgb = c.c[0] + ',' + c.c[1] + ',' + c.c[2];
        tint.style.color = 'rgb(' + rgb + ')';
        if (saverClock) saverClock.style.textShadow = '0 0 46px rgba(' + rgb + ',0.6), 0 4px 30px rgba(0, 0, 0, 0.55)';
      }
    }

    /** The friend: a smaller second cat that trails behind the first. */
    function setBuddy(i) {
      var c = CATS[i];
      if (!c) return;
      var sc = Math.min(210 / c.h, 270 / c.w);
      bw = Math.round(c.w * sc);
      bh = Math.round(c.h * sc);
      buddy.style.width = bw + 'px';
      buddy.style.height = bh + 'px';
      bpic.src = c.f;
    }
    function buddyOn(on) { bOn = on; buddy.style.opacity = on ? '1' : '0'; }

    /** Hearts and stars float up from the cat. */
    function burst(n, kind) {
      if (perfLite) return;
      var cx = px + PAL_W / 2, cy = py + PAL_H * 0.3;
      for (var i = 0; i < n; i++) {
        (function (i) {
          var h = el('div', 'spk' + (kind === 'hearts' || i % 2 ? '' : ' s'), saver);
          h.style.left = Math.round(cx + rnd(-PAL_W * 0.3, PAL_W * 0.3)) + 'px';
          h.style.top = Math.round(cy + rnd(-30, 30)) + 'px';
          setTimeout(function () {
            h.style.webkitTransform = h.style.transform = 'translate(' + Math.round(rnd(-90, 90)) + 'px,' + Math.round(-rnd(90, 190)) + 'px) scale(' + rnd(0.7, 1.5).toFixed(2) + ')';
            h.style.opacity = '0';
          }, 30 + i * 40);
          setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 1400 + i * 40);
        })(i);
      }
    }

    /** A small cloud (screen coordinates) where a cat appears or vanishes. */
    function poof(cx, cy) {
      if (perfLite) return;
      for (var i = 0; i < 6; i++) {
        (function (i) {
          var d = el('i', 'poof', saver), a = i / 6 * Math.PI * 2 + rnd(-0.3, 0.3);
          d.style.left = Math.round(cx) + 'px';
          d.style.top = Math.round(cy) + 'px';
          setTimeout(function () {
            d.style.webkitTransform = d.style.transform = 'translate(' + Math.round(Math.cos(a) * 95) + 'px,' + Math.round(Math.sin(a) * 75) + 'px) scale(1.9)';
            d.style.opacity = '0';
          }, 30);
          setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 850);
        })(i);
      }
    }

    /** A little dust where it lands. */
    function dust() {
      if (perfLite) return;
      for (var i = 0; i < 3; i++) {
        (function (i) {
          var d = el('i', 'dust', wrap);
          d.style.left = (26 + i * 24) + '%';
          setTimeout(function () {
            d.style.webkitTransform = d.style.transform = 'translate(' + ((i - 1) * 46) + 'px,-16px) scale(1.7)';
            d.style.opacity = '0';
          }, 30);
          setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 900);
        })(i);
      }
    }

    /** Another cat: the one showing fades and shrinks a little, then the next grows in. The size changes while it can't be seen. */
    function changeCat(force) {
      var now = Date.now();
      if (!force && now - changedAt < 900) return;
      changedAt = now;
      var i = nextCat();
      burst(5, 'mix');
      swap.style.opacity = '0';
      swap.style.webkitTransform = swap.style.transform = 'scale(0.88)';
      setTimeout(function () {
        if (!saverOn) return;
        poof(px + PAL_W / 2, py + PAL_H / 2);
        setCat(i);
        swap.style.opacity = '1';
        swap.style.webkitTransform = swap.style.transform = 'scale(1)';
      }, 240);
      if (bOn) {
        buddy.style.opacity = '0';
        setTimeout(function () { if (saverOn && bOn) { setBuddy(nextCat()); buddy.style.opacity = '1'; } }, 520);
      }
    }

    /** The cat reaches the clock: another cat, and nothing else changes. They pass through each other. */
    function bump() {
      bumpCd = 2.4;
      changeCat();
    }

    /** The cats are never on top of the clock: if a box would overlap it (with a margin), it is pushed out the shortest way, and stays on screen. */
    function avoid(x, y, w, h, free) {
      var M = 40;   // room for the head's tilt, which sticks out of the box a little
      for (var n = 0; n < 3; n++) {
        var ox = Math.min(x + w, motion.x + motion.w + M) - Math.max(x, motion.x - M);
        var oy = Math.min(y + h, motion.y + motion.h + M) - Math.max(y, motion.y - M);
        if (ox <= 0 || oy <= 0) break;
        var ccx = motion.x + motion.w / 2, ccy = motion.y + motion.h / 2;
        var sideways = (n === 1) ? ox >= oy : ox < oy;
        if (sideways) x += (x + w / 2 < ccx) ? -ox : ox;
        else y += (y + h / 2 < ccy) ? -oy : oy;
        if (!free) { x = clamp(x, 0, 1920 - w); y = clamp(y, 0, 1080 - h); }
      }
      return [x, y];
    }

    /** The cat can't get past the clock (the other side, or cornered by an edge): it ducks out and comes back on the other side. */
    function relocate(ns) {
      var now = Date.now();
      if (relocating || now - lastReloc < 900) return false;
      relocating = true;
      lastReloc = now;
      poof(px + PAL_W / 2, py + PAL_H / 2);
      swap.style.webkitTransition = swap.style.transition = 'opacity 0.12s ease';
      swap.style.opacity = '0';
      if (bOn) buddy.style.opacity = '0';
      after(260, function () {
        side = ns;
        px = clamp(side === 1 ? motion.x + motion.w + 64 : motion.x - PAL_W - 64, 0, 1920 - PAL_W);
        py = clamp(motion.y, 0, 1080 - PAL_H);
        lastPx = px;
        lean = 0;
        if (bOn) { bx = px; by = py; }
        wrap.style.webkitTransform = wrap.style.transform = 'translate3d(' + Math.round(px) + 'px,' + Math.round(py) + 'px,0)';
        svg.style.webkitTransform = svg.style.transform = side === 1 ? '' : 'scaleX(-1)';
        swap.style.webkitTransition = swap.style.transition = '';
        swap.style.opacity = '1';
        if (bOn) buddy.style.opacity = '1';
        poof(px + PAL_W / 2, py + PAL_H / 2);
        relocating = false;
      });
      return true;
    }

    /** True when the box (x, y, w, h) comes within `m` pixels of the clock. */
    function hitsClock(x, y, w, h, m) {
      return x < motion.x + motion.w + m && x + w > motion.x - m && y < motion.y + motion.h + m && y + h > motion.y - m;
    }

    /** Chase: the clock bounces around the screen; the kitten runs after it, a step behind, and tries to catch it. */
    function chase() {
      setCat(nextCat());
      palChange = changeCat;
      axis = 'y';
      rot.style.webkitTransformOrigin = rot.style.transformOrigin = '';
      wrap.className = 'pal chase';
      wrap.style.left = '0px';
      wrap.style.top = '0px';
      rot.style.webkitTransform = rot.style.transform = 'rotate(0deg)';
      act = null;
      wait = 2.6;
      swap.style.opacity = '1';
      swap.style.webkitTransform = swap.style.transform = 'scale(1)';
      // the entrance: it runs in from the edge nearest its side of the clock, or drops in from above
      dropIn = Math.random() < 0.4;
      var ty0 = clamp(motion.y, 0, 1080 - PAL_H);
      if (dropIn) {
        px = clamp(motion.x + motion.w + 64, 0, 1920 - PAL_W);
        py = -PAL_H - 120;
        wrap.className = 'pal chase land';
      } else {
        px = side === 1 ? 1960 : -PAL_W - 40;
        py = ty0;
        wrap.className = 'pal chase run';
      }
      entering = true;
      leaving = false;
      enterT = 0;
      instant(function () { slide(0); fade(true); });
      tint.style.opacity = '';
      running = !dropIn; lean = 0; lastPx = px;
      if (!perfLite && (Math.random() < 0.5 || /buddy/.test(location.hash))) {   // sometimes a second, smaller cat trails the first
        setBuddy(nextCat());
        bx = px; by = py;
        buddyOn(true);
      } else buddyOn(false);
      chasing = true;
      palStep = step;
      step(0);
      after(80, function () {
        after(rnd(26000, 36000), leave);
      });
    }

    /** One frame: stay beside the clock (on the side with room), a step behind, or do what the current action says. */
    function step(dt) {
      if (!chasing || relocating) return;
      var right = motion.x + motion.w + PAL_W + 90 <= 1920, left = motion.x - PAL_W - 90 >= 0;
      if (!entering && !leaving) {
        if (side === 1 && !right && left) { if (relocate(-1)) return; }
        else if (side === -1 && !left && right) { if (relocate(1)) return; }
      }
      var gp = 64, k = 3;   // the gap it keeps from the clock, and how fast it follows
      if (act) {
        act.t += dt;
        if (act.kind === 'pounce') {
          // a lunge toward the clock, stopping short of it, then back to the usual gap
          if (act.t >= 0.3 && act.t < 0.85) {
            gp = 46; k = 14;
            if (!act.hit && act.t >= 0.4) { act.hit = true; bump(); }
          }
        } else if (act.kind === 'hop') {
          k = act.t < 0.5 ? 6 : 3;
          if (act.t > 0.78 && !act.dust) { act.dust = true; dust(); }
        } else if (act.kind === 'sit' || act.kind === 'nap') {
          k = 0;
        } else if (act.kind === 'stretch') {
          k = 1.5;
        }
        if (act.t >= act.dur) endAct();
      } else {
        wait -= dt;
        if (wait <= 0) startAct();
      }
      var tx = clamp(side === 1 ? motion.x + motion.w + gp : motion.x - PAL_W - gp, 0, 1920 - PAL_W);
      var ty = clamp(motion.y, 0, 1080 - PAL_H);
      if (leaving) { tx = side === 1 ? 1960 : -PAL_W - 40; k = 3.2; }
      if (entering) {
        k = dropIn ? 5.5 : 4.2;
        enterT += dt;
        if (Math.abs(tx - px) + Math.abs(ty - py) < 50 || enterT > 2.6) {
          entering = false;
          if (dropIn) { dust(); wrap.className = 'pal chase'; }
        }
      }
      if (!act && !entering && !leaving) {   // far from the clock it runs, near it it walks
        var rn = Math.abs(tx - px) + Math.abs(ty - py) > 150;
        if (rn !== running) { running = rn; wrap.className = 'pal chase' + (rn ? ' run' : ''); }
      }
      var m = Math.min(1, dt * k);
      px += (tx - px) * m;
      py += (ty - py) * m;
      var av = avoid(px, py, PAL_W, PAL_H, entering || leaving);
      px = av[0];
      py = av[1];
      if (!entering && !leaving && hitsClock(px + 4, py + 4, PAL_W - 8, PAL_H - 8, 16)) {   // still touching: squeezed against an edge
        if (side === 1 && left) { if (relocate(-1)) return; }
        else if (side === -1 && right) { if (relocate(1)) return; }
      }
      wrap.style.webkitTransform = wrap.style.transform = 'translate3d(' + Math.round(px) + 'px,' + Math.round(py) + 'px,0)';
      svg.style.webkitTransform = svg.style.transform = side === 1 ? '' : 'scaleX(-1)';
      // the head leans into the way it is going, and turns toward the clock
      var vxs = dt > 0 ? (px - lastPx) / dt : 0;
      lastPx = px;
      var lt = clamp(-vxs * 0.012, -6, 6);
      if (side === 1 && lt > 1.5) lt = 1.5;     // never leaning over the clock
      if (side === -1 && lt < -1.5) lt = -1.5;
      lean += (lt - lean) * Math.min(1, dt * 6);
      var look2 = 0;
      if (act && act.kind === 'sit') look2 = Math.sin(act.t * 2.6) * 9;          // looks around
      else if (act && act.kind === 'nap') look2 = 4 + Math.sin(act.t * 1.4) * 2;   // head drooping
      tilt((side === 1 ? -1.5 : 1.5) - lean * 0.4 + look2, side === 1 ? -3 : 3, lean);
      tint.style.webkitTransform = tint.style.transform = 'translate3d(' + Math.round(px + PAL_W / 2 - 550) + 'px,' + Math.round(py + PAL_H / 2 - 550) + 'px,0)';
      if (bOn) {
        var btx = side === 1 ? px + PAL_W + 6 : px - bw - 6, bty = py + PAL_H - bh;
        var bm = Math.min(1, dt * 1.7);
        bx += (btx - bx) * bm;
        by += (bty - by) * bm;
        var ab = avoid(clamp(bx, 0, 1920 - bw), clamp(by, 0, 1080 - bh), bw, bh, false);
        bx = ab[0];
        by = ab[1];
        if (hitsClock(bx + 4, by + 4, bw - 8, bh - 8, 16)) { bx = px; by = py; buddy.style.opacity = '0'; setTimeout(function () { if (bOn && saverOn && !relocating) buddy.style.opacity = '1'; }, 700); }
        buddy.style.webkitTransform = buddy.style.transform = 'translate3d(' + Math.round(bx) + 'px,' + Math.round(by) + 'px,0)';
        bflip.style.webkitTransform = bflip.style.transform = side === 1 ? '' : 'scaleX(-1)';
      }
    }

    /** The kitten gives up on the clock, fades away and comes back later at the edges. */
    function leave() {
      palChange = null;
      buddyOn(false);
      act = null;
      wait = 1e9;
      leaving = true;
      entering = false;
      running = true;
      wrap.className = 'pal chase run';
      after(1500, function () { fade(false); });
      after(1900, function () { leaving = false; chasing = false; palStep = null; peeks(3); });
    }

    /**
     * Where the next peek happens, and how the cat is turned. It is upright from the bottom and from the sides (it slides in
     * from behind the edge), and hangs upside down only from the top, and only for a tall photo (a cat that sits up): a cat
     * lying down looks wrong hanging, and nothing is ever upside down while it chases the clock.
     */
    function pickSpot() {
      var tall = PAL_H / PAL_W >= 1.25;
      var spots = [['bottom', 30], ['left', 22], ['right', 22], ['bl', 14], ['br', 14]];
      if (tall) spots.push(['top', 12], ['tl', 6], ['tr', 6]);
      var total = 0, i;
      for (i = 0; i < spots.length; i++) total += spots[i][1];
      var roll = Math.random() * total;
      for (i = 0; i < spots.length - 1; i++) { roll -= spots[i][1]; if (roll < 0) break; }
      return spots[i][0];
    }

    /** Where the cat would be for this spot, and how it is turned. */
    function layout(spot) {
      var left, top, deg = 0, ax = 'y';
      if (spot === 'bottom') { left = rnd(0, 1920 - PAL_W); top = 1080 - PAL_H; }
      else if (spot === 'top') { left = rnd(0, 1920 - PAL_W); top = 0; deg = 180; }
      else if (spot === 'left') { left = 0; top = rnd(80, 1000 - PAL_H); ax = 'xl'; }
      else if (spot === 'right') { left = 1920 - PAL_W; top = rnd(80, 1000 - PAL_H); ax = 'xr'; }
      else if (spot === 'bl') { left = 0; top = 1080 - PAL_H; deg = 25; }
      else if (spot === 'br') { left = 1920 - PAL_W; top = 1080 - PAL_H; deg = -25; }
      else if (spot === 'tl') { left = 0; top = 0; deg = 155; }
      else { left = 1920 - PAL_W; top = 0; deg = -155; }
      return {left: left, top: top, deg: deg, ax: ax};
    }

    /** Puts the cat there, turned the right way, hidden (the peek slides it in). */
    function place(L) {
      axis = L.ax;
      wrap.style.left = L.left + 'px';
      wrap.style.top = L.top + 'px';
      rot.style.webkitTransformOrigin = rot.style.transformOrigin = '50% 50%';
      rot.style.webkitTransform = rot.style.transform = 'rotate(' + L.deg + 'deg)';
    }

    /** How far to slide to be out of sight, with room for the tilt. */
    function away() { return axis === 'y' ? PAL_H * 1.25 + 30 : PAL_W + 30; }
    /** vis is how much of the cat shows (0 to 1). From the sides and corners it comes out further, so the face shows. */
    function show(vis) {
      var e = vis;
      if (axis !== 'y') e = 0.42 + vis * 0.5;
      else if (curSpot.length === 2) e = Math.min(0.85, vis + 0.22);
      slide((axis === 'y' ? PAL_H : PAL_W) * (1 - e));
    }

    /** Runs steps [wait ms before it, action] one after another, then done. */
    function seq(steps, done) {
      var i = 0;
      function go() {
        if (peekAbort || i >= steps.length) { done(); return; }
        var st = steps[i++];
        after(st[0], function () { if (!peekAbort) st[1](); go(); });
      }
      go();
    }

    /** Three ways to look in: curious (tilts its head, leans out further), shy (ducks and tries again), or a jack-in-the-box. */
    function script(kind) {
      var out = function () { slide(away()); };
      if (kind === 0) {
        return [[0, function () { show(0.3); }], [900, function () { tilt(-10, -6); }], [850, function () { tilt(10, 6); }],
                [850, function () { tilt(0, 0); }], [500, function () { show(0.52); }], [1000, function () { tilt(-6, -4); }],
                [800, function () { tilt(0, 0); }], [600, out]];
      }
      if (kind === 1) {
        return [[0, function () { show(0.18); }], [800, function () { tilt(-5, 0); }], [900, out], [1000, function () { show(0.34); }],
                [1100, function () { tilt(7, 4); }], [900, function () { tilt(0, 0); }], [500, out]];
      }
      return [[0, function () { show(0.08); }], [1100, function () { show(0.3); }], [500, function () { show(0.58); }],
              [800, function () { tilt(8, 5); }], [700, function () { tilt(-8, -5); }], [700, function () { tilt(0, 0); }], [500, out]];
    }

    function peeks(left) {
      if (left <= 0) { chase(); return; }
      chasing = false;
      palStep = null;
      wrap.className = 'pal';
      buddyOn(false);
      tint.style.opacity = '0';
      wrap.style.webkitTransform = wrap.style.transform = '';
      svg.style.webkitTransform = svg.style.transform = '';
      setCat(nextCat());
      // a place away from the clock; if the clock is in the way everywhere, wait and try again
      var L = null, spot = '';
      for (var tries = 0; tries < 8 && !L; tries++) {
        spot = pickSpot();
        var c = layout(spot);
        if (!hitsClock(c.left - 40, c.top - 40, PAL_W + 80, PAL_H + 80, 100)) L = c;
      }
      if (!L) { after(1500, function () { peeks(left); }); return; }
      curSpot = spot;
      peekAbort = false;
      peekBox = {x: L.left - 40, y: L.top - 40, w: PAL_W + 80, h: PAL_H + 80};
      instant(function () { place(L); slide(away()); fade(true); tilt(0, 0); });
      after(80, function () {
        seq(script(Math.floor(Math.random() * 3)), function () {
          peekBox = null;
          after(rnd(2500, 5000), function () { peeks(left - 1); });
        });
      });
    }
    // remote: left/right bring another cat, OK sends hearts
    palKey = function (kind) {
      if (!chasing) return;
      if (kind === 'ok') burst(12, 'hearts'); else changeCat(true);
    };
    palLite = function () { buddyOn(false); tint.style.opacity = '0'; };
    palWatch = function () {   // a cat peeking from an edge ducks out as soon as the clock comes near
      if (peekBox && hitsClock(peekBox.x, peekBox.y, peekBox.w, peekBox.h, 100)) {
        peekBox = null;
        peekAbort = true;
        tilt(0, 0);
        inner.style.webkitTransition = inner.style.transition = 'transform 0.22s ease-in, opacity 0.6s';   // ducks out fast
        slide(away());
        setTimeout(function () { inner.style.webkitTransition = inner.style.transition = ''; }, 320);
      }
    };
    if (/peek/.test(location.hash)) after(300, function () { chasing = false; peeks(3); });
    else after(2500, chase);
  }

  /** The clock drifts diagonally and bounces off the edges of the screen, like a DVD logo. */
  function startBounce(clock) {
    var m = motion, last = 0, fpsN = 0, fpsT = 0, fpsAll = 0, lowRuns = 0;
    m.x = Math.random() * 700;
    m.y = Math.random() * 300;
    m.vx = Math.random() < 0.5 ? 130 : -130;
    m.vy = Math.random() < 0.5 ? 96 : -96;
    function measure() { m.w = clock.offsetWidth; m.h = clock.offsetHeight; }
    function frame(now) {
      if (!saverOn) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (dt > 0) {   // frames per second: if the TV can't keep up, the extras (second cat, glow, hearts) turn off by themselves
        fpsN++; fpsT += dt; fpsAll += dt;
        if (fpsT >= 2) {
          var fps = fpsN / fpsT;
          if (saverFps && showFps) saverFps.textContent = Math.round(fps) + ' fps' + (perfLite ? ' (lite)' : '');
          lowRuns = fps < 38 && fpsAll > 8 ? lowRuns + 1 : 0;
          if (lowRuns >= 2 && !perfLite) { perfLite = true; setClass($('saver'), 'lite', true); if (palLite) palLite(); }
          fpsN = 0; fpsT = 0;
        }
      }
      m.k = 1 + (m.k - 1) * Math.exp(-dt * 1.4);   // a bump's extra speed fades
      m.x += m.vx * m.k * dt;
      m.y += m.vy * m.k * dt;
      var maxX = Math.max(0, 1920 - m.w), maxY = Math.max(0, 1080 - m.h), hit = false;
      if (m.x < 0) { m.x = 0; m.vx = Math.abs(m.vx); hit = true; }
      else if (m.x > maxX) { m.x = maxX; m.vx = -Math.abs(m.vx); hit = true; }
      if (m.y < 0) { m.y = 0; m.vy = Math.abs(m.vy); hit = true; }
      else if (m.y > maxY) { m.y = maxY; m.vy = -Math.abs(m.vy); hit = true; }
      if (hit) { measure(); if (palChange) palChange(); }
      clock.style.webkitTransform = clock.style.transform = 'translate3d(' + m.x.toFixed(1) + 'px,' + m.y.toFixed(1) + 'px,0)';
      if (palStep) palStep(dt);
      if (palWatch) palWatch();
      saverRaf = requestAnimationFrame(frame);
    }
    measure();
    saverRaf = requestAnimationFrame(frame);
    return measure;
  }

  function showSaver() {
    if (saverOn) return;   // already showing: don't start a second set of animations
    saverOn = true;
    setClass(body, 'saver', true);   // the home screen's animations pause under it
    var s = $('saver');
    s.innerHTML = '';
    perfLite = false;
    setClass(s, 'lite', false);
    el('div', 'aurora', s).innerHTML = '<i class="a1"></i><i class="a2"></i><i class="a3"></i>';
    startPal(s);
    var clock = el('div', 'clock', s);
    saverClock = clock;
    el('div', 'time', clock);
    el('div', 'date', clock);
    saverFps = el('div', 'fps' + (showFps ? ' on' : ''), s);
    var measureClock = startBounce(clock);
    function next() {
      if (!saverOn) return;
      tickSaverClock(clock);
      measureClock();
      saverTimer = setTimeout(next, 5000);
    }
    setClass(s, 'on', true);
    next();
  }

  function tickSaverClock(clock) {
    var now = Date.now();
    clock.firstChild.textContent = formatDate('format|h:mm', now);
    clock.lastChild.textContent = formatDate('format|EEEE, MMMM d', now);
  }

  function hideSaver() {
    saverOn = false;
    setClass(body, 'saver', false);
    clearTimeout(saverTimer);
    clearTimeout(palTimer);
    if (saverRaf) cancelAnimationFrame(saverRaf);
    palStep = null;
    palChange = null;
    palKey = null;
    palLite = null;
    palWatch = null;
    saverClock = null;
    saverFps = null;
    setClass($('saver'), 'on', false);
  }

  function poke() {
    idleAt = Date.now();
    if (saverOn) { hideSaver(); return true; }
    return false;
  }

  // MARK: - Keys

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (saverOn && (k === 57 || k === 105)) {   // 9: shows the frames per second
      showFps = !showFps;
      setClass(saverFps, 'on', showFps);
      idleAt = Date.now();
      e.preventDefault();
      return;
    }
    if (saverOn && palKey && (k === TV.keys.left || k === TV.keys.right || k === TV.keys.ok)) {   // these play with the cats
      idleAt = Date.now();
      palKey(k === TV.keys.ok ? 'ok' : 'cat');
      e.preventDefault();
      return;
    }
    if (poke()) { e.preventDefault(); return; }   // the first press only wakes the screen
    if (k === TV.keys.left) move(-1, 0);
    else if (k === TV.keys.right) move(1, 0);
    else if (k === TV.keys.up) move(0, -1);
    else if (k === TV.keys.down) move(0, 1);
    else if (k === TV.keys.ok) activate();
    else if (k === TV.keys.back || k === 27 || k === 8) back();
    else if (k === 48 || k === 96) showSaver();   // 0: shows the screensaver now, to try it without waiting
    else return;
    e.preventDefault();
  });
  document.addEventListener('mousemove', function () { poke(); });

  // MARK: - Start

  function renderAll() {
    renderTop();
    renderQuotes();
    cards = [];
    renderCards();
    renderShelf();
    renderDrawer();
    renderClock();
    checkNight();
    if (st.zone === Z.SETTINGS) renderSettings();
    updateFocus();
  }

  /** hide_apps in config.properties: left out of the shelf, All Apps and the picks, by id or name (part of it). */
  var HIDE = (CONFIG.hideApps || []).map(function (s) { return s.toLowerCase(); });
  function hidden(app) {
    var id = (app.id || '').toLowerCase(), title = (app.title || '').toLowerCase();
    for (var i = 0; i < HIDE.length; i++) if (id.indexOf(HIDE[i]) >= 0 || title.indexOf(HIDE[i]) >= 0) return true;
    return false;
  }

  function loadApps(done) {
    TV.apps(function (list) {
      apps = list.filter(function (a) { return !hidden(a); });
      Data.setApps(apps);
      pickShelf();
      TV.inputs(function (list2) {
        inputs = list2;
        if (done) done();
      });
    });
  }

  /** Back to the home screen (the app was opened again): the shelf, everything closed, the first tab. */
  function reset() {
    hideSaver();
    closeSheets();
    st.zone = Z.SHELF;
    st.shelf = 0;
    if (st.tab !== 0) { st.tab = 0; renderCards(); }
    updateFocus();
  }

  Data.onChange(function () {
    renderQuotes();
    renderCards();
    renderPanels();
    checkNight();
  });

  function reopened() {
    // LG: with handlesRelaunch the app has to come to the front itself, or opening it again while it runs shows nothing.
    if (window.PalmSystem && window.PalmSystem.activate) window.PalmSystem.activate();
    reset();
    loadApps(function () { renderShelf(); renderDrawer(); Data.refresh(); });
  }

  window.addEventListener('resize', fit);
  document.addEventListener('webOSRelaunch', reopened);   // LG: opened again while running
  window.addEventListener('appcontrol', reopened);        // Samsung: the same
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hideSaver(); return; }
    idleAt = Date.now();
    loadApps(function () { renderShelf(); renderDrawer(); updateFocus(); Data.refresh(); });
  });

  I18N.set(Prefs.language());
  fit();
  renderTop();
  loadApps(function () {
    renderAll();
    Data.refresh();
  });
  setInterval(function () {
    renderClock();
    checkNight();
    Data.refresh();
    if (st.zone !== Z.DRAWER) stopSystem();
    if (!saverOn && !sheetOpen() && Date.now() - idleAt > SAVER_AFTER) showSaver();
    if (saverOn) tickSaverClock($('saver').querySelector('.clock'));
  }, 30000);

  // For the browser preview and tests.
  window.FreeMyTV = {state: st, move: move, activate: activate, back: back, showSaver: showSaver, hideSaver: hideSaver, toast: toast};
})();
