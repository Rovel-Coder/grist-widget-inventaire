// 🎯 Déclaration des colonnes configurables
grist.ready({ 
  requiredAccess: 'full', 
  allowSelectBy: true,
  columns: [
    {
      name: "nomColonne",
      title: "Nom du fichier",
      description: "Colonne contenant le nom du fichier",
      optional: false,
      type: "Text"
    },
    {
      name: "descriptionColonne",
      title: "Description",
      description: "Colonne contenant la description du fichier",
      optional: true,
      type: "Text"
    },
    {
      name: "auteurColonne",
      title: "Auteur",
      description: "Colonne contenant l'auteur du fichier",
      optional: true,
      type: "Text"
    },
    {
      name: "validationColonne",
      title: "Validation",
      description: "Colonne indiquant si la pièce est validée",
      optional: true,
      type: "Bool"
    },
    {
      name: "categorieColonne",
      title: "Catégorie",
      description: "Colonne contenant la catégorie du fichier",
      optional: true,
      type: "Choice"
    }
  ]
});

let allData = []; 
let widgetConfig = {
  nomColonne: "Nom du fichier",
  descriptionColonne: "Description du fichier",
  auteurColonne: "Auteur",
  validationColonne: "Pièce Validée ?",
  categorieColonne: "Categorie",
  targetTable: "Inventaire"
};

// 🎨 Écouteur pour les changements de configuration
grist.onOptions(function(options, interaction) {
  console.log("⚙️ Configuration reçue:", options);
  console.log("📋 Mappings:", interaction.mappings);
  
  if (interaction.mappings) {
    // Appliquer les mappings de colonnes
    widgetConfig = {
      nomColonne: interaction.mappings.nomColonne || widgetConfig.nomColonne,
      descriptionColonne: interaction.mappings.descriptionColonne || widgetConfig.descriptionColonne,
      auteurColonne: interaction.mappings.auteurColonne || widgetConfig.auteurColonne,
      validationColonne: interaction.mappings.validationColonne || widgetConfig.validationColonne,
      categorieColonne: interaction.mappings.categorieColonne || widgetConfig.categorieColonne,
      targetTable: options?.targetTable || widgetConfig.targetTable
    };
    console.log("✅ Config appliquée:", widgetConfig);
    
    // Recharger les données avec la nouvelle config
    loadData();
  }
});

function parseGristData(data) {
  if (!data) return [];
  console.log("📦 Raw data reçue:", data);
  if (!Array.isArray(data) && typeof data === 'object') {
    const ids = data.id || []; 
    const keys = Object.keys(data).filter(k => k !== 'id');
    console.log("🔑 Colonnes détectées:", keys);
    return ids.map((id, index) => {
      const f = {}; 
      keys.forEach(k => f[k] = data[k][index]);
      
      // Utiliser la configuration pour la recherche
      const recherche = [
        (f[widgetConfig.nomColonne] || "").toString(),
        (f[widgetConfig.auteurColonne] || "").toString(),
        (f[widgetConfig.categorieColonne] || "").toString()
      ].join(' ').toLowerCase();
      
      return { id, fields: f, searchString: recherche };
    });
  }
  return [];
}

async function loadData() {
  const container = document.getElementById('results');
  container.innerHTML = `<div class="status-msg">🔄 Chargement table "${widgetConfig.targetTable}"...</div>`;
  try {
    grist.setSelectedRows([]);
    const rawData = await grist.docApi.fetchTable(widgetConfig.targetTable);
    allData = parseGristData(rawData);
    console.log(`✅ ${allData.length} pièces chargées`);
    if (allData.length) console.log("📋 Premier élément:", allData[0]);
    container.innerHTML = allData.length ? 
      `<div class="status-msg">✅ ${allData.length} pièces prêtes ! Tapez % ou recherchez</div>` :
      `<div class="status-msg">⚠️ Table "${widgetConfig.targetTable}" vide ou inaccessible</div>`;
  } catch(e) {
    console.error("💥 Erreur:", e);
    container.innerHTML = `<div class="status-msg" style="color:#ef4444;background:rgba(239,68,68,0.2);border-color:rgba(239,68,68,0.5);">
      ❌ Erreur: ${e.message}<br><small>F12 Console → 🔑 Vérifiez colonnes/nom table</small></div>`;
  }
}

function renderResults(list, query = "") {
  const container = document.getElementById('results');
  const isWildcard = query === "%"; 
  const count = list.length;

  if (!isWildcard && query.length < 3) {
    container.innerHTML = `<div class="status-msg">⌨️ Tapez ≥3 caractères (nom · auteur · catégorie)…</div>`;
    return;
  }
  if (count === 0) {
    container.innerHTML = `<div class="status-msg">❌ Aucun résultat pour "${query}"</div>`;
    return;
  }

  container.innerHTML = `
    <div class="results-count">📊 ${count} pièce${count>1?'s':''} trouvée${count>1?'s':''}</div>
    ${list.slice(0, 50).map(item => {
      const f = item.fields;
      
      // Utiliser la configuration pour extraire les valeurs
      const nom = f[widgetConfig.nomColonne] || "Sans nom";
      const desc = (f[widgetConfig.descriptionColonne] || "").toString().substring(0, 140);
      const auteur = f[widgetConfig.auteurColonne] || "Anonyme";
      const valide = f[widgetConfig.validationColonne] || false;
      
      const statusClass = valide ? 'valid' : 'draft';
      const statusText = valide ? '✓ Validée' : '⚠ Brouillon';

      return `
        <div class="row-item modern" onclick="selectAndFilter(${item.id})" title="${desc}\n\n👤 ${auteur}">
          <div class="author-badge">Pièce ${auteur}</div>
          <span class="status-badge ${statusClass}">${statusText}</span>
          <div class="content-right">
            <div class="piece-title">${nom}</div>
            <div class="piece-desc">${desc}${desc.length === 140 ? '…' : ''}</div>
          </div>
        </div>`;
    }).join('')}`;

  container.style.minHeight = list.length ? 'auto' : '500px';
}

window.selectAndFilter = rowId => {
  console.log(`🎯 Sélection ligne ${rowId}`);
  grist.setCursorPos({rowId});
  grist.setSelectedRows([rowId]);
};

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    if (q === "%") renderResults(allData, q);
    else if (q.length >= 3) renderResults(allData.filter(i => i.searchString.includes(q)), q);
    else { renderResults([], q); grist.setSelectedRows([]); }
  });
  loadData();
});
