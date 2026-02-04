// 🎯 Configuration manuelle des colonnes via l'interface Grist
grist.ready({
  requiredAccess: 'full',
  allowSelectBy: true,
  columns: [
    {
      name: "titleColumn",
      title: "Colonne Titre",
      description: "Colonne principale affichée comme titre de la carte",
      optional: false,
      type: "Text",
      allowMultiple: false
    },
    {
      name: "imageColumn",
      title: "Colonne Image",
      description: "Colonne contenant les images/attachments à afficher",
      optional: true,
      type: "Attachments",
      allowMultiple: false
    },
    {
      name: "displayColumns",
      title: "Colonnes à afficher",
      description: "Colonnes supplémentaires à afficher dans les cartes",
      optional: true,
      allowMultiple: true
    },
    {
      name: "searchColumns",
      title: "Colonnes de recherche",
      description: "Colonnes utilisées pour la recherche (si vide, cherche partout)",
      optional: true,
      allowMultiple: true
    }
  ],
  // ✅ Gestionnaire natif pour les mises à jour
  onRecords: function() {
    loadData();
  }
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
  
  // Conversion en tableau si nécessaire
  widgetConfig.displayColumns = Array.isArray(mappings.displayColumns) 
    ? mappings.displayColumns 
    : (mappings.displayColumns ? [mappings.displayColumns] : []);
    
  widgetConfig.searchColumns = Array.isArray(mappings.searchColumns) 
    ? mappings.searchColumns 
    : (mappings.searchColumns ? [mappings.searchColumns] : []);

  loadData();
});

// 📊 Parsing des données
function parseGristData(data) {
  if (!data) return [];

  if (!Array.isArray(data) && typeof data === 'object') {
    const ids = data.id || [];
    // Récupère toutes les clés de colonnes disponibles dans les données reçues
    const availableKeys = Object.keys(data).filter(k => k !== 'id');

    return ids.map((id, index) => {
      const record = {};
      availableKeys.forEach(key => {
        record[key] = data[key][index];
      });

      // --- LOGIQUE DE RECHERCHE AMÉLIORÉE ---
      let searchParts = [];
      let usedConfiguredColumns = false;

      // 1. Essayer d'utiliser les colonnes configurées SI elles existent dans les données
      if (widgetConfig.searchColumns.length > 0) {
        widgetConfig.searchColumns.forEach(col => {
          // On vérifie si la colonne existe vraiment dans les données reçues
          if (record[col] !== undefined) {
            const value = formatValueForSearch(record[col]);
            if (value) {
              searchParts.push(value);
              usedConfiguredColumns = true;
            }
          }
        });
      }

      // 2. FALLBACK : Si aucune colonne configurée n'a donné de résultat (ou si elles sont absentes),
      // on inclut TOUTES les colonnes textuelles disponibles pour éviter 0 résultat.
      if (!usedConfiguredColumns || searchParts.length === 0) {
        availableKeys.forEach(key => {
          // Évite de ré-ajouter ce qu'on a déjà ajouté si possible, mais ici on veut être sûr
          const value = formatValueForSearch(record[key]);
          if (value) searchParts.push(value);
        });
      }

      const searchString = searchParts.join(' ').toLowerCase();

      return { id, fields: record, searchString };
    });
  }
  return [];
}

// 🛠️ Utilitaires de formatage
function formatValueForSearch(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value) && value.length > 0) {
    if (typeof value[0] === 'object' && value[0] !== null) return value.map(v => v.toString()).join(' ');
    return value[0].toString();
  }
  if (typeof value === 'object' && value !== null) return Object.values(value).join(' ');
  return value.toString();
}

function formatValueForDisplay(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value) && value.length > 0) {
    if (typeof value[0] === 'object' && value[0].name) return null; // Skip attachments objects
    return value[0].toString();
  }
  if (typeof value === 'boolean') return value ? '✓ Oui' : '✗ Non';
  if (typeof value === 'number') return value.toLocaleString('fr-FR');
  return value.toString();
}

// 🚀 Chargement et Affichage
async function loadData() {
  const container = document.getElementById('results');

  if (!widgetConfig.titleColumn) {
    container.innerHTML = `<div style="padding:40px;text-align:center;color:#666;">Configuration requise : Sélectionnez une Colonne Titre.</div>`;
    return;
  }

  try {
    const data = await grist.fetchSelectedTable();
    allData = parseGristData(data);
    search(); // Applique le filtre de recherche actuel s'il y en a un
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
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; opacity: 0.6; grid-column: 1/-1;">
        <div style="font-size: 48px; margin-bottom: 10px;">🔍</div>
        <div>Aucun résultat trouvé</div>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(item => {
    // Sécurisation : si la colonne titre est manquante dans les données, on évite le crash
    const rawTitle = item.fields[widgetConfig.titleColumn];
    const title = rawTitle ? formatValueForDisplay(rawTitle) : 'Sans titre (Colonne manquante ?)';
    
    const imageUrl = getImageUrl(item.fields[widgetConfig.imageColumn]);
    
    let displayFields = widgetConfig.displayColumns
      .filter(col => col !== widgetConfig.titleColumn)
      .map(col => {
         // Récupération sécurisée
         const val = item.fields[col];
         if (val === undefined) return null; // Colonne non visible
         const fmtVal = formatValueForDisplay(val);
         if (!fmtVal) return null;
         
         // Nom de la colonne (approximatif via ID)
         const label = col.replace(/_/g, ' '); 
         return `<div class="field-row"><span class="field-label">${escapeHtml(label)}:</span> <span class="field-value">${escapeHtml(fmtVal)}</span></div>`;
      })
      .filter(Boolean)
      .join('');

    return `
      <div class="card" onclick="grist.setCursorPos({rowId: ${item.id}})">
        ${imageUrl ? `<div class="card-image"><img src="${imageUrl}" onerror="this.style.display='none'"></div>` : ''}
        <div class="card-content">
          <h3 class="card-title">${escapeHtml(title)}</h3>
          ${displayFields}
        </div>
      </div>
    `;
  }).join('');
}

function getImageUrl(attachments) {
  if (!attachments || !Array.isArray(attachments) || !attachments[0]) return null;
  return attachments[0].url || null;
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function search() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  if (!query) {
    renderResults(allData);
    return;
  }
  const filtered = allData.filter(item => item.searchString.includes(query));
  renderResults(filtered);
}

// Initialisation
loadData();
