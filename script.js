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
      type: "Choice"
    },
    {
      name: "categorieColonne",
      title: "Catégorie",
      description: "Colonne contenant la catégorie du fichier",
      optional: true,
      type: "Ref"
    }
  ]
});

let allData = []; 
let widgetConfig = {
  nomColonne: null,
  descriptionColonne: null,
  auteurColonne: null,
  validationColonne: null,
  categorieColonne: null
};

// 🎨 Écouteur pour les changements de configuration
grist.onOptions(function(options, interaction) {
  console.log("⚙️ Options reçues:", options);
  console.log("📋 Mappings reçus:", interaction);
  
  // Les mappings contiennent les noms de colonnes choisis par l'utilisateur
  const mappings = interaction || {};
  
  widgetConfig = {
    nomColonne: mappings.nomColonne || null,
    descriptionColonne: mappings.descriptionColonne || null,
    auteurColonne: mappings.auteurColonne || null,
    validationColonne: mappings.validationColonne || null,
    categorieColonne: mappings.categorieColonne || null
  };
  
  console.log("✅ Config appliquée:", widgetConfig);
  
  // Recharger les données avec la nouvelle config
  loadData();
});

function parseGristData(data) {
  if (!data) return [];
  console.log("📦 Raw data reçue:", data);
  if (!Array.isArray(data) && typeof data === 'object') {
    const ids = data.id || []; 
    const keys = Object.keys(data).filter(k => k !== 'id');
    console.log("🔑 Colonnes détectées:", keys);
    console.log("🎯 Config actuelle:", widgetConfig);
    
    return ids.map((id, index) => {
      const f = {}; 
      keys.forEach(k => f[k] = data[k][index]);
      
      // Extraire la valeur de catégorie (Ref ou texte direct)
      let categorieText = "";
      if (widgetConfig.categorieColonne) {
        const categorieValue = f[widgetConfig.categorieColonne];
        if (categorieValue && typeof categorieValue === 'object' && categorieValue.length > 0) {
          categorieText = categorieValue[0]?.toString() || "";
        } else {
          categorieText = (categorieValue || "").toString();
        }
      }
      
      // Utiliser la configuration pour la recherche
      const recherche = [
        widgetConfig.nomColonne ? (f[widgetConfig.nomColonne] || "").toString() : "",
        widgetConfig.auteurColonne ? (f[widgetConfig.auteurColonne] || "").toString() : "",
        categorieText
      ].join(' ').toLowerCase();
      
      return { id, fields: f, searchString: recherche };
    });
  }
  return [];
}

async function loadData() {
  const container = document.getElementById('results');
  
  // Vérifier qu'au moins la colonne nom est configurée
  if (!widgetConfig.nomColonne) {
    container.innerHTML = `<div class="status-msg">⚙️ Configurez au moins la colonne "Nom du fichier" dans le panneau de droite</div>`;
    return;
  }
  
  container.innerHTML = `<div class="status-msg">🔄 Chargement des données...</div>`;
  try {
    grist.setSelectedRows([]);
    const rawData = await grist.docApi.fetchTable();
    allData = parseGristData(rawData);
    console.log(`✅ ${allData.length} pièces chargées`);
    if (allData.length) console.log("📋 Premier élément:", allData[0]);
    container.innerHTML = allData.length ? 
      `<div class="status-msg">✅ ${allData.length} pièces prêtes ! Tapez % ou recherchez</div>` :
      `<div class="status-msg">⚠️ Table vide ou inaccessible</div>`;
  } catch(e) {
    console.error("💥 Erreur:", e);
    container.innerHTML = `<div class="status-msg" style="color:#ef4444;background:rgba(239,68,68,0.2);border-color:rgba(239,68,68,0.5);">
      ❌ Erreur: ${e.message}<br><small>F12 Console → 🔑 Vérifiez colonnes mappées</small></div>`;
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
      const nom = widgetConfig.nomColonne ? (f[widgetConfig.nomColonne] || "Sans nom") : "Sans nom";
      const desc = widgetConfig.descriptionColonne ? (f[widgetConfig.descriptionColonne] || "").toString().substring(0, 140) : "";
      const auteur = widgetConfig.auteurColonne ? (f[widgetConfig.auteurColonne] || "Anonyme") : "Anonyme";
      const valideRaw = widgetConfig.validationColonne ? (f[widgetConfig.validationColonne] || "") : "";
      
      // Gérer le Choice "Validé Institution" / "Non Validé Institution"
      const valide = valideRaw.toString().includes("Validé");
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
  
  // Ne pas charger automatiquement, attendre la config
  const container = document.getElementById('results');
  container.innerHTML = `<div class="status-msg">⚙️ Configurez les colonnes dans le panneau de droite →</div>`;
});
