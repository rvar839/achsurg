// Absite web app UI. Logic lives in core.js; progress is saved in this browser.
(function () {
  'use strict';

  var USERS = [
    { name: 'Achi', hash: 'c7349cb0d25b2d0c27f7f896c67b605fc51e207205db15c50cca2818448354d0' },
    { name: 'Mahe', hash: '368c0eafc2fbd8da7ea98c0d0429b1e3292c4ef7914eeb6e47a11fa1c26b184d' },
    { name: 'Rahul', hash: '45878fb4be730f671a50907dcdc8c4f78a5ea05cc4b586d98200e55c274c6f84' },
    { name: 'Meera', hash: '9367fb73c9f1d87053a4e03c77c288b804df94197be67706401a2751aa4bc496' },
    { name: 'Pooja', hash: '130400b0812eda744d8376680827ebb819dbe1103fd9241dd5bb9140f7c1c57d' }
  ];
  var NEW_PER_BATCH = 20;
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  var app = document.getElementById('app');
  var content = null;
  var user = null;
  var progress = Core.emptyProgress();
  var tab = 'qbank';
  var login = { selected: null, failed: false };
  var qb = { q: null, selected: null, answered: 0, correct: 0 };
  var fc = { queue: [], revealed: false, started: false, done: 0, known: 0 };
  var settings = { confirmReset: false };

  // ---- Storage -----------------------------------------------------------

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    } catch (e) { /* private mode: keep working in memory */ }
    return null;
  }
  function progressKey() { return 'absite.progress.' + user.toLowerCase(); }
  function loadProgress() {
    progress = Core.emptyProgress();
    try {
      var saved = JSON.parse(store(progressKey()) || 'null');
      if (saved && saved.attempts && saved.cards) progress = Object.assign(progress, saved);
    } catch (e) { /* start fresh */ }
  }
  function save() { store(progressKey(), JSON.stringify(progress)); }

  // ---- Helpers -----------------------------------------------------------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // `target` is the one blank this card tests; other blanks in the sentence are shown as plain text.
  function clozeHTML(text, revealed, target) {
    var k = -1;
    return Core.segments(text).map(function (s) {
      if (!s.cloze) return esc(s.text);
      k += 1;
      if (target !== undefined && k !== target) return esc(s.text);
      return revealed ? '<b class="cloze shown">' + esc(s.text) + '</b>'
                      : '<b class="cloze blank" aria-label="blank">&nbsp;</b>';
    }).join('');
  }
  function scoreClass(v) { return v >= Core.GOAL ? 'good' : v >= 0.5 ? 'warn' : 'bad'; }
  function chip(topic) { return '<span class="chip">' + esc(topic) + '</span>'; }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---- Qbank -------------------------------------------------------------

  // Random across all topics: unseen questions first, with missed ones mixed back in.
  function nextQuestion() {
    var last = Core.lastResults(progress);
    var all = content.questions;
    var unseen = all.filter(function (q) { return last[q.id] === undefined; });
    var missed = all.filter(function (q) { return last[q.id] === false; });
    var pool = all;
    if (unseen.length && (!missed.length || Math.random() < 0.75)) pool = unseen;
    else if (missed.length) pool = missed;
    var currentId = qb.q && qb.q.id;
    var candidates = pool.filter(function (q) { return q.id !== currentId; });
    var from = candidates.length ? candidates : pool;
    qb.q = from[Math.floor(Math.random() * from.length)] || null;
    qb.selected = null;
  }

  function choose(index) {
    if (qb.selected !== null || !qb.q) return;
    qb.selected = index;
    var correct = index === qb.q.answer;
    qb.answered += 1;
    if (correct) qb.correct += 1;
    Core.recordAnswer(progress, qb.q, correct, Date.now());
    save();
  }

  function qbankHTML() {
    var q = qb.q;
    if (!q) return { main: '<p class="empty">The question bank is empty.</p>' };
    var answered = qb.selected !== null;
    var html = chip(q.topic) + '<p class="stem">' + esc(q.stem) + '</p><div class="choices">';
    q.choices.forEach(function (choice, i) {
      var cls = 'choice';
      if (answered) cls += i === q.answer ? ' correct' : i === qb.selected ? ' wrong' : ' dim';
      html += '<button class="' + cls + '" data-action="choose" data-index="' + i + '">' +
        '<span class="letter">' + LETTERS[i] + '</span><span>' + esc(choice) + '</span></button>';
    });
    html += '</div>';
    if (answered) {
      var ok = qb.selected === q.answer;
      html += '<div class="panel">' +
        '<h3 class="' + (ok ? 'good' : 'bad') + '">' + (ok ? 'Correct' : 'Incorrect') + '</h3>' +
        '<p>' + esc(q.explanation) + '</p><hr>' +
        '<div class="label">Key point</div><p>' + clozeHTML(q.card.text, true) + '</p>' +
        (ok ? '' : '<p class="note">Added to your flashcards</p>') + '</div>';
    }
    return {
      main: html,
      side: qb.answered ? qb.correct + '/' + qb.answered : '',
      actions: answered ? '<button class="btn primary" data-action="next">Next question</button>' : ''
    };
  }

  // ---- Flashcards --------------------------------------------------------

  // Cards never studied: missed-question cards first, then weak topics, then the rest.
  function newCards() {
    var fresh = Core.deck(content, progress).filter(function (c) { return !progress.cards[c.id]; });
    var weak = {};
    progress.attempts.forEach(function (a) { if (!a.correct) weak[a.topic] = true; });
    var fromMissed = fresh.filter(function (c) { return c.fromMissed; });
    var rest = shuffle(fresh.filter(function (c) { return !c.fromMissed; }));
    return fromMissed
      .concat(rest.filter(function (c) { return weak[c.topic]; }))
      .concat(rest.filter(function (c) { return !weak[c.topic]; }));
  }

  // Take up to `limit` new cards, never two from the same sentence in one sitting
  // (seeing one blank filled in would give away its sibling).
  function pickNew(cards, limit, taken) {
    var recent = Date.now() - 12 * 3600000;
    var used = taken || {};
    Object.keys(progress.cards).forEach(function (id) {
      if (progress.cards[id].last > recent) used[id.replace(/\.\d+$/, '')] = true;
    });
    var out = [];
    cards.forEach(function (c) {
      if (out.length >= limit || used[c.parent]) return;
      used[c.parent] = true;
      out.push(c);
    });
    return out;
  }

  function buildQueue(includeNew) {
    var now = Date.now();
    var due = Core.deck(content, progress)
      .filter(function (c) { return progress.cards[c.id] && progress.cards[c.id].due <= now; })
      .sort(function (a, b) { return progress.cards[a.id].due - progress.cards[b.id].due; });
    var fresh = newCards();
    var taken = {};
    due.forEach(function (c) { taken[c.parent] = true; });
    var batch = pickNew(includeNew ? fresh : fresh.filter(function (c) { return c.fromMissed; }),
                        includeNew ? NEW_PER_BATCH : 50, taken);
    fc.queue = due.concat(batch);
    fc.revealed = false;
  }

  function refreshFlashcards() {
    if (!fc.started) { fc.started = true; buildQueue(true); return; }
    if (!fc.queue.length) { buildQueue(false); return; }
    // Pull in cards created by Qbank misses since this tab was last open.
    var queued = {};
    fc.queue.forEach(function (c) { queued[c.parent] = true; });
    var missed = pickNew(Core.deck(content, progress).filter(function (c) {
      return c.fromMissed && !progress.cards[c.id];
    }), 50, queued);
    if (missed.length) fc.queue.splice.apply(fc.queue, [Math.min(1, fc.queue.length), 0].concat(missed));
  }

  function answerCard(knew) {
    var card = fc.queue[0];
    if (!card || !fc.revealed) return;
    Core.recordReview(progress, card, knew, Date.now());
    save();
    fc.queue.shift();
    fc.done += 1;
    if (knew) fc.known += 1;
    // A card you did not know comes back after a few others in this same session.
    if (!knew) fc.queue.splice(Math.min(fc.queue.length, 5), 0, card);
    fc.revealed = false;
  }

  function nextDueText() {
    var now = Date.now(), next = Infinity;
    Object.keys(progress.cards).forEach(function (id) {
      var due = progress.cards[id].due;
      if (due > now && due < next) next = due;
    });
    return next === Infinity ? '' : 'Next review in ' + Core.formatInterval(next - now) + '.';
  }

  function flashcardsHTML() {
    var card = fc.queue[0];
    if (!card) {
      var remaining = pickNew(newCards(), NEW_PER_BATCH).length;
      var session = fc.done ? '<p class="session">' + fc.done + ' reviewed this session, ' +
        Core.pct(fc.known / fc.done) + ' known.</p>' : '';
      return {
        main: '<div class="empty"><h2>All caught up</h2>' + session +
          '<p>' + (nextDueText() || 'No cards are due right now.') + '</p>' +
          (remaining ? '<button class="btn primary inline" data-action="more">Learn ' + remaining + ' new cards</button>' : '') +
          '</div>'
      };
    }
    var state = progress.cards[card.id];
    var total = fc.done + fc.queue.length;
    var points = (card.points && card.points.length ? card.points : [card.extra]);
    var html = '<div class="progress"><i style="width:' + (total ? (100 * fc.done / total).toFixed(0) : 0) + '%"></i></div>' +
      '<div class="card' + (fc.revealed ? ' revealed' : '') + '" data-action="reveal">' +
      '<div class="row">' + chip(card.topic) +
      '<span class="tag ' + (card.fromMissed ? 'warn' : 'muted') + '">' +
      (card.fromMissed ? 'Missed question' : !state ? 'New' : state.lapses ? 'Relearning' : 'Review') + '</span></div>' +
      '<p class="cloze-text">' + clozeHTML(card.text, fc.revealed, card.target) + '</p>' +
      (fc.revealed
        ? '<ul class="points">' + points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>'
        : '<p class="hint">Tap to reveal</p>') + '</div>';
    var off = fc.revealed ? '' : ' disabled';
    var now = Date.now();
    return {
      main: html,
      side: fc.queue.length + ' left',
      actions: '<button class="btn bad two" data-action="dontknow"' + off + '><span>Don\'t know</span><small>again in ' +
               Core.formatInterval(Core.preview(state, false, now)) + '</small></button>' +
               '<button class="btn good two" data-action="know"' + off + '><span>Know</span><small>back in ' +
               Core.formatInterval(Core.preview(state, true, now)) + '</small></button>'
    };
  }

  // ---- Analytics ---------------------------------------------------------

  function ringHTML(score) {
    var r = 83, c = 2 * Math.PI * r;
    return '<div class="ring"><svg viewBox="0 0 200 200" aria-hidden="true">' +
      '<circle class="ring-track" cx="100" cy="100" r="' + r + '"/>' +
      '<circle class="ring-value ' + scoreClass(score) + '" cx="100" cy="100" r="' + r + '" ' +
      'stroke-dasharray="' + Math.max(0.5, score * c).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 100 100)"/>' +
      '<line class="ring-goal" x1="100" y1="6" x2="100" y2="28" transform="rotate(' + (360 * Core.GOAL) + ' 100 100)"/>' +
      '</svg><div class="ring-label"><div class="score">' + Core.pct(score) + '</div>' +
      '<div class="goal">Goal ' + Core.pct(Core.GOAL) + '</div></div></div>';
  }

  function analyticsHTML() {
    var s = Core.summarize(progress, content, Date.now());
    var html = ringHTML(s.score) +
      '<p class="next">' + esc(s.hasData ? s.nextStep : 'Answer questions and review flashcards to build your score.') + '</p>' +
      '<div class="metrics">' +
      '<div><b>' + Core.pct(s.questionScore) + '</b><span>Qbank ' + s.questionsSeen + '/' + s.questionsTotal + '</span></div>' +
      '<div><b>' + Core.pct(s.cardScore) + '</b><span>Cards ' + s.cardsSeen + '/' + s.cardsTotal + '</span></div>' +
      '<div><b>' + s.cardsDue + '</b><span>Due now</span></div></div>';
    if (!s.hasData) return { main: html };

    html += '<div class="label section">Insights</div><div class="panel">' +
      s.insights.map(function (line) { return '<p>' + esc(line) + '</p>'; }).join('') + '</div>';

    html += '<div class="label section">Topics, weakest first</div><div class="panel">';
    s.topics.filter(function (t) { return t.started; }).forEach(function (t) {
      var cls = scoreClass(t.score);
      html += '<div class="topic"><div class="row"><span>' + esc(t.topic) + '</span>' +
        '<b class="' + cls + '">' + Core.pct(t.score) + '</b></div>' +
        '<div class="bar"><i class="bg-' + cls + '" style="width:' + Math.max(2, t.score * 100).toFixed(0) + '%"></i></div></div>';
    });
    var untouched = s.topics.filter(function (t) { return !t.started; });
    if (untouched.length) {
      html += '<p class="muted small">Not started: ' +
        esc(untouched.map(function (t) { return t.topic; }).join(', ')) + '</p>';
    }
    html += '</div>';

    if (s.missed.length) {
      html += '<div class="label section">Review manually</div><div class="panel">';
      s.missed.slice(0, 12).forEach(function (m) {
        html += '<div class="missed"><div class="row"><span class="accent small strong">' + esc(m.topic) + '</span>' +
          '<span class="small ' + (m.resolved ? 'good' : 'bad') + '">' +
          (m.resolved ? 'Now correct' : 'Missed ' + m.misses + 'x') + '</span></div>' +
          '<p>' + esc(m.concept) + '</p></div>';
      });
      html += '</div>';
    }
    return { main: html };
  }

  // ---- Settings & login --------------------------------------------------

  function settingsHTML() {
    return {
      main: '<div class="label section">Account</div><div class="panel">' +
        '<div class="row"><span>Signed in as</span><b>' + esc(user) + '</b></div><hr>' +
        '<button class="link" data-action="signout">Sign out</button></div>' +
        '<div class="label section">Progress</div><div class="panel">' +
        (settings.confirmReset
          ? '<p>Reset all progress? This cannot be undone.</p><div class="row">' +
            '<button class="link" data-action="reset-cancel">Cancel</button>' +
            '<button class="link bad" data-action="reset-confirm">Reset</button></div>'
          : '<button class="link bad" data-action="reset">Reset my progress</button>') +
        '</div><p class="muted small">Progress is saved in this browser on this device. Use the same browser each time, and avoid private browsing.</p>' +
        '<div class="label section">About</div><div class="panel">' +
        '<a class="link" href="privacy.html">Privacy Policy</a><hr><a class="link" href="support.html">Support</a></div>'
    };
  }

  function loginHTML() {
    var html = '<div class="login"><h1>Absite</h1><p class="muted">Who\'s studying?</p><div class="users">';
    USERS.forEach(function (u) {
      html += '<button class="user' + (login.selected === u.name ? ' on' : '') + '" data-action="pick" data-name="' +
        esc(u.name) + '">' + esc(u.name) + '</button>';
    });
    html += '</div>';
    if (login.selected) {
      html += '<form data-form="login"><input id="passcode" type="password" placeholder="Passcode" ' +
        'autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false">' +
        (login.failed ? '<p class="bad small">Wrong passcode. Try again.</p>' : '') +
        '<button class="btn primary" type="submit">Unlock</button></form>';
    }
    return html + '</div>';
  }

  function unlock() {
    var input = document.getElementById('passcode');
    var account = USERS.filter(function (u) { return u.name === login.selected; })[0];
    if (!input || !account) return;
    if (Core.sha256('absite.v1:' + input.value) === account.hash) {
      user = account.name;
      store('absite.user', user);
      loadProgress();
      login = { selected: null, failed: false };
      startSession();
    } else {
      login.failed = true;
    }
  }

  function startSession() {
    tab = 'qbank';
    qb = { q: null, selected: null, answered: 0, correct: 0 };
    fc = { queue: [], revealed: false, started: false, done: 0, known: 0 };
    nextQuestion();
  }

  // ---- Render ------------------------------------------------------------

  var TABS = [['qbank', 'Qbank'], ['flashcards', 'Flashcards'], ['analytics', 'Analytics'], ['settings', 'Settings']];

  function render(keepScroll) {
    if (!content) { app.innerHTML = '<p class="empty">Loading...</p>'; return; }
    if (!user) {
      app.innerHTML = loginHTML();
      var input = document.getElementById('passcode');
      if (input) input.focus();
      return;
    }
    var view = tab === 'qbank' ? qbankHTML() : tab === 'flashcards' ? flashcardsHTML()
      : tab === 'analytics' ? analyticsHTML() : settingsHTML();
    var title = TABS.filter(function (t) { return t[0] === tab; })[0][1];
    var main = document.querySelector('main');
    var scroll = keepScroll && main ? main.scrollTop : 0;
    app.innerHTML =
      '<header><span></span><h1>' + title + '</h1><span class="side">' + (view.side || '') + '</span></header>' +
      '<main>' + view.main + '</main>' +
      (view.actions ? '<div class="actions">' + view.actions + '</div>' : '') +
      '<nav>' + TABS.map(function (t) {
        return '<button data-action="tab" data-tab="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : '') + '>' + t[1] + '</button>';
      }).join('') + '</nav>';
    document.querySelector('main').scrollTop = scroll;
  }

  app.addEventListener('click', function (event) {
    var el = event.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var keepScroll = false;
    switch (action) {
      case 'pick': login.selected = el.getAttribute('data-name'); login.failed = false; break;
      case 'tab':
        tab = el.getAttribute('data-tab');
        settings.confirmReset = false;
        if (tab === 'flashcards') refreshFlashcards();
        if (tab === 'qbank' && !qb.q) nextQuestion();
        break;
      case 'choose': choose(Number(el.getAttribute('data-index'))); keepScroll = true; break;
      case 'next': nextQuestion(); break;
      case 'reveal': if (fc.revealed) return; fc.revealed = true; keepScroll = true; break;
      case 'know': answerCard(true); break;
      case 'dontknow': answerCard(false); break;
      case 'more': buildQueue(true); break;
      case 'signout': user = null; store('absite.user', null); progress = Core.emptyProgress(); break;
      case 'reset': settings.confirmReset = true; keepScroll = true; break;
      case 'reset-cancel': settings.confirmReset = false; keepScroll = true; break;
      case 'reset-confirm':
        progress = Core.emptyProgress(); save(); settings.confirmReset = false; startSession(); tab = 'settings';
        break;
      default: return;
    }
    render(keepScroll);
  });

  // Swipe a revealed card: right = Know, left = Don't know.
  var touch = null;
  app.addEventListener('touchstart', function (event) {
    var el = event.target.closest('.card');
    if (!el || tab !== 'flashcards' || !fc.revealed) { touch = null; return; }
    var t = event.touches[0];
    touch = { x: t.clientX, y: t.clientY, dx: 0, dy: 0, el: el };
  }, { passive: true });
  app.addEventListener('touchmove', function (event) {
    if (!touch) return;
    var t = event.touches[0];
    touch.dx = t.clientX - touch.x;
    touch.dy = t.clientY - touch.y;
    if (Math.abs(touch.dx) > Math.abs(touch.dy)) {
      touch.el.style.transform = 'translateX(' + touch.dx + 'px) rotate(' + (touch.dx / 40) + 'deg)';
      touch.el.style.boxShadow = '0 0 0 2px var(--' + (touch.dx > 0 ? 'good' : 'bad') + ')';
    }
  }, { passive: true });
  app.addEventListener('touchend', function () {
    if (!touch) return;
    var t = touch;
    touch = null;
    if (Math.abs(t.dx) > 80 && Math.abs(t.dx) > Math.abs(t.dy) * 1.5) {
      answerCard(t.dx > 0);
      render();
    } else {
      t.el.style.transform = '';
      t.el.style.boxShadow = '';
    }
  });

  // Keyboard on a computer: Space reveals, Right arrow = Know, Left arrow = Don't know.
  document.addEventListener('keydown', function (event) {
    if (!user || tab !== 'flashcards' || !fc.queue.length) return;
    if (event.target && event.target.tagName === 'INPUT') return;
    if (!fc.revealed && (event.key === ' ' || event.key === 'Enter')) { fc.revealed = true; }
    else if (fc.revealed && event.key === 'ArrowRight') { answerCard(true); }
    else if (fc.revealed && event.key === 'ArrowLeft') { answerCard(false); }
    else return;
    event.preventDefault();
    render(!fc.revealed ? false : true);
  });

  app.addEventListener('submit', function (event) {
    event.preventDefault();
    unlock();
    render();
  });

  // ---- Start -------------------------------------------------------------

  function loadJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  render();
  Promise.all([loadJSON('content/questions.json'), loadJSON('content/cards.json')]).then(function (data) {
    content = { questions: data[0], cards: data[1] };
    var saved = store('absite.user');
    if (saved && USERS.some(function (u) { return u.name === saved; })) {
      user = saved;
      loadProgress();
      startSession();
    }
    render();
  }).catch(function () {
    app.innerHTML = '<p class="empty">Could not load the content. Check your connection and reload.</p>';
  });
})();
