// 🎯 Configuration Grist
grist.ready({
  requiredAccess: 'read table', // 'read table' suffit souvent et évite des conflits
  allowSelectBy: true,
  columns: [
    { name: "titleColumn", title: "Colonne Titre", type: "Text", optional: false },
    { name: "imageColumn", title: "Colonne Image", type: "Attachments", optional: true },
    { name: "displayColumns", title: "Colonnes à afficher", allowMultiple: true, optional: true },
    { name: "searchColumns", title: "Colonnes de recherche", allowMultiple: true, optional: true }
  ],
  onRecords: function() { loadData(); }
});

let allData = [];
let widgetConfig = {
  titleColumn: null,
  imageColumn: null,
  displayColumns: [],
  searchColumns: []
};

// 🎨 Écouteur de configuration
grist.onOptions(function(options, interaction) {
  const mappings = interaction || {};
  
  widgetConfig.titleColumn = mappings.titleColumn || null;
  widgetConfig.imageColumn = mappings.imageColumn || null;
  
  // Conversion sécurisée en tableaux
  widgetConfig.displayColumns = Array.isArray(mappings.displayColumns) ? mappings.displayColumns : (mappings.displayColumns ? [mappings.displayColumns] : []);
  widgetConfig.searchColumns = Array.isArray(mappings.searchColumns) ? mappings.searchColumns : (mappings.searchColumns ? [mappings.searchColumns] : []);

  loadData();
});

// 📊 Parsing des données + Auto-Détection
function parseGristData(data) {
  if (!data) return [];

  if (!Array.isArray(data) && typeof data === 'object') {
    const ids = data.id || [];
    const availableKeys = Object.keys(data).filter(k => k !== 'id');

    // --- AUTO-CONFIGURATION (Si l'utilisateur n'a accès qu'aux cases à cocher) ---
    if (!widgetConfig.titleColumn && availableKeys.length > 0) {
        console.log("⚠️ Aucune config détectée, passage en mode AUTO");
        // Prend la première colonne disponible comme titre par défaut
        widgetConfig.titleColumn = availableKeys[0];
        
        // Essaie de trouver une colonne qui ressemble à une image (contient 'Image', 'Photo' ou 'Logo')
        const potentialImage = availableKeys.find(k => /image|photo|logo|attach/i.test(k));
        if (potentialImage) widgetConfig.imageColumn = potentialImage;
        
        // Met le reste en affichage
        widgetConfig.displayColumns = availableKeys.filter(k => k !== widgetConfig.titleColumn && k !== widgetConfig.imageColumn);
        // Recherche partout par défaut
        widgetConfig.searchColumns = []; 
    }
    // -----------------------------------------------------------------------------

    return ids.map((id, index) => {
      const record = {};
      availableKeys.forEach(key => { record[key] = data[key][index]; });

      // Logique de recherche
      let searchParts = [];
      let usedConfiguredColumns = false;

      // Recherche dans les colonnes configurées
      if (widgetConfig.searchColumns.length > 0) {
        widgetConfig.searchColumns.forEach(col => {
          if (record[col] !== undefined) {
            const value = formatValueForSearch(record[col]);
            if (value) { searchParts.push(value); usedConfiguredColumns = true; }
          }
        });
      }

      // Fallback : recherche partout si pas de config ou pas de résultat
      if (!usedConfiguredColumns || searchParts.length === 0) {
        availableKeys.forEach(key => {
          const value = formatValueForSearch(record[key]);
          if (value) searchParts.push(value);
        });
      }

      return { id, fields: record, searchString: searchParts.join(' ').toLowerCase() };
    });
  }
  return [];
}

// 🛠️ Utilitaires
function formatValueForSearch(value) {
  if (value == null) return '';
  if (Array.isArray(value) && value.length > 0) {
    if (typeof value[0] === 'object') return value.map(v => v.toString()).join(' '); // RefList
    return value[0].toString();
  }
  if (typeof value === 'object') return Object.values(value).join(' ');
  return value.toString();
}

function formatValueForDisplay(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (typeof value[0] === 'object' && value[0].url) return null; // Cache les objets attachments bruts
    return value[0].toString(); // Affiche le premier élément d'une liste
  }
  if (typeof value === 'boolean') return value ? '✓ Oui' : '✗ Non';
  if (typeof value === 'number') return value.toLocaleString('fr-FR');
  return value.toString();
}

function getImageUrl(attachments) {
  if (!attachments || !Array.isArray(attachments) || !attachments[0]) return null;
  return attachments[0].url || null;
}

// 🚀 Affichage
async function loadData() {
  const container = document.getElementById('results');

  try {
    const data = await grist.fetchSelectedTable();
    allData = parseGristData(data);
    
    // Si après le parsing on n'a toujours pas de titre (données vides ?), on affiche un message soft
    if (!widgetConfig.titleColumn && allData.length === 0) {
       container.innerHTML = `<div style="padding:40px;text-align:center;color:#666;">
          <div style="font-size:30px">👋</div><br>
          Aucune donnée reçue.<br>Vérifiez que des colonnes sont cochées dans le panneau "Colonnes VISIBLE".
       </div>`;
       return;
    }

    search(); 
  } catch (err) {
    console.error("Erreur:", err);
    container.innerHTML = `<div style="color:red;padding:20px;">Erreur: ${err.message}</div>`;
  }
}

function renderResults(data) {
  const container = document.getElementById('results');
  const countLabel = document.getElementById('results-count');
  if (countLabel) countLabel.textContent = `${data.length} résultat${data.length > 1 ? 's' : ''}`;

  if (data.length === 0) {
    container.innerHTML = `<div style="padding:40px;text-align:center;opacity:0.6;grid-column:1/-1;">Aucun résultat</div>`;
    return;
  }

  container.innerHTML = data.map(item => {
    const rawTitle = item.fields[widgetConfig.titleColumn];
    const title = formatValueForDisplay(rawTitle) || 'Sans titre';
    const imageUrl = getImageUrl(item.fields[widgetConfig.imageColumn]);

    // Génération dynamique des champs
    let displayFields = widgetConfig.displayColumns
      .map(col => {
         const val = item.fields[col];
         const fmtVal = formatValueForDisplay(val);
         if (!fmtVal) return null;
         return `<div class="field-row"><span class="field-label">${col}:</span> <span class="field-value">${fmtVal}</span></div>`;
      })
      .filter(Boolean).join('');

    return `
      <div class="card" onclick="grist.setCursorPos({rowId: ${item.id}})">
        ${imageUrl ? `<div class="card-image"><img src="${imageUrl}" onerror="this.style.display='none'"></div>` : ''}
        <div class="card-content">
          <h3 class="card-title">${title}</h3>
          ${displayFields}
        </div>
      </div>`;
  }).join('');
}

function search() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  if (!query) { renderResults(allData); return; }
  const filtered = allData.filter(item => item.searchString.includes(query));
  renderResults(filtered);
}

// Initialisation
loadData();
