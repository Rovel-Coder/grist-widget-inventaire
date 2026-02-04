// 🎯 Configuration complète des colonnes
grist.ready({
  requiredAccess: 'read table',
  allowSelectBy: true,
  columns: [
    // --- Colonnes obligatoires pour l'affichage ---
    { name: "title", title: "Titre (Obligatoire)", type: "Text" },
    
    // --- Colonnes visuelles ---
    { name: "image", title: "Image", type: "Attachments", optional: true },
    { name: "display", title: "Champs à afficher dans la carte", type: "Any", allowMultiple: true, optional: true },
    
    // --- Colonnes pour les FILTRES (Dropdowns) ---
    // Si l'utilisateur mappe ces colonnes, le filtre apparaitra
    { name: "filter_category", title: "Filtre: Catégorie", type: "Text", optional: true },
    { name: "filter_institution", title: "Filtre: Institution", type: "Text", optional: true },
    { name: "filter_author", title: "Filtre: Auteur", type: "Text", optional: true },
    { name: "filter_validation", title: "Filtre: Validation", type: "Any", optional: true }
  ],
  onRecords: updateData
});

let allData = [];
let currentConfig = {};
let uniqueValues = {}; // Pour stocker les listes déroulantes

// 🎨 Gestionnaire de configuration
grist.onOptions(function(options, interaction) {
  currentConfig = interaction || {};
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
  
  if (!data || !data.id || data.id.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#888;grid-column:1/-1">Aucune donnée</div>`;
    return;
  }

  // Vérification config minimale
  if (!currentConfig.title) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#888;grid-column:1/-1">⚠️ Veuillez configurer la colonne <b>Titre</b> dans le panneau de droite.</div>`;
    return;
  }

  // 1. Transformer les données brutes en objets propres
  allData = data.id.map((id, i) => {
    const item = { 
      id: id,
      title: formatVal(data[currentConfig.title][i]),
      image: extractImageUrl(currentConfig.image ? data[currentConfig.image][i] : null),
      fields: [],
      // Données pour les filtres
      f_category: currentConfig.filter_category ? formatVal(data[currentConfig.filter_category][i]) : null,
      f_institution: currentConfig.filter_institution ? formatVal(data[currentConfig.filter_institution][i]) : null,
      f_author: currentConfig.filter_author ? formatVal(data[currentConfig.filter_author][i]) : null,
      f_validation: currentConfig.filter_validation ? formatVal(data[currentConfig.filter_validation][i]) : null,
    };

    // Champs à afficher
    if (currentConfig.display && Array.isArray(currentConfig.display)) {
      currentConfig.display.forEach(colKey => {
         // On n'affiche pas les colonnes techniques dans le corps de la carte
         if ([currentConfig.title, currentConfig.image].includes(colKey)) return;
         
         const val = formatVal(data[colKey][i]);
         if (val) item.fields.push({ label: colKey, value: val });
      });
    } else if (typeof currentConfig.display === 'string') {
       // Cas où une seule colonne est sélectionnée
       const val = formatVal(data[currentConfig.display][i]);
       if (val) item.fields.push({ label: currentConfig.display, value: val });
    }
    
    // Chaîne de recherche globale (Titre + tous les champs visibles)
    const allText = [item.title, ...item.fields.map(f => f.value)].join(' ').toLowerCase();
    item.searchStr = allText;

    return item;
  });

  // 2. Générer les filtres dynamiquement
  setupFilters();

  // 3. Afficher
  applyFilters();
}

// 🏗️ Construction des menus déroulants
function setupFilters() {
  const container = document.getElementById('filters-container');
  container.innerHTML = ''; // Reset

  // Liste des filtres potentiels à créer
  const filtersDef = [
    { key: 'f_category', label: 'Catégorie', active: !!currentConfig.filter_category },
    { key: 'f_institution', label: 'Institution', active: !!currentConfig.filter_institution },
    { key: 'f_author', label: 'Auteur', active: !!currentConfig.filter_author },
    { key: 'f_validation', label: 'Validation', active: !!currentConfig.filter_validation },
  ];

  filtersDef.forEach(def => {
    if (!def.active) return; // On ne crée pas le select si la colonne n'est pas mappée

    // Récupérer valeurs uniques
    const values = [...new Set(allData.map(d => d[def.key]).filter(Boolean))].sort();
    
    // Créer le HTML Select
    const select = document.createElement('select');
    select.className = 'filter-select';
    select.id = `select-${def.key}`;
    select.onchange = applyFilters; // Déclenche le filtre au changement

    // Option par défaut
    select.innerHTML = `<option value="">Tous : ${def.label}</option>`;
    
    values.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.innerText = val;
      select.appendChild(opt);
    });

    container.appendChild(select);
  });
}

// 🔎 Moteur de filtrage
function applyFilters() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  
  // Récupérer les valeurs actuelles des selects existants
  const catFilter = document.getElementById('select-f_category')?.value;
  const instFilter = document.getElementById('select-f_institution')?.value;
  const authFilter = document.getElementById('select-f_author')?.value;
  const validFilter = document.getElementById('select-f_validation')?.value;

  const filtered = allData.filter(item => {
    // 1. Recherche texte
    if (query && !item.searchStr.includes(query)) return false;

    // 2. Filtres Selects (si actifs)
    if (catFilter && item.f_category !== catFilter) return false;
    if (instFilter && item.f_institution !== instFilter) return false;
    if (authFilter && item.f_author !== authFilter) return false;
    if (validFilter && item.f_validation !== validFilter) return false;

    return true;
  });

  renderGrid(filtered);
}

// 🖼️ Affichage Grille
function renderGrid(data) {
  const container = document.getElementById('results');
  document.getElementById('results-count').innerText = `(${data.length})`;

  if (data.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#888;grid-column:1/-1">Aucun résultat ne correspond à vos filtres.</div>`;
    return;
  }

  container.innerHTML = data.map(item => `
    <div class="card" onclick="grist.setCursorPos({rowId: ${item.id}})">
      ${item.image ? `<div class="card-image"><img src="${item.image}"></div>` : ''}
      <div class="card-content">
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
        
        ${item.fields.map(f => `
          <div class="field-row">
            <span class="field-label">${escapeHtml(f.label)}</span>
            <span class="field-value">${escapeHtml(f.value)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// 🛠️ Helpers
function formatVal(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (Array.isArray(v)) return v.length > 0 && typeof v[0] !== 'object' ? v.join(', ') : v[0]?.toString();
  if (typeof v === 'object') return null; 
  return String(v);
}

function extractImageUrl(v) {
  if (Array.isArray(v) && v.length > 0 && v[0].url) return v[0].url;
  return null;
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
