// Absite core logic: spaced repetition, scoring and analytics.
// Mirrors the iPhone app (Absite/Core/*.swift). No DOM access here so it can be tested in Node.
(function (root) {
  'use strict';

  var GOAL = 0.7;
  var DAY = 86400000;
  var INTERVALS = [1, 3, 7, 14, 30, 60, 120]; // days
  var RELEARN_MS = 10 * 60 * 1000;

  // ---- Spaced repetition -------------------------------------------------

  function review(state, knew, now) {
    var next = state ? Object.assign({}, state) : { box: 0, due: now, reviews: 0, lapses: 0 };
    next.reviews += 1;
    next.last = now;
    if (knew) {
      var index = Math.min(next.box, INTERVALS.length - 1);
      var ease = Math.max(0.5, 1 - 0.15 * next.lapses); // cards that keep slipping come back sooner
      next.due = now + INTERVALS[index] * DAY * ease;
      next.box = Math.min(next.box + 1, INTERVALS.length);
    } else {
      next.lapses += 1;
      next.box = 0;
      next.due = now + RELEARN_MS;
    }
    return next;
  }

  function cardCredit(state) {
    if (!state) return 0;
    if (state.box <= 0) return 0;
    if (state.box === 1) return 0.4;
    if (state.box === 2) return 0.7;
    return 1;
  }

  // ---- Cloze -------------------------------------------------------------

  function segments(text) {
    var out = [];
    var rest = text;
    for (;;) {
      var open = rest.indexOf('{{');
      if (open < 0) break;
      if (open > 0) out.push({ text: rest.slice(0, open), cloze: false });
      var after = rest.slice(open + 2);
      var close = after.indexOf('}}');
      if (close < 0) { out.push({ text: after, cloze: false }); return out; }
      out.push({ text: after.slice(0, close), cloze: true });
      rest = after.slice(close + 2);
    }
    if (rest) out.push({ text: rest, cloze: false });
    return out;
  }

  function plain(text) {
    return segments(text).map(function (s) { return s.text; }).join('');
  }

  // ---- Progress helpers --------------------------------------------------

  function emptyProgress() {
    return { attempts: [], cards: {}, missed: [], days: [] };
  }

  function dayKey(ms) {
    var d = new Date(ms);
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function lastResults(progress) {
    var out = {};
    progress.attempts.forEach(function (a) { out[a.id] = a.correct; });
    return out;
  }

  function missedCard(q) {
    return { id: 'missed-' + q.id, topic: q.topic, text: q.card.text, extra: q.card.extra, fromMissed: true };
  }

  // Full deck for a user: cards from missed questions first, then the core deck.
  function deck(content, progress) {
    var byId = {};
    content.questions.forEach(function (q) { byId[q.id] = q; });
    var missed = progress.missed.filter(function (id) { return byId[id]; })
      .map(function (id) { return missedCard(byId[id]); });
    return missed.concat(content.cards);
  }

  function recordAnswer(progress, q, correct, now) {
    progress.attempts.push({ id: q.id, topic: q.topic, correct: correct, t: now });
    if (!correct && progress.missed.indexOf(q.id) < 0) progress.missed.push(q.id);
    markActive(progress, now);
  }

  function recordReview(progress, card, knew, now) {
    progress.cards[card.id] = review(progress.cards[card.id], knew, now);
    markActive(progress, now);
  }

  function markActive(progress, now) {
    var key = dayKey(now);
    if (progress.days.indexOf(key) < 0) progress.days.push(key);
  }

  function streak(days, now) {
    var set = {};
    days.forEach(function (d) { set[d] = true; });
    var date = new Date(now);
    date.setHours(12, 0, 0, 0);
    if (!set[dayKey(date.getTime())]) date.setDate(date.getDate() - 1);
    var count = 0;
    while (set[dayKey(date.getTime())]) { count += 1; date.setDate(date.getDate() - 1); }
    return count;
  }

  // ---- Analytics ---------------------------------------------------------

  function blend(qCredit, qTotal, cCredit, cTotal) {
    var q = qTotal > 0 ? qCredit / qTotal : null;
    var c = cTotal > 0 ? cCredit / cTotal : null;
    if (q !== null && c !== null) return (q + c) / 2;
    if (q !== null) return q;
    if (c !== null) return c;
    return 0;
  }

  function pct(v) { return Math.round(v * 100) + '%'; }

  function summarize(progress, content, now) {
    var stats = {};
    function stat(topic) {
      if (!stats[topic]) {
        stats[topic] = { topic: topic, qTotal: 0, qSeen: 0, qCredit: 0, cTotal: 0, cSeen: 0, cCredit: 0, misses: 0 };
      }
      return stats[topic];
    }
    var last = lastResults(progress);
    var missCounts = {};
    progress.attempts.forEach(function (a) { if (!a.correct) missCounts[a.id] = (missCounts[a.id] || 0) + 1; });

    var s = { questionsSeen: 0, cardsSeen: 0, cardsDue: 0 };
    var qCredit = 0, cCredit = 0;
    var byId = {};

    content.questions.forEach(function (q) {
      byId[q.id] = q;
      var t = stat(q.topic);
      t.qTotal += 1;
      if (last[q.id] !== undefined) {
        t.qSeen += 1; s.questionsSeen += 1;
        if (last[q.id]) { t.qCredit += 1; qCredit += 1; }
      }
      t.misses += missCounts[q.id] || 0;
    });

    var all = deck(content, progress);
    all.forEach(function (card) {
      var t = stat(card.topic);
      t.cTotal += 1;
      var state = progress.cards[card.id];
      if (state) {
        t.cSeen += 1; s.cardsSeen += 1;
        var credit = cardCredit(state);
        t.cCredit += credit; cCredit += credit;
        if (state.due <= now) s.cardsDue += 1;
      }
    });

    s.questionsTotal = content.questions.length;
    s.cardsTotal = all.length;
    s.questionScore = s.questionsTotal ? qCredit / s.questionsTotal : 0;
    s.cardScore = s.cardsTotal ? cCredit / s.cardsTotal : 0;
    s.score = blend(qCredit, s.questionsTotal, cCredit, s.cardsTotal);
    s.hasData = s.questionsSeen + s.cardsSeen > 0;

    s.topics = Object.keys(stats).map(function (k) {
      var t = stats[k];
      t.started = t.qSeen + t.cSeen > 0;
      t.score = blend(t.qCredit, t.qTotal, t.cCredit, t.cTotal);
      return t;
    }).sort(function (a, b) {
      if (a.started !== b.started) return a.started ? -1 : 1;
      if (a.score !== b.score) return a.score - b.score;
      return a.topic < b.topic ? -1 : 1;
    });
    s.weak = s.topics.filter(function (t) { return t.started && t.score < 0.5; });
    s.strong = s.topics.filter(function (t) { return t.score >= GOAL; });
    s.streak = streak(progress.days, now);

    s.missed = Object.keys(missCounts).filter(function (id) { return byId[id]; }).map(function (id) {
      return { id: id, topic: byId[id].topic, concept: plain(byId[id].card.text),
               misses: missCounts[id], resolved: last[id] === true };
    }).sort(function (a, b) {
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
      if (a.misses !== b.misses) return b.misses - a.misses;
      return a.id < b.id ? -1 : 1;
    });

    s.nextStep = nextStep(s);
    s.insights = insights(s, progress);
    return s;
  }

  function nextStep(s) {
    if (s.cardsDue > 0) {
      return s.cardsDue + (s.cardsDue === 1 ? ' flashcard is' : ' flashcards are') + ' due. Review them first.';
    }
    if (s.weak.length) return 'Weakest area: ' + s.weak[0].topic + '. Do its questions and cards next.';
    if (s.questionsSeen < s.questionsTotal) {
      return (s.questionsTotal - s.questionsSeen) + ' questions not yet attempted. Keep going in the Qbank.';
    }
    if (s.cardsSeen < s.cardsTotal) {
      return (s.cardsTotal - s.cardsSeen) + ' flashcards not yet started. Learn a new batch.';
    }
    return s.score >= GOAL ? 'At goal. Keep up the daily reviews.' : 'Keep reviewing due cards to lift the score.';
  }

  function insights(s, progress) {
    var out = [];
    var gap = GOAL - s.score;
    out.push(gap > 0 ? pct(gap) + ' to go to reach the ' + pct(GOAL) + ' goal.'
                     : 'You are at or above the ' + pct(GOAL) + ' goal.');

    if (s.questionsSeen >= 5 && s.cardsSeen >= 5) {
      if (s.questionScore > s.cardScore + 0.15) {
        out.push('Questions are ahead of flashcards. More spaced repetition will lift the score fastest.');
      } else if (s.cardScore > s.questionScore + 0.15) {
        out.push('Flashcards are ahead of questions. More Qbank practice will lift the score fastest.');
      }
    }

    var a = progress.attempts;
    if (a.length >= 20) {
      var count = function (list) { return list.filter(function (x) { return x.correct; }).length; };
      var recent = count(a.slice(-10)), earlier = count(a.slice(-20, -10));
      if (recent >= earlier + 2) out.push('Trending up: ' + recent + '/10 on your latest questions versus ' + earlier + '/10 before.');
      else if (earlier >= recent + 2) out.push('Trending down: ' + recent + '/10 on your latest questions versus ' + earlier + '/10 before.');
    }

    var slipping = Object.keys(progress.cards).filter(function (id) { return progress.cards[id].lapses >= 3; }).length;
    if (slipping > 0) {
      out.push(slipping + (slipping === 1 ? ' flashcard keeps' : ' flashcards keep') + ' slipping. Read those explanations slowly.');
    }
    var untouched = s.topics.filter(function (t) { return !t.started; }).length;
    if (untouched > 0 && s.hasData) out.push(untouched + ' of ' + s.topics.length + ' topics not started yet.');
    if (s.streak >= 2) out.push(s.streak + '-day study streak.');
    return out;
  }

  // ---- SHA-256 (for the passcode check; works without HTTPS) -------------

  function sha256(str) {
    var K = [], H = [], isPrime = {}, n = 2, i, j;
    while (K.length < 64) {
      if (!isPrime[n]) {
        for (i = n * n; i < 320; i += n) isPrime[i] = true;
        if (H.length < 8) H.push((Math.pow(n, 0.5) * 4294967296) | 0);
        K.push((Math.pow(n, 1 / 3) * 4294967296) | 0);
      }
      n += 1;
    }
    var bytes = unescape(encodeURIComponent(str)).split('').map(function (c) { return c.charCodeAt(0); });
    var bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLength >>> (i * 8)) & 255);

    var rotr = function (x, r) { return (x >>> r) | (x << (32 - r)); };
    for (var off = 0; off < bytes.length; off += 64) {
      var w = [];
      for (i = 0; i < 64; i++) {
        if (i < 16) {
          j = off + i * 4;
          w[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
        } else {
          var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
          var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  var Core = {
    GOAL: GOAL, DAY: DAY, INTERVALS: INTERVALS, RELEARN_MS: RELEARN_MS,
    review: review, cardCredit: cardCredit, segments: segments, plain: plain,
    emptyProgress: emptyProgress, lastResults: lastResults, deck: deck,
    recordAnswer: recordAnswer, recordReview: recordReview, streak: streak,
    summarize: summarize, pct: pct, sha256: sha256
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else root.Core = Core;
})(this);
