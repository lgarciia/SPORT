/* App-like : Home (liste), Détail, Runner (sets + timer + progression locale) */

const $ = (sel, root=document) => root.querySelector(sel);

const App = {
  data: null,
  timer: { id:null, until:0 },

  mount(){
    try {
      this.data = JSON.parse(document.getElementById("sessions-data").textContent.trim());
    } catch(e){
      console.error("JSON invalide", e);
      this.data = { sessions: [] };
    }

    window.addEventListener("hashchange", () => this.route());
    this.route();

    // Runner events
    $("#runner-close").addEventListener("click", ()=> this.closeRunner());
    $("#timer-stop").addEventListener("click", ()=> this.stopTimer());
    $("#runner .timer-buttons").addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-secs]");
      if(!btn) return;
      const secs = parseInt(btn.getAttribute("data-secs"),10);
      this.startTimer(secs);
    });
    $("#runner-prev").addEventListener("click", ()=> this.runnerPrev());
    $("#runner-next").addEventListener("click", ()=> this.runnerNext());
  },

  route(){
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if(parts[0] === "session" && parts[1]){
      const s = this.data.sessions.find(x => x.session_id === parts[1]);
      if(!s) return this.renderNotFound(parts[1]);
      this.renderSession(s);
    } else {
      this.renderHome();
    }
  },

  /* =============== HOME =============== */
  renderHome(){
    const root = $("#app"); root.innerHTML = "";

    const surface = document.createElement("div");
    surface.className = "surface";

    const list = document.createElement("div");
    list.className = "list-rows";

    const order = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
    const sessions = [...this.data.sessions].sort((a,b)=> order.indexOf(a.day) - order.indexOf(b.day));

    sessions.forEach(s => {
      const a = document.createElement("a");
      a.className = "row-link";
      a.href = `#/session/${s.session_id}`;
      a.innerHTML = `
        <span class="material-symbols-rounded row-icn" aria-hidden="true">${s.icon || "fitness_center"}</span>
        <span class="row-day">${escapeHTML(s.day)}</span>
        <span class="row-title">${escapeHTML(s.name)}</span>
        <span class="row-meta">
          <span class="material-symbols-rounded">chevron_right</span>
        </span>
      `;
      list.appendChild(a);
    });

    surface.appendChild(list);
    root.appendChild(surface);
  },

  /* =============== DETAIL =============== */
  renderSession(s){
    const root = $("#app"); root.innerHTML = "";
    const surface = document.createElement("div"); surface.className = "surface";
    const container = document.createElement("div"); container.className = "container";

    const top = document.createElement("div");
    top.className = "header-row";
    top.innerHTML = `
      <button class="btn" onclick="history.back()"><span class="material-symbols-rounded">arrow_back</span>Retour</button>
      <div class="meta">${escapeHTML(s.day)}</div>
    `;
    container.appendChild(top);

    const title = document.createElement("h2");
    title.className = "m0";
    title.textContent = s.name;
    container.appendChild(title);

    if(s.notes){
      const notes = document.createElement("div");
      notes.className = "mt8 meta";
      notes.textContent = s.notes;
      container.appendChild(notes);
    }

    // Échauffement
    if(s.warmup){
      const sec = section("Échauffement");
      const list = document.createElement("div"); list.className = "list";
      (s.warmup.steps || []).forEach(step => list.appendChild(itemRow("local_fire_department", step)));
      sec.appendChild(list);
      container.appendChild(sec);
    }

    // EXOS / SUPERSETS
    if(Array.isArray(s.exercises)){
      container.appendChild(this.renderExercises(s.exercises, s));
    }
    if(Array.isArray(s.supersets)){
      container.appendChild(this.renderSupersets(s.supersets, s));
    }

    // FINISHER
    if(s.finisher){
      const sec = section("Finisher");
      const list = document.createElement("div"); list.className = "list";
      if(Array.isArray(s.finisher.exercises)){
        s.finisher.exercises.forEach(fx=>{
          const row = itemRow("flag", `<strong>${escapeHTML(fx.name)}</strong> — ${escapeHTML(fx.protocol || "")}`);
          const meta = metaRow({ rest_s: fx.rest_s, special: fx.cues });
          if(meta) row.appendChild(meta);
          list.appendChild(row);
        });
      } else {
        const row = itemRow("flag", `<strong>${escapeHTML(s.finisher.name)}</strong> — ${escapeHTML(s.finisher.protocol || "")}`);
        list.appendChild(row);
      }
      sec.appendChild(list);
      container.appendChild(sec);
    }

    // CONSEILS
    if(Array.isArray(s.tips) && s.tips.length){
      const sec = section("Conseils séance");
      const ul = document.createElement("ul"); ul.className = "clean";
      s.tips.forEach(t => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
      sec.appendChild(ul);
      container.appendChild(sec);
    }

    surface.appendChild(container);
    root.appendChild(surface);

    // FAB -> Runner
    const fab = document.createElement("button");
    fab.className = "fab";
    fab.innerHTML = `<span class="material-symbols-rounded">play_circle</span>Démarrer`;
    fab.addEventListener("click", () => this.openRunner(s));
    root.appendChild(fab);
  },

  renderExercises(exs, session){
    const sec = section("Exercices");
    const list = document.createElement("div"); list.className = "list";
    exs.forEach(ex=>{
      const row = itemRow(ex.icon || "fitness_center", `<strong>${escapeHTML(ex.name)}</strong>`);
      const meta = metaRow(ex);
      if(meta) row.appendChild(meta);
      if(ex.cues){ const m = document.createElement("div"); m.className = "meta mt8"; m.textContent = ex.cues; row.appendChild(m); }
      // mini-progress (séries faites)
      const done = this.getProgress(session.session_id, ex.id);
      if(Number.isFinite(ex.sets)){
        const pr = document.createElement("div");
        pr.className = "meta mt8";
        pr.textContent = `Progression : ${done}/${ex.sets} séries`;
        row.appendChild(pr);
      }
      list.appendChild(row);
    });
    sec.appendChild(list);
    return sec;
  },

  renderSupersets(blocks, session){
    const frag = document.createDocumentFragment();
    blocks.forEach((ss, i)=>{
      const sec = section(`Superset ${i+1}${ss.name ? " — " + ss.name : ""}`);
      if(Number.isFinite(ss.rest_s)){
        const r = document.createElement("div"); r.className = "meta mt8";
        r.textContent = `Repos entre supersets : ${ss.rest_s}s`;
        sec.appendChild(r);
      }
      const list = document.createElement("div"); list.className = "list";
      (ss.exercises || []).forEach(ex=>{
        const row = itemRow(ex.icon || "fitness_center", `<strong>${escapeHTML(ex.name)}</strong>`);
        const meta = metaRow(ex);
        if(meta) row.appendChild(meta);
        if(ex.cues){ const m = document.createElement("div"); m.className = "meta mt8"; m.textContent = ex.cues; row.appendChild(m); }
        const done = this.getProgress(session.session_id, ex.id);
        if(Number.isFinite(ex.sets)){
          const pr = document.createElement("div");
          pr.className = "meta mt8";
          pr.textContent = `Progression : ${done}/${ex.sets} séries`;
          row.appendChild(pr);
        }
        list.appendChild(row);
      });
      sec.appendChild(list);
      frag.appendChild(sec);
    });
    return frag;
  },

  /* =============== RUNNER =============== */
  openRunner(session){
    this.runner = {
      session,
      exList: this.flattenExercises(session),
      idx: 0
    };
    this.renderRunner();
    this.showSheet();
  },
  closeRunner(){
    this.hideSheet();
    this.stopTimer();
  },
  runnerPrev(){
    if(!this.runner) return;
    if(this.runner.idx > 0){ this.runner.idx--; this.renderRunner(); this.stopTimer(); }
  },
  runnerNext(){
    if(!this.runner) return;
    if(this.runner.idx < this.runner.exList.length-1){ this.runner.idx++; this.renderRunner(); this.stopTimer(); }
  },
  flattenExercises(s){
    const list = [];
    if(Array.isArray(s.exercises)) s.exercises.forEach(ex => list.push(ex));
    if(Array.isArray(s.supersets)) s.supersets.forEach(ss => (ss.exercises||[]).forEach(ex => list.push(ex)));
    return list;
  },
  renderRunner(){
    const sname = $("#runner-session-name");
    const exname = $("#runner-ex-name");
    const setsWrap = $("#runner-sets");

    const ex = this.runner.exList[this.runner.idx];
    sname.textContent = this.runner.session.name;
    exname.textContent = ex.name;

    // sets chips
    setsWrap.innerHTML = "";
    const totalSets = Number.isFinite(ex.sets) ? ex.sets : this.parseSetsCount(ex.sets, ex.reps);
    const done = this.getProgress(this.runner.session.session_id, ex.id);
    for(let i=1;i<=totalSets;i++){
      const chip = document.createElement("button");
      chip.className = "set-chip" + (i<=done ? " done" : "");
      chip.innerHTML = `<span class="set-index">${i}</span> <span class="material-symbols-rounded">${i<=done ? "check_circle" : "radio_button_unchecked"}</span>`;
      chip.addEventListener("click", ()=>{
        const current = this.getProgress(this.runner.session.session_id, ex.id);
        if(i<=current){ this.setProgress(this.runner.session.session_id, ex.id, i-1); }
        else { this.setProgress(this.runner.session.session_id, ex.id, i); }
        this.renderRunner();
      });
      setsWrap.appendChild(chip);
    }

    // timer quick presets
    const defaultRest = Number.isFinite(ex.rest_s) ? ex.rest_s : 60;
    $("#runner .timer-buttons .chip[data-secs='60']").classList.remove("outline");
    $("#runner .timer-buttons .chip[data-secs='90']").classList.remove("outline");
    $("#runner .timer-buttons .chip[data-secs='120']").classList.remove("outline");
    const btn = $(`#runner .timer-buttons .chip[data-secs='${defaultRest}']`);
    if(btn) btn.classList.add("outline");
  },
  parseSetsCount(sets, reps){
    // Si sets est "4" -> 4 ; sinon fallback: 3
    const n = parseInt(sets, 10);
    if(Number.isFinite(n)) return n;
    return 3;
  },

  /* Timer */
  startTimer(secs){
    this.stopTimer();
    const display = $("#timer-display");
    const end = Date.now() + secs*1000;
    this.timer.until = end;
    this.timer.id = setInterval(()=>{
      const left = Math.max(0, Math.floor((this.timer.until - Date.now())/1000));
      display.textContent = toMMSS(left);
      if(left<=0) this.stopTimer();
    }, 200);
  },
  stopTimer(){
    if(this.timer.id){ clearInterval(this.timer.id); this.timer.id = null; }
    $("#timer-display").textContent = "00:00";
  },

  showSheet(){
    const sh = $("#runner");
    sh.classList.remove("hidden");
    // next frame to trigger transition
    requestAnimationFrame(()=> sh.classList.add("show"));
    sh.setAttribute("aria-hidden","false");
  },
  hideSheet(){
    const sh = $("#runner");
    sh.classList.remove("show");
    sh.setAttribute("aria-hidden","true");
    setTimeout(()=> sh.classList.add("hidden"), 250);
  },

  /* Progress storage */
  k(sessionId, exId){ return `prog:${sessionId}:${exId}`; },
  getProgress(sessionId, exId){
    const v = localStorage.getItem(this.k(sessionId, exId));
    return v ? parseInt(v,10) : 0;
    },
  setProgress(sessionId, exId, n){
    localStorage.setItem(this.k(sessionId, exId), String(n));
  },

  /* Errors */
  renderNotFound(id){
    const root = $("#app"); root.innerHTML = `
      <div class="surface"><div class="container">
        <div class="header-row">
          <button class="btn" onclick="location.hash=''"><span class="material-symbols-rounded">arrow_back</span>Accueil</button>
        </div>
        <h2 class="m0">Séance introuvable</h2>
        <div class="mt8 meta">ID: ${escapeHTML(id)}</div>
      </div></div>
    `;
  }
};

