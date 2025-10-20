async function load() {
  const res = await fetch('manifest.json', { cache: 'no-store' });
  const data = await res.json();
  const items = data.items || [];

  const langs = Array.from(new Set(items.map(i => i.language))).sort();
  const selLang = document.getElementById('lang');
  langs.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l; opt.textContent = l;
    selLang.appendChild(opt);
  });

  const state = { q: '', lang: '', sort: 'name-asc' };
  const $q = document.getElementById('q');
  const $sort = document.getElementById('sort');
  const $list = document.getElementById('list');

  $q.addEventListener('input', () => { state.q = $q.value.toLowerCase(); render(); });
  selLang.addEventListener('change', () => { state.lang = selLang.value; render(); });
  $sort.addEventListener('change', () => { state.sort = $sort.value; render(); });

  function matches(i) {
    if (state.lang && i.language !== state.lang) return false;
    if (!state.q) return true;
    const hay = (i.name + ' ' + i.description).toLowerCase();
    return hay.includes(state.q);
  }

  function sortItems(arr) {
    const byNameAsc = (a,b)=> a.name.localeCompare(b.name);
    const byLangAsc = (a,b)=> a.language.localeCompare(b.language) || byNameAsc(a,b);
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
  }

  function render() {
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
          <a class="btn" href="${i.view_url}" target="_blank">Voir</a>
          <a class="btn" href="${i.download_url}" download>Télécharger</a>
        </div>
        <div class="muted">${i.last_commit ? 'Modifié : ' + new Date(i.last_commit).toLocaleString('fr-FR') : ''}</div>
      `;
      $list.appendChild(card);
    }
  }
  render();
}
load();
