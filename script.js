// 🎯 Configuration dynamique - S'adapte à toutes les tables
grist.ready({ 
  requiredAccess: 'full', 
  allowSelectBy: true,
  onEditOptions: true // Active la configuration
});

let allData = [];
let widgetConfig = {
  displayColumns: [], // Colonnes à afficher dans les cartes
  searchColumns: [], // Colonnes utilisées pour la recherche
  titleColumn: null, // Colonne principale (titre)
  imageColumn: null, // Colonne d'image/attachments
  availableColumns: [] // Métadonnées des colonnes disponibles
};

// 🔍 Détection automatique des colonnes disponibles
async function detectAvailableColumns() {
  try {
    const tableId = await grist.getTable();
    const tables = await grist.docApi.fetchTable(tableId);
    
    if (tables && tables.length > 0) {
      // Récupérer les métadonnées des colonnes via l'API
      const columns = Object.keys(tables[0]).filter(k => k !== 'id');
      
      widgetConfig.availableColumns = columns.map(colId => ({
        id: colId,
        label: colId.replace(/_/g, ' '), // Label lisible
        type: inferColumnType(tables[0][colId]) // Type inféré
      }));
      
      console.log("📋 Colonnes détectées:", widgetConfig.availableColumns);
      
      // Configuration par défaut intelligente
      setDefaultConfig();
    }
  } catch (err) {
    console.warn("⚠️ Impossible de détecter les colonnes automatiquement:", err);
  }
}

// 🧠 Inférence du type de colonne
function inferColumnType(sampleValue) {
  if (Array.isArray(sampleValue)) {
    if (sampleValue.length > 0 && typeof sampleValue[0] === 'object' && 'name' in sampleValue[0]) {
      return 'Attachments';
    }
    return 'RefList';
  }
  if (typeof sampleValue === 'object' && sampleValue !== null) {
    return 'Ref';
  }
  if (typeof sampleValue === 'number') return 'Numeric';
  if (typeof sampleValue === 'boolean') return 'Toggle';
  return 'Text';
}

// ⚙️ Configuration par défaut intelligente
function setDefaultConfig() {
  const cols = widgetConfig.availableColumns;
  
  // Chercher une colonne de titre (nom, title, label, etc.)
  const titleCandidates = cols.filter(c => 
    /nom|name|title|titre|label/i.test(c.id)
  );
  widgetConfig.titleColumn = titleCandidates[0]?.id || cols[0]?.id;
  
  // Chercher une colonne d'image
  const imageCandidates = cols.filter(c => c.type === 'Attachments');
  widgetConfig.imageColumn = imageCandidates[0]?.id || null;
  
  // Par défaut : afficher les 4 premières colonnes textuelles
  widgetConfig.displayColumns = cols
    .filter(c => ['Text', 'Numeric', 'Choice'].includes(c.type))
    .slice(0, 4)
    .map(c => c.id);
  
  // Recherche sur toutes les colonnes textuelles
  widgetConfig.searchColumns = cols
    .filter(c => ['Text', 'Choice'].includes(c.type))
    .map(c => c.id);
}

// 🎨 Interface de configuration dans Grist
grist.onOptions(function(options, interaction) {
  console.log("⚙️ Options reçues:", options);
  
  // Si l'utilisateur a configuré manuellement
  if (options.titleColumn) widgetConfig.titleColumn = options.titleColumn;
  if (options.imageColumn) widgetConfig.imageColumn = options.imageColumn;
  if (options.displayColumns) widgetConfig.displayColumns = options.displayColumns.split(',');
  if (options.searchColumns) widgetConfig.searchColumns = options.searchColumns.split(',');
  
  console.log("✅ Config appliquée:", widgetConfig);
  loadData();
});

