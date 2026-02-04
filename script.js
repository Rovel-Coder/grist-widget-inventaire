// 🎯 Configuration stricte et minimale pour forcer l'affichage des menus
grist.ready({
  requiredAccess: 'read table',
  allowSelectBy: true,
  columns: [
    {
      name: "titleColumn",
      title: "Titre de la carte",
      type: "Text",
      optional: false, // Obligatoire
      allowMultiple: false
    },
    {
      name: "imageColumn",
      title: "Image d'illustration",
      type: "Attachments",
      optional: true,
      allowMultiple: false
    },
    {
      name: "displayColumns",
      title: "Champs à afficher",
      type: "Any", // Plus permissif
      optional: true,
      allowMultiple: true
    },
    {
      name: "searchColumns",
      title: "Champs de recherche",
      type: "Any",
      optional: true,
      allowMultiple: true
    }
  ],
  onRecords: updateData
});

// Variables globales
let currentData = [];
let currentConfig = {};

// 🎨 Gestionnaire de configuration (appelé quand vous changez les menus)
grist.onOptions(function(options, interaction) {
  // Sauvegarde la config
  currentConfig = interaction || {};
  
  // Convertit en tableaux si nécessaire
  if (currentConfig.displayColumns && !Array.isArray(currentConfig.displayColumns)) {
    currentConfig.displayColumns = [currentConfig.displayColumns];
  }
  if (currentConfig.searchColumns && !Array.isArray(currentConfig.searchColumns)) {
    currentConfig.searchColumns = [currentConfig.searchColumns];
  }

  // Force le rafraîchissement
  updateData();
});

// 🔄 Fonction de mise à jour appelée par Grist (onRecords)
// Cette fonction ne prend PAS d'arguments, elle doit aller chercher les données.
async function updateData() {
  try {
    const data = await grist.fetchSelectedTable();
    processData(data);
  } catch (e) {
    console.error("Erreur de récupération:", e);
    document.getElementById('results').innerHTML = `<div style="padding:20px;color:red">Erreur: ${e.message}</div>`;
  }
}

// ⚙️ Traitement des données
function processData(data) {
  const container = document.getElementById('results');
  
  if (!data || !data.id || data.id.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#888">Aucune donnée trouvée.</div>`;
    return;
  }

  // Si aucune configuration n'est reçue (cas du premier chargement buggé)
  // On ne tente PAS de deviner, on demande à l'utilisateur de configurer.
  // C'est ce qui force l'affichage du panneau correct.
  if (!currentConfig.titleColumn) {
    container.innerHTML = `
      <div style="text-align:center;padding:50px;">
        <div style="font-size:40px;margin-bottom:20px">⚙️</div>
        <strong>Configuration requise</strong><br><br>
        Ouvrez le panneau de droite et sélectionnez<br>la colonne <b>"Titre de la carte"</b>.
      </div>`;
    return;
  }

  // Mapping des données
  currentData = data.id.map((id, i) => {
    const record = { id: id };
    
    // Titre
    record.title = formatVal(data[currentConfig.titleColumn]?.[i]);
    
    // Image
    const imgRaw = currentConfig.imageColumn ? data[currentConfig.imageColumn]?.[i] : null;
    record.image = (Array.isArray(imgRaw) && imgRaw[0]) ? imgRaw[0].url : null;
    
    // Champs à afficher
    record.fields = [];
    if (currentConfig.displayColumns) {
      currentConfig.displayColumns.forEach(colKey => {
        // On ignore le titre et l'image pour éviter les doublons
        if (colKey === currentConfig.titleColumn || colKey === currentConfig.imageColumn) return;
        
        const rawVal = data[colKey]?.[i];
        const val = formatVal(rawVal);
        if (val) {
          record.fields.push({ label: colKey, value: val });
        }
      });
    }

    // Chaîne de recherche
    let searchTerms = [record.title];
    if (currentConfig.searchColumns) {
      currentConfig.searchColumns.forEach(col => {
        searchTerms.push(formatVal(data[col]?.[i]));
      });
    } else {
      // Fallback recherche : titre + tous les champs affichés
      record.fields.forEach(f => searchTerms.push(f.value));
    }
    record.searchStr = searchTerms.join(' ').toLowerCase();

    return record;
  });

  render();
}

// 🖥️ Affichage
function render() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  const container = document.getElementById('results');
  
  const filtered = currentData.filter(item => !query || item.searchStr.includes(query));
  
  const countEl = document.getElementById('results-count');
  if (countEl) countEl.innerText = filtered.length + (filtered.length > 1 ? " résultats" : " résultat");

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#888">Aucun résultat</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="card" onclick="grist.setCursorPos({rowId: ${item.id}})">
      ${item.image ? `<div class="card-image"><img src="${item.image}"></div>` : ''}
      <div class="card-content">
        <h3 class="card-title">${escapeHtml(item.title || 'Sans titre')}</h3>
        ${item.fields.map(f => `
          <div class="field-row">
            <span class="field-label">${escapeHtml(f.label)}:</span>
            <span class="field-value">${escapeHtml(f.value)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// 🛠️ Utilitaires
function formatVal(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object' && !Array.isArray(v)) return null; // Objet complexe ignoré sauf array
  if (Array.isArray(v)) return v.length > 0 && typeof v[0] !== 'object' ? v.join(', ') : null; // Liste simple
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  return String(v);
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