/* Helpers UI */
function section(title){
  const sec = document.createElement("section");
  sec.className = "section";
  sec.innerHTML = `<h3>${escapeHTML(title)}</h3>`;
  return sec;
}
function itemRow(iconName, html){
  const row = document.createElement("div");
  row.className = "item";
  row.innerHTML = `
    <div class="lead"><span class="material-symbols-rounded" aria-hidden="true">${iconName}</span></div>
    <div class="flex1">${html}</div>
  `;
  return row;
}
function metaRow(ex){
  const chips = [];
  if(ex.sets !== undefined) chips.push(chip("stack", `${ex.sets} séries`));
  if(ex.reps !== undefined) chips.push(chip("repeat", `${ex.reps} reps`));
  if(ex.tempo) chips.push(chip("speed", `Tempo ${ex.tempo}`));
  if(Number.isFinite(ex.rest_s)) chips.push(chip("timer", `${ex.rest_s}s repos`));
  if(ex.special) chips.push(chip("auto_awesome", ex.special));
  if(!chips.length) return null;
  const row = document.createElement("div"); row.className = "row mt8";
  chips.forEach(c => row.appendChild(c));
  return row;
}
function chip(icon, text){
  const span = document.createElement("span");
  span.className = "kv";
  span.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">${icon}</span>${escapeHTML(text)}`;
  return span;
}
function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function toMMSS(s){
  const m = Math.floor(s/60);
  const r = s % 60;
  return String(m).padStart(2,"0")+":"+String(r).padStart(2,"0");
}

document.addEventListener("DOMContentLoaded", () => App.mount());