// 📊 Parsing générique des données Grist
function parseGristData(data) {
  if (!data) return [];
  
  console.log("📦 Raw data reçue:", data);
  
  if (!Array.isArray(data) && typeof data === 'object') {
    const ids = data.id || [];
    const keys = Object.keys(data).filter(k => k !== 'id');
    
    console.log("🔑 Colonnes détectées:", keys);
    
    return ids.map((id, index) => {
      const record = {};
      
      // Extraire toutes les valeurs
      keys.forEach(key => {
        record[key] = formatValue(data[key][index], key);
      });
      
      // Construire la chaîne de recherche
      const searchString = widgetConfig.searchColumns
        .map(col => (record[col] || '').toString())
        .join(' ')
        .toLowerCase();
      
      return { 
        id, 
        fields: record, 
        searchString 
      };
    });
  }
  
  return [];
}

// 🎨 Formattage intelligent des valeurs selon le type
function formatValue(value, columnId) {
  // Gestion des références (Ref)
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'number') {
    return value[0].toString(); // Ref simple
  }
  
  // Gestion des attachments
  if (Array.isArray(value) && value.length > 0 && value[0].name) {
    return value; // Garder les attachments tels quels
  }
  
  // Valeurs nulles
  if (value === null || value === undefined) return '';
  
  // Valeurs simples
  return value.toString();
}

// 🚀 Chargement des données
async function loadData() {
  const container = document.getElementById('results');
  
  // Vérifier la configuration minimale
  if (!widgetConfig.titleColumn) {
    await detectAvailableColumns();
  }
  
  try {
    const data = await grist.fetchSelectedTable();
    allData = parseGristData(data);
    
    console.log(`📊 ${allData.length} enregistrements chargés`);
    renderResults(allData);
    
  } catch (err) {
    console.error("❌ Erreur chargement:", err);
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #e74c3c;">
        ❌ Erreur de chargement des données: ${err.message}
      </div>
    `;
  }
}

// 🎨 Rendu générique des cartes
function renderResults(data) {
  const container = document.getElementById('results');
  
  if (data.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; opacity: 0.6;">
        <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
        <div>Aucun enregistrement trouvé</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = data.map(item => {
    const title = item.fields[widgetConfig.titleColumn] || 'Sans titre';
    const imageUrl = getImageUrl(item.fields[widgetConfig.imageColumn]);
    
    // Construire les champs à afficher
    const displayFields = widgetConfig.displayColumns
      .filter(col => col !== widgetConfig.titleColumn) // Éviter doublon titre
      .map(col => {
        const value = item.fields[col];
        if (!value || value === '') return null;
        
        return `
          <div class="field-row">
            <span class="field-label">${col.replace(/_/g, ' ')}:</span>
            <span class="field-value">${escapeHtml(value)}</span>
          </div>
        `;
      })
      .filter(Boolean)
      .join('');
    
    return `
      <div class="card" onclick="selectRow(${item.id})">
        ${imageUrl ? `<div class="card-image"><img src="${imageUrl}" alt="${title}"></div>` : ''}
        <div class="card-content">
          <h3 class="card-title">${escapeHtml(title)}</h3>
          ${displayFields}
        </div>
      </div>
    `;
  }).join('');
}

// 🖼️ Extraction URL d'image depuis Attachments
function getImageUrl(attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }
  
  const firstAttachment = attachments[0];
  if (firstAttachment && firstAttachment.url) {
    return firstAttachment.url;
  }
  
  return null;
}

// 🔒 Échappement HTML pour sécurité
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 🎯 Sélection de ligne dans Grist
async function selectRow(rowId) {
  try {
    await grist.setCursorPos({ rowId });
    console.log(`✅ Ligne ${rowId} sélectionnée`);
  } catch (err) {
    console.error("❌ Erreur sélection:", err);
  }
}

// 🔍 Recherche en temps réel
function search() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  
  if (!query) {
    renderResults(allData);
    return;
  }
  
  const filtered = allData.filter(item => 
    item.searchString.includes(query)
  );
  
  renderResults(filtered);
  console.log(`🔍 ${filtered.length} résultats pour "${query}"`);
}

// 🚀 Initialisation
grist.ready();
detectAvailableColumns();
loadData();
