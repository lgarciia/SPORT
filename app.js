/* SPA minimaliste — Accueil en liste (une ligne par séance), pas de bottom nav */

const $ = (sel, root=document) => root.querySelector(sel);

const App = {
  data: null,
  mount(){
    // Charge les données
    try {
      this.data = JSON.parse(document.getElementById("sessions-data").textContent.trim());
    } catch(e){
      console.error("JSON invalide", e);
      this.data = { sessions: [] };
    }

    // Router
    window.addEventListener("hashchange", () => this.route());
    this.route();
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

  /* ====== HOME (liste sobre, une ligne) ====== */
  renderHome(){
    const root = document.getElementById("app");
    root.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "list-rows";

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
        <span class="row-meta"><span class="material-symbols-rounded">chevron_right</span></span>
      `;
      wrap.appendChild(a);
    });

    root.appendChild(wrap);
  },

  /* ====== Détail de séance ====== */
  renderSession(s){
    const root = document.getElementById("app");
    root.innerHTML = "";

    const container = document.createElement("div");
    container.className = "container";

    const top = document.createElement("div");
    top.className = "header-row";
    top.innerHTML = `
      <button class="btn" onclick="history.back()">
        <span class="material-symbols-rounded">arrow_back</span>Retour
      </button>
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
      (s.warmup.steps || []).forEach(step => {
        list.appendChild(itemRow("local_fire_department", step));
      });
      sec.appendChild(list);
      container.appendChild(sec);
    }

    // Exercices / Supersets
    if(Array.isArray(s.exercises)){
      container.appendChild(this.renderExercises(s.exercises));
    }
    if(Array.isArray(s.supersets)){
      container.appendChild(this.renderSupersets(s.supersets));
    }

    // Finisher
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
      }else{
        const row = itemRow("flag", `<strong>${escapeHTML(s.finisher.name)}</strong> — ${escapeHTML(s.finisher.protocol || "")}`);
        if(s.finisher.cues){
          const m = document.createElement("div"); m.className = "meta mt8"; m.textContent = s.finisher.cues; row.appendChild(m);
        }
        list.appendChild(row);
      }
      sec.appendChild(list);
      container.appendChild(sec);
    }

    // Conseils
    if(Array.isArray(s.tips) && s.tips.length){
      const sec = section("Conseils séance");
      const ul = document.createElement("ul"); ul.className = "clean";
      s.tips.forEach(t => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
      sec.appendChild(ul);
      container.appendChild(sec);
    }

    root.appendChild(container);
  },

  renderExercises(exs){
    const sec = section("Exercices");
    const list = document.createElement("div"); list.className = "list";
    exs.forEach(ex=>{
      const row = itemRow(ex.icon || "fitness_center", `<strong>${escapeHTML(ex.name)}</strong>`);
      const meta = metaRow(ex);
      if(meta) row.appendChild(meta);
      if(ex.cues){ const m = document.createElement("div"); m.className = "meta mt8"; m.textContent = ex.cues; row.appendChild(m); }
      list.appendChild(row);
    });
    sec.appendChild(list);
    return sec;
  },

  renderSupersets(blocks){
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
        list.appendChild(row);
      });
      sec.appendChild(list);
      frag.appendChild(sec);
    });
    return frag;
  }
};

/* ===== Helpers ===== */
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
