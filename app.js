/* Simple SPA – routeur hash + rendu à partir des données intégrées dans index.html */

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const App = {
  data: null,
  mount(){
    // Récupère le JSON embarqué
    const raw = $("#sessions-data").textContent.trim();
    try { this.data = JSON.parse(raw); }
    catch(e){ console.error("JSON sessions invalide", e); this.data = { sessions: [] }; }

    // Nav
    $("#nav-home").addEventListener("click", () => { location.hash = ""; });

    // Router
    window.addEventListener("hashchange", () => this.route());
    this.route(); // first paint
  },

  route(){
    const hash = location.hash.slice(1); // ex: /session/arms_load_intensity
    const parts = hash.split("/").filter(Boolean);
    if(parts[0] === "session" && parts[1]){
      const id = parts[1];
      const s = this.data.sessions.find(x => x.session_id === id);
      if(!s) return this.renderNotFound(id);
      this.renderSession(s);
    } else {
      this.renderHome();
    }
  },

  // ============ RENDERERS ============
  renderHome(){
    const root = $("#app");
    root.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "grid";

    // Tri par jour (ordre custom LUN→SAM)
    const order = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
    const sessions = [...this.data.sessions].sort((a,b) => order.indexOf(a.day) - order.indexOf(b.day));

    sessions.forEach(s => {
      const card = document.createElement("button");
      card.className = "card";
      card.setAttribute("onclick", `location.hash='#/session/${s.session_id}'`);
      card.innerHTML = `
        <div class="card-header">
          <span class="material-symbols-rounded" aria-hidden="true">${s.icon || "fitness_center"}</span>
          <div>
            <h2 class="card-title m0">${escapeHTML(s.name)}</h2>
            <div class="card-sub">${escapeHTML(s.day)}</div>
          </div>
        </div>
        <div class="row mt12">
          <span class="kv"><span class="material-symbols-rounded">schedule</span>${this._durationHint(s)}</span>
          <span class="kv"><span class="material-symbols-rounded">info</span>Détails</span>
        </div>
      `;
      grid.appendChild(card);
    });

    const headerRow = document.createElement("div");
    headerRow.className = "header-row";
    headerRow.innerHTML = `
      <div class="pill"><span class="material-symbols-rounded">bolt</span> iPhone 12+ Ready</div>
      <button class="btn btn-primary" onclick="location.hash=''">
        <span class="material-symbols-rounded">home</span> Accueil
      </button>
    `;

    root.appendChild(headerRow);
    root.appendChild(grid);
  },

  renderSession(s){
    const root = $("#app");
    root.innerHTML = "";

    // Header
    const top = document.createElement("div");
    top.className = "header-row";
    top.innerHTML = `
      <div class="row">
        <button class="btn" onclick="history.back()"><span class="material-symbols-rounded">arrow_back</span>Retour</button>
        <span class="pill"><span class="material-symbols-rounded">${s.icon || "fitness_center"}</span>${escapeHTML(s.day)}</span>
      </div>
      <div class="row">
        <button class="btn" onclick="location.hash=''"><span class="material-symbols-rounded">home</span>Accueil</button>
      </div>
    `;
    root.appendChild(top);

    // Title
    const title = document.createElement("h2");
    title.className = "m0";
    title.textContent = s.name;
    root.appendChild(title);

    // Notes
    if(s.notes){
      const notes = document.createElement("div");
      notes.className = "mt8 meta";
      notes.textContent = s.notes;
      root.appendChild(notes);
    }

    // Warmup
    if(s.warmup){
      const sec = section("Échauffement");
      const ul = document.createElement("div");
      ul.className = "list";
      (s.warmup.steps || []).forEach((t,i)=>{
        ul.appendChild(itemRow("local_fire_department", `${t}`));
      });
      sec.appendChild(ul);
      root.appendChild(sec);
    }

    // Exercises OR Supersets
    if(Array.isArray(s.exercises)){
      root.appendChild(this.renderExercises(s.exercises));
    }
    if(Array.isArray(s.supersets)){
      root.appendChild(this.renderSupersets(s.supersets));
    }

    // Finisher
    if(s.finisher){
      const sec = section("Finisher");
      const list = document.createElement("div");
      list.className = "list";

      const fin = s.finisher;
      if(Array.isArray(fin.exercises)){
        fin.exercises.forEach((fx, idx)=>{
          list.appendChild(itemRow("flag", `<strong>${escapeHTML(fx.name)}</strong> — ${escapeHTML(fx.protocol || "")}`));
          const meta = metaRow({ rest_s: fx.rest_s, special: fx.cues });
          if(meta) list.lastElementChild.appendChild(meta);
        });
      } else {
        list.appendChild(itemRow("flag", `<strong>${escapeHTML(fin.name)}</strong> — ${escapeHTML(fin.protocol || "")}`));
        if(fin.cues){
          const m = document.createElement("div"); m.className = "meta mt8"; m.textContent = fin.cues; list.lastElementChild.appendChild(m);
        }
      }

      sec.appendChild(list);
      root.appendChild(sec);
    }

    // Tips
    if(Array.isArray(s.tips) && s.tips.length){
      const sec = section("Conseils séance");
      const ul = document.createElement("ul");
      ul.className = "clean";
      s.tips.forEach(t => {
        const li = document.createElement("li"); li.textContent = t; ul.appendChild(li);
      });
      sec.appendChild(ul);
      root.appendChild(sec);
    }
  },

  renderExercises(arr){
    const sec = section("Exercices");
    const list = document.createElement("div");
    list.className = "list";
    arr.forEach((ex, idx)=>{
      const row = itemRow(ex.icon ? ex.icon : "fitness_center", `<strong>${escapeHTML(ex.name)}</strong>`);
      // meta chips
      const meta = metaRow(ex);
      if(meta) row.appendChild(meta);
      // cues
      if(ex.cues){ const m = document.createElement("div"); m.className = "meta mt8"; m.textContent = ex.cues; row.appendChild(m); }
      list.appendChild(row);
    });
    sec.appendChild(list);
    return sec;
  },

  renderSupersets(blocks){
    const frag = document.createDocumentFragment();
    blocks.forEach((ss, i)=>{
      const sec = section(`Superset ${i+1} — ${ss.name || ""}`.trim());
      if(Number.isFinite(ss.rest_s)){
        const r = document.createElement("div");
        r.className = "meta mt8";
        r.textContent = `Repos entre supersets : ${ss.rest_s}s`;
        sec.appendChild(r);
      }
      const list = document.createElement("div"); list.className = "list";
      (ss.exercises || []).forEach(ex=>{
        const row = itemRow(ex.icon || "fitness_center", `<strong>${escapeHTML(ex.name)}</strong>`);
        const meta = metaRow(ex);
        if(meta) row.appendChild(meta);
        if(ex.cues){ const m = document.createElement("div"); m.className = "meta mt8"; m.textContent = ex.cues; row.appendChild(m); }
        list.appendChild(row);
      });
      sec.appendChild(list);
      frag.appendChild(sec);
    });
    return frag;
  },

  _durationHint(s){
    // Hint basique : echauffement + nb exos * une moyenne
    const warm = s.warmup?.duration_min ? `${s.warmup.duration_min}min` : "~";
    const count = (s.exercises?.length || 0) + (s.supersets?.reduce((a,b)=>a+(b.exercises?.length||0),0) || 0);
    const approx = count ? `${Math.max(35, Math.min(90, 8*count))}min` : "—";
    return `~${approx}`;
  }
};

// Helpers UI
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

document.addEventListener("DOMContentLoaded", () => App.mount());
