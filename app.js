(function () {
  "use strict";

  var STORE_KEY = "ittakestwo.v1";
  var G = window.GUIDE;
  var S = window.SOURCES;

  /* ---------- Saved state: wrapped so the site still works if storage is blocked ---------- */
  var state = { levels: { marc: "", nikki: "" }, checks: {}, log: [] };
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY));
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

  // Turns [12,26] and [12-14] in a guide section into links to that section's numbered source list.
  function linkCitations(root) {
    root.querySelectorAll("[data-src]").forEach(function (el) {
      var list = el.getAttribute("data-src") === "r" ? "revision" : "original";
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
    return '<tr><td><a href="#route/' + q[4] + '">' + bandLabel(q[0], q[1]) + "</a></td><td>" + esc(q[2]) + "</td><td>" + esc(q[3]) + "</td></tr>";
  }).join(""));
  rows("camps-table", G.camps.map(function (c) {
    return "<tr><td>" + bandLabel(c[0], c[1]) + "</td><td>" + esc(c[2]) + "</td><td>" + esc(c[3]) + "</td><td>" + esc(c[4]) + "</td></tr>";
  }).join(""));
  ["marc", "nikki"].forEach(function (who) {
    rows(who + "-table", G[who].map(function (t) {
      return '<tr data-level="' + t[0] + '"><td>' + t[0] + "</td><td>" + esc(t[1]) + "</td></tr>";
    }).join(""));
  });
  rows("ledger", G.crafts.map(function (craft) {
    var cells = ["marc-150", "marc-225", "nikki-150", "nikki-225"].map(function (k) {
      var id = "ledger-" + craft + "-" + k;
      return '<td><input type="checkbox" data-check="' + id + '" aria-label="' + craft + " " + k.replace("-", " ") + '"></td>';
    }).join("");
    return "<tr><td>" + craft + "</td>" + cells + "</tr>";
  }).join(""));

  /* ---------- Sources ---------- */
  ["revision", "original"].forEach(function (list) {
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
  }
  main.addEventListener("change", function (e) {
    var id = e.target.getAttribute && e.target.getAttribute("data-check");
    if (!id) return;
    if (e.target.checked) state.checks[id] = 1; else delete state.checks[id];
    save();
  });
  syncChecks();

  // Lets wide tables stack into labelled rows on phones (see styles.css).
  main.querySelectorAll("table").forEach(function (table) {
    var heads = table.querySelectorAll("thead th");
    if (heads.length < 3 || table.id === "ledger") return;
    table.classList.add("stack");
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      Array.from(tr.children).forEach(function (td, i) {
        if (i > 0 && heads[i]) td.setAttribute("data-label", heads[i].textContent);
      });
    });
  });

  main.addEventListener("click", function (e) {
    if (!e.target.classList.contains("copy")) return;
    var text = e.target.parentElement.textContent.replace(/Copy(ied)?$/, "").trim().replace(/^"|"$/g, "");
    var btn = e.target;
    function done() { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1500); }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
  });

  /* ---------- Tonight planner ---------- */
  var inMarc = document.getElementById("lvl-marc");
  var inNikki = document.getElementById("lvl-nikki");
  var out = document.getElementById("tonight-out");
  var note = document.getElementById("lvl-note");

  function clampLevel(v) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return null;
    return Math.min(60, Math.max(1, n));
  }
  function nextTraining(list, level) {
    return list.filter(function (t) { return t[0] >= level; }).slice(0, 2);
  }
  function trainingHtml(name, list, level) {
    var items = nextTraining(list, level);
    if (!items.length) return "";
    return "<div><h3>" + name + " at the trainer</h3><ul class=\"plain\">" + items.map(function (t) {
      return "<li><strong>" + t[0] + ":</strong> " + tagged(esc(t[1])) + "</li>";
    }).join("") + "</ul></div>";
  }
  function renderTonight() {
    var marc = clampLevel(inMarc.value);
    var nikki = clampLevel(inNikki.value);
    state.levels = { marc: marc || "", nikki: nikki || "" };
    save();

    var known = [marc, nikki].filter(Boolean);
    if (!known.length) {
      note.textContent = "Content is chosen by the lower level.";
      out.innerHTML = "";
      return;
    }
    var level = Math.min.apply(null, known);
    var gap = known.length === 2 ? Math.abs(marc - nikki) : 0;
    note.textContent = "Planning for level " + level + (gap > 1 ? ". You're " + gap + " levels apart, and larger gaps are penalised on shared kill XP." : ".");

    var band = G.quick.filter(function (q) { return level >= q[0] && level <= q[1]; })[0];
    var dungeons = G.dungeons.filter(function (d) { return level >= d[0] && level <= d[1]; });
    var soon = G.dungeons.filter(function (d) { return d[0] > level && d[0] <= level + 3; });
    var camps = G.camps.filter(function (c) { return level >= c[0] && level <= c[1]; });

    var html = '<article class="block tonight"><h2>Level ' + level + ': ' + esc(band[2]) + "</h2>";
    html += "<p>" + esc(band[3]) + ' <a href="#route/' + band[4] + '">Full route for this bracket</a></p>';
    html += '<div class="cols">' + trainingHtml("Marc", G.marc, marc || level) + trainingHtml("Nikki", G.nikki, nikki || level) + "</div>";

    html += '<div class="cols"><div><h3>Dungeons in range</h3>';
    html += dungeons.length ? '<ul class="plain">' + dungeons.map(dungeonLink).join("") + "</ul>" : '<p class="muted">None in a planned window yet.</p>';
    if (soon.length) html += '<p class="muted">Coming up: ' + soon.map(function (d) { return '<a href="#dungeons/' + d[3] + '">' + esc(d[2]) + "</a> (" + d[0] + ")"; }).join(", ") + ". Collect the quests before you get there.</p>";
    html += "</div>";

    html += "<div><h3>Cleave camps</h3>";
    if (camps.length) {
      html += '<ul class="plain">' + camps.map(function (c) { return "<li>" + esc(c[2]) + "</li>"; }).join("") + '</ul><p class="muted">Only when rested and Well Fed. <a href="#ravager/b-play">Pull routine</a></p>';
    } else if (level < 37) {
      html += '<p class="muted">Ravager starts at 37. Until then, see <a href="#gear/g-farms">duo farms</a>.</p>';
    } else {
      html += '<p class="muted">No listed camp at this level. See <a href="#ravager/b-camps">all camps</a>.</p>';
    }
    html += "</div></div>";

    if (level >= 34 && level <= 39) {
      html += '<p class="callout"><strong>Ravager window.</strong> Library key at 34–36, Herod at 37. Book two evenings. <a href="#ravager/b-item">The plan</a></p>';
    }
    html += "</article>";
    out.innerHTML = html;
  }
  function dungeonLink(d) {
    return '<li><a href="#dungeons/' + d[3] + '">' + esc(d[2]) + '</a> <span class="muted">' + bandLabel(d[0], d[1]) + "</span></li>";
  }
  inMarc.value = state.levels.marc || "";
  inNikki.value = state.levels.nikki || "";
  inMarc.addEventListener("input", renderTonight);
  inNikki.addEventListener("input", renderTonight);
  renderTonight();

  /* ---------- Session log ---------- */
  var FIELDS = [
    ["parked", "Parked / hearth"], ["next", "Next exact action"], ["missing", "Missing"],
    ["gearMarc", "Marc gear"], ["gearNikki", "Nikki gear"], ["legacyMarc", "Legacy, Marc"], ["legacyNikki", "Legacy, Nikki"],
    ["status", "Training / tent / bag"], ["route", "Duo test route"], ["time", "Time"], ["repeat", "Repeat?"],
    ["rested", "Rested before / after"], ["procs", "Ravager procs"],
  ];
  var form = document.getElementById("log-form");
  var list = document.getElementById("log-list");
  function prefillLog() {
    form.elements.date.value = new Date().toISOString().slice(0, 10);
    form.elements.marc.value = state.levels.marc || "";
    form.elements.nikki.value = state.levels.nikki || "";
  }
  function renderLog() {
    list.innerHTML = state.log.map(function (entry, i) {
      var rowsHtml = FIELDS.filter(function (f) { return entry[f[0]]; }).map(function (f) {
        return "<dt>" + f[1] + "</dt><dd>" + esc(entry[f[0]]) + "</dd>";
      }).join("");
      return '<article class="block entry"><h3>' + esc(entry.date) + ' <small>Marc ' + esc(entry.marc || "?") + " · Nikki " + esc(entry.nikki || "?") + '</small><button type="button" class="link" data-del="' + i + '">Delete</button></h3><dl>' + rowsHtml + "</dl></article>";
    }).join("");
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var entry = {};
    new FormData(form).forEach(function (v, k) { entry[k] = String(v).trim(); });
    state.log.unshift(entry);
    if (entry.marc) inMarc.value = entry.marc;
    if (entry.nikki) inNikki.value = entry.nikki;
    form.reset();
    renderTonight();
    prefillLog();
    renderLog();
    save();
  });
  list.addEventListener("click", function (e) {
    var i = e.target.getAttribute("data-del");
    if (i === null) return;
    if (!confirm("Delete this log entry?")) return;
    state.log.splice(Number(i), 1);
    save();
    renderLog();
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
      var data = JSON.parse(text);
      if (!data || typeof data.checks !== "object" || !Array.isArray(data.log)) throw new Error("bad file");
      state = { levels: data.levels || { marc: "", nikki: "" }, checks: data.checks, log: data.log };
      save();
      inMarc.value = state.levels.marc || "";
      inNikki.value = state.levels.nikki || "";
      syncChecks();
      renderTonight();
      prefillLog();
      renderLog();
      backupNote.textContent = "Restored.";
    }).catch(function () {
      backupNote.textContent = "That file isn't an ItTakesTwo backup.";
    });
    e.target.value = "";
  });

  /* ---------- Routing ---------- */
  var views = main.querySelectorAll("section.view");
  var navLinks = document.querySelectorAll("header nav a");
  var results = document.getElementById("results");
  var search = document.getElementById("search");

  function show(viewId, anchor) {
    var target = document.getElementById(viewId);
    if (!target || !target.classList.contains("view") || viewId === "results") { viewId = "tonight"; target = document.getElementById(viewId); }
    views.forEach(function (v) { v.hidden = v !== target; });
    navLinks.forEach(function (a) {
      if (a.getAttribute("href") === "#" + viewId) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var el = anchor && document.getElementById(anchor);
    if (el) {
      if (el.tagName === "DETAILS") el.open = true;
      el.scrollIntoView();
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

  /* ---------- Search ---------- */
  var blocks = Array.from(main.querySelectorAll(".block[id]"));
  search.addEventListener("input", function () {
    var q = search.value.trim().toLowerCase();
    if (q.length < 2) { route(); return; }
    var hits = [];
    blocks.forEach(function (b) {
      var view = b.closest("section.view");
      if (!view || view.id === "results") return;
      var text = b.textContent.replace(/\s+/g, " ");
      var at = text.toLowerCase().indexOf(q);
      if (at < 0) return;
      var start = Math.max(0, at - 70);
      var snippet = text.slice(start, at + q.length + 90);
      var mark = esc(snippet).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "<mark>$&</mark>");
      var title = b.querySelector("h2, summary");
      hits.push('<li><a href="#' + view.id + "/" + b.id + '">' + esc(title ? title.textContent : view.id) + "</a><p>…" + mark + "…</p></li>");
    });
    views.forEach(function (v) { v.hidden = true; });
    results.hidden = false;
    results.innerHTML = "<h1>" + hits.length + (hits.length === 1 ? " match" : " matches") + " for “" + esc(search.value.trim()) + '”</h1><ul class="hits">' + hits.join("") + "</ul>";
  });

  route();
})();
