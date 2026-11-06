(function () {
  "use strict";

  var STORE_KEY = "ittakestwo.v1";
  var G = window.GUIDE;
  var S = window.SOURCES;
  var L = window.LEVELS || null;
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Saved state: wrapped so the site still works if storage is blocked ---------- */
  var state = { levels: { marc: "", nicky: "" }, checks: {}, log: [], xp: {} };
  try {
    var raw = localStorage.getItem(STORE_KEY);
    var saved = raw && JSON.parse(raw.replace(/nikki/g, "nicky").replace(/Nikki/g, "Nicky"));
    if (saved) state = Object.assign(state, saved);
  } catch (e) {}
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- Text helpers ---------- */
  var TAGS = {
    F: ["forever", "FOREVER"], C: ["classic", "CLASSIC"], T: ["test", "TEST"],
    J: ["judgment", "JUDGMENT"], B: ["baseline", "BASELINE"], V: ["verify", "VERIFY"],
  };
  function tagged(html) {
    return html.replace(/\{([FCTJBV])\}/g, function (_, k) {
      return '<span class="tag ' + TAGS[k][0] + '">' + TAGS[k][1] + "</span>";
    });
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function scrollToEl(el) {
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  }

  // Turns [12,26] and [12-14] in a guide section into links to that section's numbered source list.
  function linkCitations(root) {
    root.querySelectorAll("[data-src]").forEach(function (el) {
      var list = { r: "revision", o: "original", u: "update" }[el.getAttribute("data-src")] || "original";
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var nodes = [];
      while (walker.nextNode()) {
        var n = walker.currentNode;
        var owner = n.parentElement.closest("[data-src]");
        if (owner === el && /\[\d[\d,\s-]*\]/.test(n.nodeValue)) nodes.push(n);
      }
      nodes.forEach(function (n) {
        var span = document.createElement("span");
        span.innerHTML = esc(n.nodeValue).replace(/\[(\d[\d,\s-]*)\]/g, function (_, body) {
          var parts = body.split(",").map(function (part) {
            var first = part.trim().split("-")[0];
            if (!S[list][first]) return part.trim();
            return '<a href="#sources/src-' + list + "-" + first + '" title="' + esc(S[list][first].label) + '">' + part.trim() + "</a>";
          });
          return '<sup class="cite">[' + parts.join(",") + "]</sup>";
        });
        n.replaceWith.apply(n, Array.from(span.childNodes));
      });
    });
  }

  /* ---------- Tables rendered from data ---------- */
  function rows(id, html) { document.querySelector("#" + id + " tbody").innerHTML = html; }
  function bandLabel(a, b) { return a === b ? String(a) : a + "–" + b; }

  rows("quick-table", G.quick.map(function (q) {
    return '<tr data-from="' + q[0] + '" data-to="' + q[1] + '"><td><a href="#route/' + q[4] + '">' + bandLabel(q[0], q[1]) + "</a></td><td>" + esc(q[2]) + "</td><td>" + esc(q[3]) + "</td></tr>";
  }).join(""));
  rows("camps-table", G.camps.map(function (c) {
    return "<tr><td>" + bandLabel(c[0], c[1]) + "</td><td>" + esc(c[2]) + "</td><td>" + esc(c[3]) + "</td><td>" + esc(c[4]) + "</td></tr>";
  }).join(""));
  ["marc", "nicky"].forEach(function (who) {
    rows(who + "-table", G[who].map(function (t) {
      return '<tr data-level="' + t[0] + '"><td>' + t[0] + "</td><td>" + esc(t[1]) + "</td></tr>";
    }).join(""));
  });
  rows("ledger", G.crafts.map(function (craft) {
    var cells = ["marc-150", "marc-225", "nicky-150", "nicky-225"].map(function (k) {
      var id = "ledger-" + craft + "-" + k;
      return '<td><label class="tick"><input type="checkbox" data-check="' + id + '" aria-label="' + craft + " " + k.replace("-", " ") + '"></label></td>';
    }).join("");
    return "<tr><td>" + craft + "</td>" + cells + "</tr>";
  }).join(""));

  /* ---------- Sources ---------- */
  ["revision", "original", "update"].forEach(function (list) {
    if (!S[list] || !document.getElementById("src-" + list)) return;
    document.getElementById("src-" + list).innerHTML = Object.keys(S[list]).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
      var s = S[list][n];
      return '<li id="src-' + list + "-" + n + '" value="' + n + '"><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + "</a></li>";
    }).join("");
  });

  /* ---------- Tags, citations, checklists ---------- */
  var main = document.getElementById("main");
  main.innerHTML = tagged(main.innerHTML);
  linkCitations(main);

  main.querySelectorAll("ul.checks li").forEach(function (li) {
    var id = "c-" + hash(li.textContent.trim());
    var label = document.createElement("label");
    var box = document.createElement("input");
    box.type = "checkbox";
    box.setAttribute("data-check", id);
    label.appendChild(box);
    var text = document.createElement("span");
    while (li.firstChild) text.appendChild(li.firstChild);
    label.appendChild(text);
    li.appendChild(label);
  });
  function syncChecks() {
    main.querySelectorAll("[data-check]").forEach(function (box) {
      box.checked = !!state.checks[box.getAttribute("data-check")];
    });
    updateCounts();
  }
  main.addEventListener("change", function (e) {
    var id = e.target.getAttribute && e.target.getAttribute("data-check");
    if (!id) return;
    if (e.target.checked) state.checks[id] = 1; else delete state.checks[id];
    save();
    updateCounts();
  });

  // Lets wide tables stack into labelled rows on phones (see styles.css). Runs after every table is rendered.
  function stackTables() { main.querySelectorAll("table").forEach(function (table) {
    var heads = table.querySelectorAll("thead th");
    if (heads.length < 3 || table.id === "ledger" || table.classList.contains("stack")) return;
    table.classList.add("stack");
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      Array.from(tr.children).forEach(function (td, i) {
        if (i > 0 && heads[i]) {
          td.setAttribute("data-label", heads[i].textContent);
          if (td.textContent.trim().length < 28) td.classList.add("short");
        }
      });
    });
  }); }

  main.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("button.copy, button[data-copy]");
    if (!btn) return;
    var source = btn.getAttribute("data-copy");
    var text = source != null ? source : (btn.parentElement.querySelector(".copy-text") || btn.parentElement).textContent.trim().replace(/^"|"$/g, "");
    var label = btn.innerHTML;
    function done() {
      btn.textContent = "Copied ✓";
      setTimeout(function () { btn.innerHTML = label; }, 1500);
    }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
  });

  /* ---------- Tonight planner ---------- */
  var inMarc = document.getElementById("lvl-marc");
  var inNicky = document.getElementById("lvl-nicky");
  var inBoth = document.getElementById("lvl-both");
  var out = document.getElementById("tonight-out");
  var note = document.getElementById("lvl-note");
  var lastKey = "";

  function clampLevel(v) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return null;
    return Math.min(60, Math.max(1, n));
  }
  function bandFor(level) {
    return G.quick.filter(function (q) { return level >= q[0] && level <= q[1]; })[0];
  }
  function checklist(items) {
    return '<ul class="checks">' + items.map(function (text) {
      return '<li><label><input type="checkbox" data-check="c-' + hash(text) + '"><span>' + esc(text) + "</span></label></li>";
    }).join("") + "</ul>";
  }
  function count() { return '<span class="count" aria-label="Ticked"></span>'; }
  function updateCounts() {
    document.querySelectorAll("#tonight-out .plan, #pala-out .plan").forEach(function (card) {
      var boxes = card.querySelectorAll("ul.checks input");
      var c = card.querySelector(".count");
      if (!c || !boxes.length) return;
      var done = Array.prototype.filter.call(boxes, function (b) { return b.checked; }).length;
      c.textContent = done === boxes.length ? "All done ✦" : done + "/" + boxes.length;
      card.classList.toggle("done", done === boxes.length);
    });
  }
  function trainingHtml(list, level) {
    var items = list.filter(function (t) { return t[0] >= level; }).slice(0, 2);
    if (!items.length) return "";
    return '<h3>Next at the trainer</h3><ul class="plain">' + items.map(function (t) {
      return "<li><strong>" + t[0] + ":</strong> " + tagged(esc(t[1])) + "</li>";
    }).join("") + "</ul>";
  }

  /* Gear upgrades from window.LEVELS (Forever quest rewards and dungeon drops only). */
  var SLOT_ORDER = ["2H", "Main hand", "One-hand", "Off hand", "Shield", "Held in off hand", "Relic", "Totem", "Ranged", "Head", "Neck", "Shoulder", "Back", "Chest", "Wrist", "Hands", "Waist", "Legs", "Feet", "Finger", "Trinket"];
  function wh(kind, id) { return "https://www.wowhead.com/forever/" + kind + "=" + id; }
  function itemRow(who, id, level) {
    var it = L.items[id];
    if (!it) return "";
    // [name, quality, slot, kind, req, src]
    var src = it[5] || [];
    var where = src[0] === "q"
      ? 'Quest: <a href="' + wh("quest", src[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(src[2]) + "</a>" + (L.zones[src[3]] ? " · " + esc(L.zones[src[3]]) : "")
      : "Drop: " + esc(src[2] || "boss") + (src[4] ? " (rare spawn)" : "") + " · " + esc(L.zones[src[1]] || "dungeon") + (src[3] ? " · " + src[3] + "%" : "");
    var isNew = it[4] === level;
    return '<li><div><span class="slot' + (isNew ? " new" : "") + '">' + esc(isNew ? "New · " + it[2] : it[2]) + '</span><a class="item q' + it[1] + '" href="' + wh("item", id) + '" target="_blank" rel="noopener noreferrer">' + esc(it[0]) + '</a><span class="meta">' + where + " · " + esc(it[3]) + " · from level " + it[4] + '</span></div><label class="got" title="Got it"><input type="checkbox" data-check="g-' + who + "-" + id + '" aria-label="Got ' + esc(it[0]) + '"></label></li>';
  }
  function gearHtml(who, level) {
    if (!L || !L.gear || !L.gear[who]) return "";
    var now = (L.gear[who][level] || []).slice();
    var seen = {};
    now.forEach(function (id) { seen[id] = 1; });
    var soon = [];
    for (var n = level + 1; n <= Math.min(60, level + 3); n++) {
      (L.gear[who][n] || []).forEach(function (id) {
        var it = L.items[id];
        if (!seen[id] && it && it[4] > level && soon.length < 4) { seen[id] = 1; soon.push(id); }
      });
    }
    var html = "<h3>Loot upgrades now</h3>";
    if (!now.length) html += '<p class="muted">Nothing new to chase at this level. Keep questing; the next upgrades are below.</p>';
    else {
      html += '<ul class="gear">' + now.slice(0, 4).map(function (id) { return itemRow(who, id, level); }).join("") + "</ul>";
      if (now.length > 4) html += '<details class="fold"><summary>Show ' + (now.length - 4) + " more</summary>" + '<ul class="gear">' + now.slice(4).map(function (id) { return itemRow(who, id, level); }).join("") + "</ul></details>";
    }
    if (soon.length) html += '<details class="fold"><summary>Coming up in the next 3 levels (' + soon.length + ")</summary>" + '<ul class="gear">' + soon.map(function (id) { return itemRow(who, id, level); }).join("") + "</ul></details>";
    return html;
  }
  /* Profession steps near this level (data.js: G.prof). */
  function profHtml(who, level) {
    if (!G.prof || !G.prof.who[who]) return "";
    var items = [];
    G.prof.who[who].forEach(function (prof) {
      var all = (G.prof.steps[prof] || []).filter(function (st) { return !st[2] || st[2].indexOf(who) >= 0; });
      // One step per profession: the latest one you've reached (within 2 levels), else the next within 3.
      var now = all.filter(function (st) { return st[0] <= level && st[0] >= level - 2; }).pop();
      var soon = all.filter(function (st) { return st[0] > level && st[0] <= level + 3; })[0];
      var pick = now || soon;
      (pick ? [pick] : []).forEach(function (st) {
        items.push("<li><strong>" + esc(prof) + (st[0] > level ? " · at " + st[0] : "") + ":</strong> " + tagged(esc(st[1])) + "</li>");
      });
    });
    if (!items.length) return "";
    return '<h3>Professions</h3><ul class="plain prof-steps">' + items.join("") + '</ul><p class="muted"><a href="#prof">All profession steps and trainers</a></p>';
  }
  function personCard(cls, name, list, level) {
    var goals = G.plan[bandFor(level)[0]][cls];
    return '<article class="block plan ' + cls + '" id="t-' + cls + '"><h2>' + count() + name + " <small>level " + level + "</small></h2>" + checklist(goals) + gearHtml(cls, level) + profHtml(cls, level) + trainingHtml(list, level) + "</article>";
  }
  function dungeonChip(d) {
    return '<a class="chip" href="#dungeons/' + d[3] + '">' + esc(d[2]) + ' <span class="muted">' + bandLabel(d[0], d[1]) + "</span></a>";
  }
  function niceDate(d) {
    var t = new Date(d + "T12:00");
    return isNaN(t) ? d : t.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  }
  function lastSession() {
    var e = state.log[0];
    if (!e || !(e.next || e.parked)) return "";
    return '<div class="last"><p class="kicker">Last time · ' + esc(niceDate(e.date)) + "</p>" +
      (e.next ? '<p class="next">Next: ' + esc(e.next) + "</p>" : "") +
      (e.parked ? '<p class="muted">Parked: ' + esc(e.parked) + "</p>" : "") + "</div>";
  }
  function bothCard(level) {
    var band = bandFor(level);
    var dungeons = G.dungeons.filter(function (d) { return level >= d[0] && level <= d[1]; });
    var soon = G.dungeons.filter(function (d) { return d[0] > level && d[0] <= level + 3; });
    var camps = G.camps.filter(function (c) { return level >= c[0] && level <= c[1]; });

    var html = '<article class="block plan both" id="t-both">' + lastSession() + '<p class="kicker">Together tonight · level ' + level + "</p><h2>" + count() + esc(band[2]) + "</h2>";
    html += "<p>" + esc(band[3]) + ' <a href="#route/' + band[4] + '">Full route</a></p>';
    html += checklist(G.plan[band[0]].both);
    html += '<div class="cols"><div><h3>Dungeons in range</h3>';
    html += dungeons.length ? '<div class="dungeon-chips">' + dungeons.map(dungeonChip).join("") + "</div>" : '<p class="muted">None in a planned window yet.</p>';
    if (soon.length) html += '<p class="muted">Coming up: ' + soon.map(function (d) { return '<a href="#dungeons/' + d[3] + '">' + esc(d[2]) + "</a> (" + d[0] + ")"; }).join(", ") + ". Collect the quests first.</p>";
    html += "</div><div><h3>Cleave camps</h3>";
    if (camps.length) {
      html += '<ul class="plain">' + camps.map(function (c) { return "<li>" + esc(c[2]) + "</li>"; }).join("") + '</ul><p class="muted">Only when rested and Well Fed. <a href="#ravager/b-play">Pull routine</a></p>';
    } else if (level < 37) {
      html += '<p class="muted">Ravager starts at 37. Until then, use the grind spots below.</p>';
    } else {
      html += '<p class="muted">No listed camp at this level. See <a href="#ravager/b-camps">all camps</a>.</p>';
    }
    html += "</div></div>";
    if (level >= 34 && level <= 39) {
      html += '<p class="callout"><strong>Ravager window.</strong> Library key at 34–36, Herod at 37. Book two evenings. <a href="#ravager/b-item">The plan</a></p>';
    }
    return html + "</article>";
  }

  /* Grind spots: 3 zones whose mobs sit between your level and two above it. */
  var TYPES = { 1: "Beasts", 2: "Dragonkin", 3: "Demons", 4: "Elementals", 5: "Giants", 6: "Undead", 7: "Humanoids", 9: "Mechanical", 10: "Mobs" };
  function grindWindow(marc, nicky) {
    var lo = Math.min(marc, nicky), hi = Math.max(marc, nicky);
    if (hi - lo <= 2) return { from: hi, to: lo + 2, apart: false };
    return { from: lo, to: lo + 2, apart: true };
  }
  var FLAG_TEXT = {
    duo: { skin: "Skinnable beasts for Nicky", cloth: "Cloth for Marc's Tailoring and your bandages", casters: "Has casters", far: "Alliance-leaning zone, a long trip" },
    pala: { skin: "Skinnable beasts", cloth: "Cloth for bandages", casters: "Has casters", far: "Alliance-leaning zone, a long trip" },
  };
  function spotHtml(s, who) {
    // [zoneId, x, y, spawns, [[npcId, name, min, max, type, count]], flags]
    var mobs = s[4];
    var lo = Math.min.apply(null, mobs.map(function (m) { return m[2]; }));
    var hi = Math.max.apply(null, mobs.map(function (m) { return m[3]; }));
    var names = mobs.map(function (m) { return '<a href="' + wh("npc", m[0]) + '" target="_blank" rel="noopener noreferrer">' + esc(m[1]) + "</a>"; });
    var where = s[1] + ", " + s[2];
    return '<li class="spot"><div class="spot-head"><h3>' + esc(L.zones[s[0]] || "Zone") + "</h3>" +
      '<button type="button" class="chip coords" data-copy="' + where + '" aria-label="Copy map coordinates ' + where + '">Map ' + where + "</button></div>" +
      '<p class="mobs">' + names.join(" · ") + "</p>" +
      '<div class="chips"><span class="chip lv">Lv ' + bandLabel(lo, hi) + '</span><span class="chip">≈' + s[3] + " spawns</span></div>" +
      (s[5] && s[5].length ? '<p class="notes">' + s[5].map(function (f) { return esc(FLAG_TEXT[who || "duo"][f] || f); }).join(" · ") + "</p>" : "") + "</li>";
  }
  function grindCard(marc, nicky, who) {
    if (!L || !L.spots) return "";
    var w = grindWindow(marc, nicky);
    var spots = L.spots[w.from + "-" + w.to] || [];
    var html = '<article class="block plan grind" id="' + (who === "pala" ? "p-grind" : "t-grind") + '"><p class="kicker">Just want to kill things?</p><h2>Grind spots · mobs ' + bandLabel(w.from, w.to) + "</h2>";
    if (w.apart) html += '<p class="muted">You\'re more than 2 levels apart, so no mob fits both of you. These suit level ' + w.from + ", the lower of you.</p>";
    html += spots.length ? '<ol class="spots">' + spots.map(function (sp) { return spotHtml(sp, who); }).join("") + "</ol>" : '<p class="muted">No open-world mobs sit exactly in ' + bandLabel(w.from, w.to) + " in the zones checked. Quest instead tonight.</p>";
    html += '<p class="muted">Normal (non-elite) mobs only, from Wowhead\'s Forever database ' + tagged("{F}") + '. Spawns count the busiest patch; tap the map chip to copy coordinates. Pull yellow and orange, never green.</p>';
    return html + "</article>";
  }

  function markHere(level, marc, nicky) {
    document.querySelectorAll("tr.now").forEach(function (tr) { tr.classList.remove("now"); });
    document.querySelectorAll(".here").forEach(function (el) { el.remove(); });
    if (!level) return;
    document.querySelectorAll("#quick-table tr[data-from]").forEach(function (tr) {
      if (level >= +tr.getAttribute("data-from") && level <= +tr.getAttribute("data-to")) tr.classList.add("now");
    });
    [["marc", marc], ["nicky", nicky]].forEach(function (p) {
      if (!p[1]) return;
      var best = null;
      document.querySelectorAll("#" + p[0] + "-table tr[data-level]").forEach(function (tr) {
        if (+tr.getAttribute("data-level") <= p[1]) best = tr;
      });
      if (best) best.classList.add("now");
    });
    var block = document.getElementById(bandFor(level)[4]);
    var h2 = block && block.querySelector("h2");
    if (h2) h2.insertAdjacentHTML("beforeend", '<span class="here">You\'re here</span>');
  }

  function renderTonight() {
    var marc = clampLevel(inMarc.value);
    var nicky = clampLevel(inNicky.value);
    state.levels.marc = marc || "";
    state.levels.nicky = nicky || "";
    save();

    var known = [marc, nicky].filter(Boolean);
    document.body.classList.toggle("has-levels", known.length > 0);
    if (!known.length) {
      inBoth.value = "";
      note.textContent = "Set both levels, or use Both when you're level together. Shared plans follow the lower level.";
      out.innerHTML = '<article class="block plan empty"><h2>Where are you two tonight?</h2><p class="muted">Tap <strong>+</strong> under Both (or set Marc and Nicky separately) and tonight\'s plan, grind spots and loot upgrades appear here.</p></article>';
      markHere(null);
      syncChecks();
      syncJumps();
      lastKey = "";
      return;
    }
    var level = Math.min.apply(null, known);
    if (document.activeElement !== inBoth) inBoth.value = marc && nicky && marc !== nicky ? "" : level;
    var gap = known.length === 2 ? Math.abs(marc - nicky) : 0;
    note.textContent = gap > 1
      ? "You're " + gap + " levels apart, so shared plans use level " + level + ". Larger gaps are penalised on shared kill XP."
      : gap === 1 ? "One level apart, so shared plans use level " + level + "." : "Planning for level " + level + ".";

    var m = marc || level, n = nicky || level;
    out.innerHTML = bothCard(level) + grindCard(m, n) + '<div class="duo">' + personCard("marc", "Marc", G.marc, m) + personCard("nicky", "Nicky", G.nicky, n) + "</div>";
    var key = bandFor(level)[0] + "";
    if (key !== lastKey && !still) out.querySelectorAll(".plan").forEach(function (card) { card.classList.add("enter"); });
    lastKey = key;
    syncChecks();
    markHere(level, marc, nicky);
    syncJumps();
  }
  // Tonight's jump chips point at cards that only exist once levels are set.
  function syncJumps() {
    document.querySelectorAll('#tonight .jump-chips a').forEach(function (a) {
      var id = a.getAttribute("href").split("/")[1];
      a.hidden = !document.getElementById(id);
    });
  }
  inMarc.value = state.levels.marc || "";
  inNicky.value = state.levels.nicky || "";
  inMarc.addEventListener("input", renderTonight);
  inNicky.addEventListener("input", renderTonight);
  inBoth.addEventListener("input", function () {
    var both = clampLevel(inBoth.value);
    if (both) { inMarc.value = both; inNicky.value = both; }
    renderTonight();
  });
  [inMarc, inNicky, inBoth].forEach(function (input) {
    input.addEventListener("change", function () {
      var v = clampLevel(input.value);
      input.value = v || "";
      if (input === inBoth && v) { inMarc.value = v; inNicky.value = v; }
      renderTonight();
    });
  });
  document.querySelector(".picker:not(.pala-picker)").addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-step]");
    if (!btn) return;
    var step = btn.getAttribute("data-step");
    var input = document.getElementById(btn.getAttribute("data-for"));
    var current = clampLevel(input.value);
    input.value = current ? Math.min(60, Math.max(1, current + Number(step))) : (input === inBoth ? Math.min.apply(null, [clampLevel(inMarc.value) || 1, clampLevel(inNicky.value) || 1]) : 1);
    if (input === inBoth) { inMarc.value = input.value; inNicky.value = input.value; }
    renderTonight();
    if (Number(step) > 0 && !still) {
      input.classList.remove("glow");
      void input.offsetWidth;
      input.classList.add("glow");
    }
  });
  renderTonight();

  /* ---------- Solo Paladin planner ---------- */
  var inPala = document.getElementById("lvl-pala");
  var palaOut = document.getElementById("pala-out");
  function palaBand(level) {
    return (G.pala && G.pala.quick || []).filter(function (q) { return level >= q[0] && level <= q[1]; })[0];
  }
  function renderPala() {
    if (!inPala || !G.pala) return;
    var lv = clampLevel(inPala.value);
    state.levels.pala = lv || "";
    save();
    if (!lv) {
      palaOut.innerHTML = '<article class="block plan empty"><h2>What level is the Paladin?</h2><p class="muted">Tap <strong>+</strong> to set his level. His route, grind spots, loot and profession steps appear here.</p></article>';
      return;
    }
    var band = palaBand(lv);
    var html = '<article class="block plan pala" id="p-plan"><p class="kicker">Solo tonight · level ' + lv + "</p><h2>" + count() + esc(band[2]) + "</h2><p>" + tagged(esc(band[3])) + "</p>" +
      checklist(G.pala.plan[band[0]] || []) + "</article>";
    html += grindCard(lv, lv, "pala");
    html += '<article class="block plan pala" id="p-gear"><h2>Loot, professions and trainer <small>level ' + lv + "</small></h2>" + gearHtml("pala", lv) + profHtml("pala", lv) + trainingHtml(G.pala.training || [], lv) + "</article>";
    palaOut.innerHTML = html;
    syncChecks();
  }
  if (inPala) {
    inPala.value = state.levels.pala || "";
    inPala.addEventListener("input", renderPala);
    inPala.addEventListener("change", function () { inPala.value = clampLevel(inPala.value) || ""; renderPala(); });
    document.querySelector(".pala-picker").addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("[data-step]");
      if (!btn) return;
      var cur = clampLevel(inPala.value);
      inPala.value = cur ? Math.min(60, Math.max(1, cur + Number(btn.getAttribute("data-step")))) : 1;
      renderPala();
    });
    renderPala();
  }
  if (!state.levels.marc && !state.levels.nicky && !still) {
    document.querySelectorAll('.lvl.both [data-step="1"]').forEach(function (b) { b.classList.add("pulse"); });
  }

  /* ---------- Profession step tables and the Paladin route (data.js) ---------- */
  var WHO_CHIP = { marc: '<i class="m">Marc</i>', nicky: '<i class="n">Nicky</i>', pala: '<i class="p">Paladin</i>' };
  document.querySelectorAll("[data-steps]").forEach(function (box) {
    var steps = (G.prof && G.prof.steps[box.getAttribute("data-steps")]) || [];
    box.innerHTML = '<div class="scroll"><table class="steps"><thead><tr><th>Level</th><th>What to do</th></tr></thead><tbody>' +
      steps.map(function (st) {
        var who = st[2] ? ' <span class="who">' + st[2].map(function (w) { return WHO_CHIP[w]; }).join("") + "</span>" : "";
        return "<tr><td>" + st[0] + "</td><td>" + tagged(esc(st[1])) + who + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  });
  if (G.pala && document.getElementById("pala-route")) {
    rows("pala-route", G.pala.quick.map(function (q) {
      return '<tr data-from="' + q[0] + '" data-to="' + q[1] + '"><td>' + bandLabel(q[0], q[1]) + "</td><td>" + esc(q[2]) + "</td><td>" + tagged(esc(q[3])) + "</td></tr>";
    }).join(""));
  }

  /* ---------- Profession trainers (levels.js: L.trainers) ---------- */
  function trainerItem(t) {
    // [npcId, name, tag, zoneId, x, y, kind]
    var where = esc(L.tzones[t[3]] || "");
    var map = t[4] != null ? '<button type="button" class="chip coords" data-copy="' + t[4] + ", " + t[5] + '" aria-label="Copy map coordinates ' + t[4] + ", " + t[5] + '">Map ' + t[4] + ", " + t[5] + "</button>" : "";
    return '<li><a href="' + wh("npc", t[0]) + '" target="_blank" rel="noopener noreferrer">' + esc(t[1]) + '</a> <span class="muted">&lt;' + esc(t[2]) + "&gt; · " + where + "</span>" + map + "</li>";
  }
  document.querySelectorAll("[data-trainers]").forEach(function (box) {
    if (!L || !L.trainers) { box.innerHTML = '<p class="muted">Trainer list unavailable.</p>'; return; }
    var rowsT = L.trainers[box.getAttribute("data-trainers")] || [];
    var only = box.getAttribute("data-zones");
    if (only) { var keep = only.split(",").map(Number); rowsT = rowsT.filter(function (t) { return keep.indexOf(t[3]) >= 0; }); }
    var trainers = rowsT.filter(function (t) { return t[6] === "trainer"; });
    var suppliers = rowsT.filter(function (t) { return t[6] !== "trainer"; });
    box.innerHTML = (trainers.length ? '<ul class="trainers">' + trainers.map(trainerItem).join("") + "</ul>" : '<p class="muted">No trainer found in the zones checked.</p>') +
      (suppliers.length ? '<details class="fold"><summary>Suppliers and recipe vendors (' + suppliers.length + ")</summary>" + '<ul class="trainers">' + suppliers.map(trainerItem).join("") + "</ul></details>" : "");
  });

  /* ---------- Camp versus questing test ---------- */
  var xpCamp = document.getElementById("xp-camp");
  var xpQuest = document.getElementById("xp-quest");
  var xpResult = document.getElementById("xp-result");
  function showXp() {
    var camp = parseInt(xpCamp.value, 10), quest = parseInt(xpQuest.value, 10);
    if (isNaN(camp) || isNaN(quest)) { xpResult.textContent = "Enter both numbers to compare."; return; }
    if (camp === quest) { xpResult.textContent = "It's a tie. Pick whichever is more fun."; return; }
    var winner = camp > quest ? "The camp" : "Questing";
    var low = Math.min(camp, quest);
    var extra = low > 0 ? " by " + Math.round((Math.max(camp, quest) - low) / low * 100) + "%" : "";
    xpResult.textContent = winner + " wins" + extra + ". Keep doing that.";
  }
  function syncXp() {
    xpCamp.value = state.xp.camp != null ? state.xp.camp : "";
    xpQuest.value = state.xp.quest != null ? state.xp.quest : "";
    showXp();
  }
  [xpCamp, xpQuest].forEach(function (input) {
    input.addEventListener("input", function () {
      state.xp = { camp: xpCamp.value, quest: xpQuest.value };
      save();
      showXp();
    });
  });
  syncXp();

  /* ---------- Session log ---------- */
  var FIELDS = [
    ["parked", "Parked / hearth"], ["next", "Next exact action"], ["missing", "Missing"],
    ["gearMarc", "Marc gear"], ["gearNicky", "Nicky gear"], ["legacyMarc", "Legacy, Marc"], ["legacyNicky", "Legacy, Nicky"],
    ["status", "Training / tent / bag"], ["route", "Duo test route"], ["time", "Time"], ["repeat", "Repeat?"],
    ["rested", "Rested before / after"], ["procs", "Ravager procs"],
  ];
  var form = document.getElementById("log-form");
  var list = document.getElementById("log-list");
  var logNote = document.getElementById("log-note");
  function prefillLog() {
    form.elements.date.value = new Date().toISOString().slice(0, 10);
    form.elements.marc.value = state.levels.marc || "";
    form.elements.nicky.value = state.levels.nicky || "";
  }
  function renderLog() {
    if (!state.log.length) {
      list.innerHTML = '<p class="block log-empty">No sessions yet. Your newest entry also shows at the top of Tonight.</p>';
      return;
    }
    list.innerHTML = state.log.map(function (entry, i) {
      var rowsHtml = FIELDS.filter(function (f) { return entry[f[0]]; }).map(function (f) {
        return "<dt>" + f[1] + "</dt><dd" + (f[0] === "next" ? ' class="next-line"' : "") + ">" + esc(entry[f[0]]) + "</dd>";
      }).join("");
      return '<article class="block entry"><h3>' + esc(niceDate(entry.date)) + ' <small>Marc ' + esc(entry.marc || "?") + " · Nicky " + esc(entry.nicky || "?") + '</small><button type="button" class="link" data-del="' + i + '">Delete</button></h3><dl>' + rowsHtml + "</dl></article>";
    }).join("");
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var entry = {};
    new FormData(form).forEach(function (v, k) { entry[k] = String(v).trim(); });
    state.log.unshift(entry);
    if (entry.marc) inMarc.value = entry.marc;
    if (entry.nicky) inNicky.value = entry.nicky;
    form.reset();
    renderTonight();
    prefillLog();
    renderLog();
    save();
    logNote.textContent = "Saved ✦";
    setTimeout(function () { logNote.textContent = ""; }, 2500);
    var first = list.querySelector(".entry");
    if (first) { first.classList.add("flash"); scrollToEl(first); }
  });
  list.addEventListener("click", function (e) {
    var i = e.target.getAttribute("data-del");
    if (i === null) return;
    if (!confirm("Delete this log entry?")) return;
    state.log.splice(Number(i), 1);
    save();
    renderLog();
    renderTonight();
  });
  prefillLog();
  renderLog();

  /* ---------- Backup and restore ---------- */
  var backupNote = document.getElementById("backup-note");
  document.getElementById("backup").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ittakestwo-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    backupNote.textContent = "Backup saved.";
  });
  document.getElementById("restore").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    file.text().then(function (text) {
      var data = JSON.parse(text.replace(/nikki/g, "nicky").replace(/Nikki/g, "Nicky"));
      if (!data || typeof data.checks !== "object" || !Array.isArray(data.log)) throw new Error("bad file");
      state = { levels: data.levels || { marc: "", nicky: "", pala: "" }, checks: data.checks, log: data.log, xp: data.xp || {} };
      if (inPala) { inPala.value = state.levels.pala || ""; renderPala(); }
      save();
      inMarc.value = state.levels.marc || "";
      inNicky.value = state.levels.nicky || "";
      syncXp();
      renderTonight();
      prefillLog();
      renderLog();
      backupNote.textContent = "Restored.";
    }).catch(function () {
      backupNote.textContent = "That file isn't an ItTakesTwo backup.";
    });
    e.target.value = "";
  });

  stackTables();

  /* ---------- "On this page" chips for long tabs ---------- */
  var TONIGHT_JUMPS = [["t-both", "Plan"], ["t-grind", "Grind spots"], ["t-marc", "Marc"], ["t-nicky", "Nicky"], ["b-eight", "Top 8"], ["b-tests", "Day-one tests"], ["b-session", "Session tips"]];
  main.querySelectorAll("section.view").forEach(function (view) {
    if (view.id === "results") return;
    var items;
    if (view.id === "tonight") {
      items = TONIGHT_JUMPS.filter(function (it) { return it[0] !== "t-grind" || (L && L.spots); });
    } else {
      items = Array.from(view.querySelectorAll(".block[id]")).map(function (b) {
        var h = b.querySelector("h2, summary");
        return [b.id, h ? h.textContent.replace(/You're here/, "").replace(/\s+/g, " ").trim() : b.id];
      });
    }
    if (items.length < 3) return;
    var hero = view.querySelector(".hero");
    if (!hero) return;
    var open = view.id === "tonight" || items.length <= 6;
    hero.insertAdjacentHTML("afterend", '<details class="jump"' + (open ? " open" : "") + '><summary>On this page (' + items.length + ')</summary><nav class="jump-chips" aria-label="On this page">' +
      items.map(function (it) { return '<a href="#' + view.id + "/" + it[0] + '">' + esc(it[1].length > 34 ? it[1].slice(0, 32) + "…" : it[1]) + "</a>"; }).join("") + "</nav></details>");
  });
  // On Tonight the chips sit above the picker; keep them under the level picker instead.
  var tonightJump = document.querySelector("#tonight .jump");
  if (tonightJump) document.getElementById("tonight-out").before(tonightJump);
  syncJumps();

  /* ---------- Routing ---------- */
  var views = main.querySelectorAll("section.view");
  var navLinks = document.querySelectorAll("header nav a");
  var navBar = document.querySelector("header nav");
  var results = document.getElementById("results");
  var search = document.getElementById("search");

  function centerTab() {
    var cur = navBar.querySelector("a[aria-current]");
    if (!cur) return;
    // offsetLeft is measured from the header, so subtract the nav's own offset.
    var left = cur.offsetLeft - navBar.offsetLeft - (navBar.clientWidth - cur.offsetWidth) / 2;
    navBar.scrollLeft = Math.max(0, left);
  }
  function show(viewId, anchor) {
    var target = document.getElementById(viewId);
    if (!target || !target.classList.contains("view") || viewId === "results") { viewId = "tonight"; target = document.getElementById(viewId); }
    views.forEach(function (v) { v.hidden = v !== target; });
    navLinks.forEach(function (a) {
      if (a.getAttribute("href") === "#" + viewId) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    centerTab();
    var el = anchor && document.getElementById(anchor);
    if (el) {
      if (el.tagName === "DETAILS") el.open = true;
      scrollToEl(el);
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    } else {
      window.scrollTo(0, 0);
    }
  }
  function route() {
    var parts = location.hash.replace(/^#/, "").split("/");
    if (search.value) search.value = "";
    show(parts[0] || "tonight", parts[1]);
  }
  window.addEventListener("hashchange", route);
  // A link to the page you're already on would do nothing; make it re-run the route (and close search).
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute("href") !== location.hash) return;
    e.preventDefault();
    route();
  });

  /* ---------- Search ---------- */
  var blocks = Array.from(main.querySelectorAll(".block[id]")).filter(function (b) {
    return !b.closest("#tonight-out, #pala-out");  // live planner cards change with levels; search the guide itself
  }).map(function (b) {
    var view = b.closest("section.view");
    var c = b.cloneNode(true);
    c.querySelectorAll(".here").forEach(function (el) { el.remove(); });
    c.querySelectorAll("td, th, li, p, h2, h3, dt, dd, summary, div, label").forEach(function (el) { el.append(" "); });
    var title = b.querySelector("h2, summary");
    var tab = view && document.querySelector('header nav a[href="#' + view.id + '"]');
    return { el: b, view: view, text: c.textContent.replace(/\s+/g, " ").trim(), title: title ? title.textContent.replace(/You're here/, "").replace(/\s+/g, " ").trim() : b.id, tab: tab ? tab.textContent : "" };
  });
  var firstHit = null;
  function runSearch() {
    var q = search.value.trim().toLowerCase();
    if (q.length < 2) { route(); return; }
    var words = q.split(/\s+/).filter(Boolean);
    var hits = [];
    firstHit = null;
    blocks.forEach(function (b) {
      if (!b.view || b.view.id === "results") return;
      var low = b.text.toLowerCase();
      if (!words.every(function (w) { return low.indexOf(w) >= 0; })) return;
      var at = low.indexOf(words[0]);
      var start = Math.max(0, at - 70);
      var snippet = b.text.slice(start, at + words[0].length + 110);
      var mark = esc(snippet);
      words.forEach(function (w) { mark = mark.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "<mark>$&</mark>"); });
      var href = "#" + b.view.id + "/" + b.el.id;
      if (!firstHit) firstHit = href;
      hits.push('<li><span class="kicker">' + esc(b.tab) + '</span><a href="' + href + '">' + esc(b.title) + "</a><p>…" + mark + "…</p></li>");
    });
    var wasHidden = results.hidden;
    views.forEach(function (v) { v.hidden = true; });
    navLinks.forEach(function (a) { a.removeAttribute("aria-current"); });
    results.hidden = false;
    results.innerHTML = "<h1>" + hits.length + (hits.length === 1 ? " match" : " matches") + " for “" + esc(search.value.trim()) + "”</h1>" +
      (hits.length ? '<p class="muted">Press Enter to open the first one.</p><ul class="hits">' + hits.join("") + "</ul>" : '<p class="muted">Try fewer or shorter words.</p>');
    if (wasHidden) window.scrollTo(0, 0);
  }
  search.addEventListener("input", runSearch);
  search.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && firstHit) { e.preventDefault(); search.blur(); location.hash = firstHit; }
    if (e.key === "Escape") { search.value = ""; search.blur(); route(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); search.focus(); }
  });

  route();

  /* ---------- Back to top ---------- */
  var toTop = document.createElement("button");
  toTop.type = "button";
  toTop.className = "to-top";
  toTop.setAttribute("aria-label", "Back to top");
  toTop.textContent = "↑";
  toTop.hidden = true;
  document.body.appendChild(toTop);
  toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" }); });
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      toTop.hidden = window.scrollY < window.innerHeight * 1.5;
      ticking = false;
    });
  }, { passive: true });

  /* ---------- Starfield ---------- */
  var canvas = document.getElementById("stars");
  var ctx = canvas.getContext && canvas.getContext("2d");
  if (ctx) {
    var stars = [];
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var COLORS = ["255,255,255", "190,225,255", "255,215,240", "255,235,190"];
    var layer = document.createElement("canvas");
    var lctx = layer.getContext("2d");
    var drawn = 0, sizedW = 0, sizedH = 0;
    function dot(c, s, alpha) {
      c.fillStyle = "rgba(" + s.c + "," + alpha.toFixed(3) + ")";
      c.beginPath();
      c.arc(s.fx * canvas.width, s.fy * canvas.height, s.r, 0, 6.2832);
      c.fill();
    }
    // Only rebuild when the width changes or the height changes a lot, so a phone's
    // address bar sliding in and out doesn't reshuffle the sky while scrolling.
    function sizeStars() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (w === sizedW && Math.abs(h - sizedH) < 160) return false;
      sizedW = w; sizedH = h;
      canvas.width = layer.width = Math.round(w * dpr);
      canvas.height = layer.height = Math.round(h * dpr);
      var total = Math.min(240, Math.round(w * h / 7000));
      stars = [];
      for (var i = 0; i < total; i++) {
        stars.push({
          fx: Math.random(), fy: Math.random(),
          r: (Math.random() < 0.08 ? 1.5 : 0.4 + Math.random() * 0.7) * dpr,
          a: 0.25 + Math.random() * 0.7, p: Math.random() * 6.28, s: 0.3 + Math.random() * 1.1,
          c: COLORS[Math.floor(Math.random() * COLORS.length)], tw: Math.random() < 0.25,
        });
      }
      lctx.clearRect(0, 0, layer.width, layer.height);
      stars.forEach(function (s) { if (!s.tw || still) dot(lctx, s, s.a); });
      return true;
    }
    function drawStars(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(layer, 0, 0);
      if (still) return;
      stars.forEach(function (s) { if (s.tw) dot(ctx, s, s.a * (0.55 + 0.45 * Math.sin(now / 1000 * s.s + s.p))); });
    }
    function tick(now) {
      if (!document.hidden && now - drawn > 80) { drawStars(now); drawn = now; }
      requestAnimationFrame(tick);
    }
    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (sizeStars()) drawStars(performance.now()); }, 150);
    });
    sizeStars();
    drawStars(0);
    if (!still) requestAnimationFrame(tick);
  }
})();
