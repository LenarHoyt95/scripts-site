// ================== LISTE + TÉLÉCHARGEMENT ==================
async function fetchManifest() {
  const res = await fetch('manifest.json?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Impossible de charger manifest.json');
  return res.json();
}

function mountFilters(items) {
  const langs = Array.from(new Set(items.map(i => i.language))).sort();
  const selLang = document.getElementById('lang');
  selLang.innerHTML = '<option value="">Toutes les langues</option>';
  langs.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l; opt.textContent = l;
    selLang.appendChild(opt);
  });
}

function makeState() {
  return { q: '', lang: '', sort: 'name-asc' };
}

function attachFilterHandlers(state, render) {
  const $q = document.getElementById('q');
  const $sort = document.getElementById('sort');
  const selLang = document.getElementById('lang');

  $q.addEventListener('input', () => { state.q = $q.value.toLowerCase(); render(); });
  selLang.addEventListener('change', () => { state.lang = selLang.value; render(); });
  $sort.addEventListener('change', () => { state.sort = $sort.value; render(); });
}

function matchesFactory(state) {
  return function matches(i) {
    if (state.lang && i.language !== state.lang) return false;
    if (!state.q) return true;
    const hay = (i.name + ' ' + i.description).toLowerCase();
    return hay.includes(state.q);
  };
}

function sortItemsFactory(state) {
  return function sortItems(arr) {
    const byNameAsc = (a,b)=> a.name.localeCompare(b.name, 'fr', { sensitivity:'base' });
    const byLangAsc = (a,b)=> a.language.localeCompare(b.language, 'fr', { sensitivity:'base' }) || byNameAsc(a,b);
    const byDateAsc = (a,b)=> (a.last_commit||'').localeCompare(b.last_commit||'');
    const byDateDesc = (a,b)=> -byDateAsc(a,b);
    switch(state.sort){
      case 'name-asc': return arr.sort(byNameAsc);
      case 'name-desc': return arr.sort((a,b)=>-byNameAsc(a,b));
      case 'lang-asc': return arr.sort(byLangAsc);
      case 'date-asc': return arr.sort(byDateAsc);
      case 'date-desc': return arr.sort(byDateDesc);
      default: return arr;
    }
  };
}

function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('fr-FR'); } catch { return iso; }
}

// Télécharger via blob pour déclencher la boîte “Enregistrer sous…” (si activée côté navigateur)
async function downloadScript(item) {
  try {
    const res = await fetch(item.download_url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Échec du téléchargement');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = item.entry || 'script';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  } catch (e) {
    console.error(e);
    alert("Téléchargement impossible. Réessaie plus tard.");
  }
}

function renderList(items, state) {
  const $list = document.getElementById('list');
  const matches = matchesFactory(state);
  const sortItems = sortItemsFactory(state);

  $list.innerHTML = '';
  const filtered = sortItems(items.filter(matches));
  if (!filtered.length) { $list.innerHTML = '<div>Aucun script trouvé…</div>'; return; }

  for (const i of filtered) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="name">${i.name}</div>
      <div class="language">${i.language}</div>
      <div class="desc">${i.description || ''}</div>
      <div class="row">
        <a class="btn" href="${i.view_url}" target="_blank" rel="noopener">Voir</a>
        <button class="btn" data-dl>Télécharger</button>
      </div>
      <div class="muted">${i.last_commit ? 'Modifié : ' + fmtDate(i.last_commit) : ''}</div>
    `;
    card.querySelector('[data-dl]').addEventListener('click', () => downloadScript(i));
    $list.appendChild(card);
  }
}

async function load() {
  const data = await fetchManifest();
  const items = data.items || [];
  mountFilters(items);
  const state = makeState();
  attachFilterHandlers(state, () => renderList(items, state));
  renderList(items, state);
}

load().catch(err => {
  console.error(err);
  document.getElementById('list').innerHTML = '<div>Erreur de chargement du catalogue.</div>';
});

// ================== UI D’UPLOAD VERS GITHUB ==================
// (nécessite la modale HTML avec #open-upload, #upload-modal, etc.)

function toBase64FromArrayBuffer(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function putFileToGitHub({ token, owner, repo, path, contentBase64, message, branch="main" }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json"
    },
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch
    })
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=> "");
    throw new Error(`PUT ${path} -> ${res.status}: ${txt}`);
  }
  return res.json();
}

async function refreshListAfterUpload() {
  // Petit délai pour laisser GitHub Actions démarrer puis maj manifest.json
  // Le manifest sera mis à jour quand le workflow aura fini.
  try {
    const data = await fetchManifest();
    const items = data.items || [];
    // re-monter les filtres (nouvelles langues éventuelles)
    mountFilters(items);
    const state = makeState();
    attachFilterHandlers(state, () => renderList(items, state));
    renderList(items, state);
  } catch (e) {
    console.warn("Manifest pas encore prêt, recharge la page un peu plus tard.");
  }
}

function initUploadUI() {
  const modal = document.getElementById("upload-modal");
  const openBtn = document.getElementById("open-upload");
  if (!modal || !openBtn) return; // UI pas présente sur la page

  const cancelBtn = document.getElementById("cancel-upload");
  const doBtn = document.getElementById("do-upload");

  openBtn.addEventListener("click", () => { modal.style.display = "block"; });
  cancelBtn.addEventListener("click", () => { modal.style.display = "none"; });

  doBtn.addEventListener("click", async () => {
    try {
      doBtn.disabled = true; doBtn.textContent = "Création…";

      const token = document.getElementById("gh-token").value.trim();
      const owner = document.getElementById("gh-owner").value.trim();
      const repo  = document.getElementById("gh-repo").value.trim() || "scripts-site";
      const slug  = document.getElementById("script-slug").value.trim();
      const fileInput = document.getElementById("script-file");
      const file  = fileInput && fileInput.files[0];
      const name  = document.getElementById("meta-name").value.trim();
      const lang  = document.getElementById("meta-language").value.trim();
      const desc  = document.getElementById("meta-desc").value.trim();

      if (!token || !owner || !repo || !slug || !file || !name || !lang) {
        alert("Merci de remplir token, owner, repo, slug, fichier, nom, langage.");
        return;
      }

      // 1) Upload du fichier script (créera le dossier scripts/<slug>/)
      const buf = await file.arrayBuffer();
      const b64 = toBase64FromArrayBuffer(buf);
      const entryName = file.name;

      const scriptPath = `scripts/${slug}/${entryName}`;
      await putFileToGitHub({
        token, owner, repo,
        path: scriptPath,
        contentBase64: b64,
        message: `feat(${slug}): add ${entryName}`
      });

      // 2) Création du meta.json
      const meta = { name, language: lang, description: desc, entry: entryName };
      const metaB64 = btoa(unescape(encodeURIComponent(JSON.stringify(meta, null, 2))));
      const metaPath = `scripts/${slug}/meta.json`;
      await putFileToGitHub({
        token, owner, repo,
        path: metaPath,
        contentBase64: metaB64,
        message: `chore(${slug}): add meta.json`
      });

      alert("✅ Script créé sur GitHub. Le site se mettra à jour après le workflow.");
      modal.style.display = "none";

      // Optionnel : tenter un refresh immédiat (si le manifest est déjà prêt)
      setTimeout(refreshListAfterUpload, 5000);

    } catch (e) {
      console.error(e);
      alert("❌ Échec de l’upload : " + e.message);
    } finally {
      doBtn.disabled = false; doBtn.textContent = "Créer";
    }
  });
}

document.addEventListener("DOMContentLoaded", initUploadUI);
