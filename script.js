// 🎯 Configuration FORCÉE des colonnes
// On définit les colonnes AVANT tout le reste pour que Grist les lise immédiatement.
grist.ready({
  requiredAccess: 'read table',
  allowSelectBy: true,
  columns: [
    { name: "title", title: "Titre (Obligatoire)", type: "Text", optional: false },
    { name: "image", title: "Image", type: "Attachments", optional: true },
    { name: "display", title: "Champs à afficher", type: "Any", allowMultiple: true, optional: true },
    
    // Filtres
    { name: "f_category", title: "Filtre: Catégorie", type: "Text", optional: true },
    { name: "f_institution", title: "Filtre: Institution", type: "Text", optional: true },
    { name: "f_author", title: "Filtre: Auteur", type: "Text", optional: true },
    { name: "f_validation", title: "Filtre: Validation", type: "Any", optional: true }
  ],
  onRecords: updateData
});

let allData = [];
let currentConfig = {};

// 🎨 Gestionnaire de configuration
grist.onOptions(function(options, interaction) {
  currentConfig = interaction || {};
  // Conversion sécurisée
  if (currentConfig.display && !Array.isArray(currentConfig.display)) currentConfig.display = [currentConfig.display];
  updateData();
});

// 🔄 Récupération des données
async function updateData() {
  try {
    const data = await grist.fetchSelectedTable();
    processData(data);
  } catch (e) {
    console.error(e);
  }
}

// ⚙️ Traitement
function processData(data) {
  const container = document.getElementById('results');
  
  // Reset si vide
  if (!data || !data.id || data.id.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#888;grid-column:1/-1">Aucune donnée</div>`;
    return;
  }

  // Si pas de config titre, on affiche un message clair
  if (!currentConfig.title) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:#888;grid-column:1/-1">
        <div style="font-size:40px;margin-bottom:20px">⚙️</div>
        <strong>Configuration requise</strong><br><br>
        Le panneau de droite doit afficher des menus déroulants.<br>
        Si vous voyez des cases à cocher, supprimez et réajoutez le widget.
      </div>`;
    return;
  }

  // Parsing
  allData = data.id.map((id, i) => {
    const item = { 
      id: id,
      title: formatVal(data[currentConfig.title][i]),
      image: extractImageUrl(currentConfig.image ? data[currentConfig.image][i] : null),
      fields: [],
      // Données filtres
      f_category: currentConfig.f_category ? formatVal(data[currentConfig.f_category][i]) : null,
      f_institution: currentConfig.f_institution ? formatVal(data[currentConfig.f_institution][i]) : null,
      f_author: currentConfig.f_author ? formatVal(data[currentConfig.f_author][i]) : null,
      f_validation: currentConfig.f_validation ? formatVal(data[currentConfig.f_validation][i]) : null,
    };

    // Champs dynamiques
    if (currentConfig.display) {
      currentConfig.display.forEach(colKey => {
         if ([currentConfig.title, currentConfig.image].includes(colKey)) return;
         const val = formatVal(data[colKey][i]);
         if (val) item.fields.push({ label: colKey, value: val });
      });
    }
    
    // Recherche
    item.searchStr = [item.title, ...item.fields.map(f => f.value)].join(' ').toLowerCase();
    return item;
  });

  setupFilters();
  applyFilters();
}

// 🏗️ Filtres UI
function setupFilters() {
  const container = document.getElementById('filters-container');
  // On ne vide le conteneur que s'il est vide ou si la config a changé radicalement
  // pour éviter le scintillement, mais ici on simplifie :
  container.innerHTML = ''; 

  const filtersDef = [
    { key: 'f_category', label: 'Catégorie', val: currentConfig.f_category },
    { key: 'f_institution', label: 'Institution', val: currentConfig.f_institution },
    { key: 'f_author', label: 'Auteur', val: currentConfig.f_author },
    { key: 'f_validation', label: 'Validation', val: currentConfig.f_validation },
  ];

  filtersDef.forEach(def => {
    if (!def.val) return; // Pas de filtre si pas mappé

    const values = [...new Set(allData.map(d => d[def.key]).filter(Boolean))].sort();
    
    const select = document.createElement('select');
    select.className = 'filter-select';
    select.id = `select-${def.key}`;
    select.onchange = applyFilters;
    select.innerHTML = `<option value="">${def.label}</option>`;
    
    values.forEach(val => {
      select.innerHTML += `<option value="${val}">${val}</option>`;
    });
    container.appendChild(select);
  });
}

// 🔎 Moteur de filtrage
function applyFilters() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  const filters = {
    cat: document.getElementById('select-f_category')?.value,
    inst: document.getElementById('select-f_institution')?.value,
    auth: document.getElementById('select-f_author')?.value,
    valid: document.getElementById('select-f_validation')?.value
  };

  const filtered = allData.filter(item => {
    if (query && !item.searchStr.includes(query)) return false;
    if (filters.cat && item.f_category !== filters.cat) return false;
    if (filters.inst && item.f_institution !== filters.inst) return false;
    if (filters.auth && item.f_author !== filters.auth) return false;
    if (filters.valid && item.f_validation !== filters.valid) return false;
    return true;
  });

  renderGrid(filtered);
}

// 🖼️ Rendu
function renderGrid(data) {
  const container = document.getElementById('results');
  document.getElementById('results-count').innerText = `(${data.length})`;

  if (data.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#888;grid-column:1/-1">Aucun résultat</div>`;
    return;
  }

  container.innerHTML = data.map(item => `
    <div class="card" onclick="grist.setCursorPos({rowId: ${item.id}})">
      ${item.image ? `<div class="card-image"><img src="${item.image}"></div>` : ''}
      <div class="card-content">
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        ${item.fields.map(f => `<div class="field-row"><span class="field-label">${escapeHtml(f.label)}</span><span class="field-value">${escapeHtml(f.value)}</span></div>`).join('')}
      </div>
    </div>
  `).join('');
}

// 🛠️ Helpers
function formatVal(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (Array.isArray(v)) return v.length > 0 && typeof v[0] !== 'object' ? v.join(', ') : v[0]?.toString();
  if (typeof v === 'object') return null;
  return String(v);
}

function extractImageUrl(v) {
  if (Array.isArray(v) && v[0]?.url) return v[0].url;
  return null;
}

function escapeHtml(text) {
  return (text || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
