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
  var QUESTION_SHARE = 0.35; // share of Learn items that are multiple-choice questions
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  var app = document.getElementById('app');
  var content = null;
  var user = null;
  var progress = Core.emptyProgress();
  var tab = 'learn';
  var login = { selected: null, failed: false };
  var learn = newLearn();
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
  // The SCORE curriculum category an item belongs to. A card made from a missed question takes the question's.
  function scoreOf(item) {
    if (item.score) return item.score;
    if (item.fromMissed) {
      var qid = String(item.parent || item.id).replace(/^missed-/, '');
      var q = content.questions.filter(function (x) { return x.id === qid; })[0];
      if (q && q.score) return q.score;
    }
    return item.topic;
  }
  function chip(item) { return '<span class="chip">SCORE: ' + esc(scoreOf(item)) + '</span>'; }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---- Learn: one continuous stream of questions and flashcards ----------

  function newLearn() {
    return { item: null, kind: null, selected: null, revealed: false, recent: [], lastQ: null, afterMiss: false };
  }

  // Unseen questions first, with missed ones mixed back in.
  function pickQuestion() {
    var last = Core.lastResults(progress);
    var all = content.questions;
    var unseen = all.filter(function (q) { return last[q.id] === undefined; });
    var missed = all.filter(function (q) { return last[q.id] === false; });
    var pool = all;
    if (unseen.length && (!missed.length || Math.random() < 0.75)) pool = unseen;
    else if (missed.length) pool = missed;
    var candidates = pool.filter(function (q) { return q.id !== learn.lastQ; });
    var from = candidates.length ? candidates : pool;
    return from[Math.floor(Math.random() * from.length)] || null;
  }

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

  // Due cards first, then a new card, then whichever card is closest to due. Never a card whose
  // sentence was shown in the last few items or studied in the last 12 hours as a sibling blank
  // (seeing one blank filled in would give away the other).
  function pickCard() {
    var now = Date.now();
    var deck = Core.deck(content, progress);
    var blocked = {};
    learn.recent.forEach(function (parent) { blocked[parent] = true; });
    function free(c) { return !blocked[c.parent]; }
    var due = deck.filter(function (c) { return progress.cards[c.id] && progress.cards[c.id].due <= now && free(c); })
      .sort(function (a, b) { return progress.cards[a.id].due - progress.cards[b.id].due; });
    var fresh = newCards().filter(free);
    if (learn.afterMiss && fresh.length && fresh[0].fromMissed) return fresh[0];
    if (due.length) return due[0];
    var recent = now - 12 * 3600000;
    var studied = {};
    Object.keys(progress.cards).forEach(function (id) {
      if (progress.cards[id].last > recent) studied[id.replace(/\.\d+$/, '')] = true;
    });
    var unseen = fresh.filter(function (c) { return !studied[c.parent]; });
    if (unseen.length) return unseen[0];
    var rest = deck.filter(free);
    if (!rest.length) rest = deck;
    function dueAt(c) { return progress.cards[c.id] ? progress.cards[c.id].due : 0; }
    rest.sort(function (a, b) { return dueAt(a) - dueAt(b); });
    return rest[Math.floor(Math.random() * Math.min(10, rest.length))] || null;
  }

  function nextItem() {
    var q = null, card = null;
    if (!learn.afterMiss && Math.random() < QUESTION_SHARE) q = pickQuestion();
    if (!q) card = pickCard();
    if (!q && !card) q = pickQuestion();
    learn.afterMiss = false;
    learn.item = q || card;
    learn.kind = q ? 'q' : card ? 'c' : null;
    learn.selected = null;
    learn.revealed = false;
    if (q) learn.lastQ = q.id;
  }

  function choose(index) {
    var q = learn.item;
    if (learn.kind !== 'q' || learn.selected !== null || !q) return;
    learn.selected = index;
    var correct = index === q.answer;
    if (!correct) learn.afterMiss = true; // its key-point flashcard comes next
    Core.recordAnswer(progress, q, correct, Date.now());
    save();
  }

  function answerCard(knew) {
    var card = learn.item;
    if (learn.kind !== 'c' || !card || !learn.revealed) return;
    Core.recordReview(progress, card, knew, Date.now());
    save();
    learn.recent.push(card.parent);
    if (learn.recent.length > 6) learn.recent.shift();
    nextItem();
  }

  function questionHTML(q) {
    var answered = learn.selected !== null;
    var html = '<div class="row">' + chip(q) + '<span class="tag muted">Question</span></div>' +
      '<p class="stem">' + esc(q.stem) + '</p><div class="choices">';
    q.choices.forEach(function (choice, i) {
      var cls = 'choice';
      if (answered) cls += i === q.answer ? ' correct' : i === learn.selected ? ' wrong' : ' dim';
      html += '<button class="' + cls + '" data-action="choose" data-index="' + i + '">' +
        '<span class="letter">' + LETTERS[i] + '</span><span>' + esc(choice) + '</span></button>';
    });
    html += '</div>';
    if (answered) {
      var ok = learn.selected === q.answer;
      html += '<div class="panel">' +
        '<h3 class="' + (ok ? 'good' : 'bad') + '">' + (ok ? 'Correct' : 'Incorrect') + '</h3>' +
        '<p>' + esc(q.explanation) + '</p><hr>' +
        '<div class="label">Key point</div><p>' + clozeHTML(q.card.text, true) + '</p>' +
        (ok ? '' : '<p class="note">Its flashcard comes next</p>') + '</div>';
    }
    return { main: html, actions: answered ? '<button class="btn primary" data-action="next">Next</button>' : '' };
  }

  function cardHTML(card) {
    var state = progress.cards[card.id];
    var points = (card.points && card.points.length ? card.points : [card.extra]);
    var html = '<div class="card' + (learn.revealed ? ' revealed' : '') + '" data-action="reveal">' +
      '<div class="row">' + chip(card) +
      '<span class="tag ' + (card.fromMissed ? 'warn' : 'muted') + '">' +
      (card.fromMissed ? 'Missed question' : !state ? 'New' : state.lapses ? 'Relearning' : 'Review') + '</span></div>' +
      '<p class="cloze-text">' + clozeHTML(card.text, learn.revealed, card.target) + '</p>' +
      (learn.revealed
        ? '<ul class="points">' + points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>'
        : '<p class="hint">Tap to reveal</p>') + '</div>';
    var off = learn.revealed ? '' : ' disabled';
    var now = Date.now();
    return {
      main: html,
      actions: '<button class="btn bad two" data-action="dontknow"' + off + '><span>Don\'t know</span><small>again in ' +
               Core.formatInterval(Core.preview(state, false, now)) + '</small></button>' +
               '<button class="btn good two" data-action="know"' + off + '><span>Know</span><small>back in ' +
               Core.formatInterval(Core.preview(state, true, now)) + '</small></button>'
    };
  }

  function learnHTML() {
    if (!learn.item) return { main: '<p class="empty">There is nothing to study yet.</p>' };
    return learn.kind === 'q' ? questionHTML(learn.item) : cardHTML(learn.item);
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
      '<p class="next">' + esc(s.hasData ? s.nextStep.replace('Keep going in the Qbank.', 'Keep going in Learn.').replace('Learn a new batch.', 'Keep going in Learn.') : 'Answer questions and review flashcards in Learn to build your score.') + '</p>' +
      '<div class="metrics">' +
      '<div><b>' + Core.pct(s.questionScore) + '</b><span>Questions ' + s.questionsSeen + '/' + s.questionsTotal + '</span></div>' +
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
    tab = 'learn';
    learn = newLearn();
    nextItem();
  }

  // ---- Render ------------------------------------------------------------

  var TABS = [['learn', 'Learn'], ['analytics', 'Analytics'], ['settings', 'Settings']];

  function render(keepScroll) {
    if (!content) { app.innerHTML = '<p class="empty">Loading...</p>'; return; }
    if (!user) {
      app.innerHTML = loginHTML();
      var input = document.getElementById('passcode');
      if (input) input.focus();
      return;
    }
    var view = tab === 'learn' ? learnHTML() : tab === 'analytics' ? analyticsHTML() : settingsHTML();
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
        if (tab === 'learn' && !learn.item) nextItem();
        break;
      case 'choose': choose(Number(el.getAttribute('data-index'))); keepScroll = true; break;
      case 'next': nextItem(); break;
      case 'reveal': if (learn.kind !== 'c' || learn.revealed) return; learn.revealed = true; keepScroll = true; break;
      case 'know': answerCard(true); break;
      case 'dontknow': answerCard(false); break;
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
    if (!el || tab !== 'learn' || learn.kind !== 'c' || !learn.revealed) { touch = null; return; }
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
    if (!user || tab !== 'learn' || learn.kind !== 'c' || !learn.item) return;
    if (event.target && event.target.tagName === 'INPUT') return;
    if (!learn.revealed && (event.key === ' ' || event.key === 'Enter')) { learn.revealed = true; }
    else if (learn.revealed && event.key === 'ArrowRight') { answerCard(true); }
    else if (learn.revealed && event.key === 'ArrowLeft') { answerCard(false); }
    else return;
    event.preventDefault();
    render(learn.kind === 'c' && learn.revealed);
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
