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
      description: "Colonnes supplémentaires à afficher dans les cartes (maintenez Ctrl/Cmd pour sélection multiple)",
      optional: true,
      allowMultiple: true
    },
    {
      name: "searchColumns",
      title: "Colonnes de recherche",
      description: "Colonnes utilisées pour la recherche (maintenez Ctrl/Cmd pour sélection multiple)",
      optional: true,
      allowMultiple: true
    }
  ],
  // ✅ CORRECTION : Utilisation de onRecords pour gérer les mises à jour sans erreur
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

// 🎨 Écouteur de configuration - L'utilisateur choisit les colonnes
grist.onOptions(function(options, interaction) {
  console.log("⚙️ Options reçues:", options);
  console.log("📋 Mappings reçus:", interaction);

  // Récupérer les colonnes sélectionnées par l'utilisateur
  const mappings = interaction || {};

  widgetConfig.titleColumn = mappings.titleColumn || null;
  widgetConfig.imageColumn = mappings.imageColumn || null;

  // Gestion des colonnes multiples
  widgetConfig.displayColumns = mappings.displayColumns || [];
  widgetConfig.searchColumns = mappings.searchColumns || [];

  // Si displayColumns ou searchColumns sont des strings, les convertir en arrays
  if (typeof widgetConfig.displayColumns === 'string') {
    widgetConfig.displayColumns = [widgetConfig.displayColumns];
  }
  if (typeof widgetConfig.searchColumns === 'string') {
    widgetConfig.searchColumns = [widgetConfig.searchColumns];
  }

  console.log("✅ Config appliquée:", widgetConfig);

  // Recharger les données avec la nouvelle configuration
  loadData();
});

// 📊 Parsing des données Grist
function parseGristData(data) {
  if (!data) return [];

  console.log("📦 Raw data reçue:", data);

  if (!Array.isArray(data) && typeof data === 'object') {
    const ids = data.id || [];
    const keys = Object.keys(data).filter(k => k !== 'id');

    console.log("🔑 Colonnes disponibles:", keys);
    console.log("🎯 Config actuelle:", widgetConfig);

    return ids.map((id, index) => {
      const record = {};

      // Extraire toutes les valeurs des colonnes
      keys.forEach(key => {
        record[key] = data[key][index];
      });

      // Construire la chaîne de recherche basée sur les colonnes choisies
      let searchParts = [];

      if (widgetConfig.searchColumns && widgetConfig.searchColumns.length > 0) {
        // Utiliser les colonnes de recherche configurées
        widgetConfig.searchColumns.forEach(col => {
          const value = formatValueForSearch(record[col]);
          if (value) searchParts.push(value);
        });
      } else {
        // Fallback : utiliser toutes les colonnes textuelles
        keys.forEach(key => {
          const value = formatValueForSearch(record[key]);
          if (value) searchParts.push(value);
        });
      }

      const searchString = searchParts.join(' ').toLowerCase();

      return {
        id,
        fields: record,
        searchString
      };
    });
  }

  return [];
}

// 🎨 Formattage des valeurs pour la recherche
function formatValueForSearch(value) {
  if (value === null || value === undefined) return '';

  // Gestion des références (Ref)
  if (Array.isArray(value) && value.length > 0) {
    if (typeof value[0] === 'object' && value[0] !== null) {
      // RefList ou Attachments
      return value.map(v => v.toString()).join(' ');
    }
    return value[0].toString();
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).join(' ');
  }

  return value.toString();
}

// 🎨 Formattage des valeurs pour l'affichage
function formatValueForDisplay(value, columnId) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Gestion des références (Ref) - Afficher la première valeur
  if (Array.isArray(value) && value.length > 0) {
    // Si c'est un attachment, ne pas l'afficher ici (géré séparément)
    if (typeof value[0] === 'object' && value[0].name) {
      return null;
    }
    return value[0].toString();
  }

  // Booléens
  if (typeof value === 'boolean') {
    return value ? '✓ Oui' : '✗ Non';
  }

  // Nombres
  if (typeof value === 'number') {
    return value.toLocaleString('fr-FR');
  }

  return value.toString();
}

// 🚀 Chargement des données
async function loadData() {
  const container = document.getElementById('results');

  // Vérifier qu'au moins la colonne titre est configurée
  if (!widgetConfig.titleColumn) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; background: rgba(255,255,255,0.9); border-radius: 12px;">
        <div style="font-size: 48px; margin-bottom: 20px;">⚙️</div>
        <h3 style="margin-bottom: 10px; color: #2c3e50;">Configuration requise</h3>
        <p style="color: #7f8c8d;">
          Veuillez configurer le widget en sélectionnant au moins la <strong>colonne titre</strong> 
          dans les options du widget (⚙️ icône en haut à droite).
        </p>
      </div>
    `;
    return;
  }

  try {
    const data = await grist.fetchSelectedTable();
    allData = parseGristData(data);

    console.log(`📊 ${allData.length} enregistrements chargés`);
    renderResults(allData);

  } catch (err) {
    console.error("❌ Erreur chargement:", err);
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; background: rgba(231, 76, 60, 0.1); border-radius: 12px; color: #e74c3c;">
        <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
        <strong>Erreur de chargement</strong><br>
        ${err.message}
      </div>
    `;
  }
}

// 🎨 Rendu des cartes
function renderResults(data) {
  const container = document.getElementById('results');

  if (data.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; opacity: 0.6; grid-column: 1/-1;">
        <div style="font-size: 64px; margin-bottom: 10px;">📭</div>
        <div style="font-size: 18px;">Aucun enregistrement trouvé</div>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(item => {
    // Titre
    const title = formatValueForDisplay(item.fields[widgetConfig.titleColumn], widgetConfig.titleColumn) || 'Sans titre';

    // Image
    const imageUrl = getImageUrl(item.fields[widgetConfig.imageColumn]);

    // Obtenir le label de colonne depuis Grist (ou utiliser l'id)
    const getColumnLabel = (colId) => {
      // On pourrait améliorer ça en récupérant les vrais labels depuis l'API Grist
      return colId.replace(/_/g, ' ');
    };

    // Construire les champs à afficher
    let displayFields = '';
    if (widgetConfig.displayColumns && widgetConfig.displayColumns.length > 0) {
      displayFields = widgetConfig.displayColumns
        .filter(col => col !== widgetConfig.titleColumn) // Éviter doublon titre
        .map(col => {
          const value = formatValueForDisplay(item.fields[col], col);
          if (!value) return null;

          return `
            <div class="field-row">
              <span class="field-label">${escapeHtml(getColumnLabel(col))}:</span>
              <span class="field-value">${escapeHtml(value)}</span>
            </div>
          `;
        })
        .filter(Boolean)
        .join('');
    }

    return `
      <div class="card" onclick="selectRow(${item.id})">
        ${imageUrl ? `<div class="card-image"><img src="${imageUrl}" alt="${escapeHtml(title)}" onerror="this.parentElement.style.display='none'"></div>` : ''}
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
  if (firstAttachment && typeof firstAttachment === 'object' && firstAttachment.url) {
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
    document.getElementById('results-count').textContent = `${allData.length} résultat${allData.length > 1 ? 's' : ''}`;
    return;
  }

  const filtered = allData.filter(item =>
    item.searchString.includes(query)
  );

  renderResults(filtered);
  document.getElementById('results-count').textContent = `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`;
  console.log(`🔍 ${filtered.length} résultats pour "${query}"`);
}

// Initialisation au chargement
// Note: onRecords dans grist.ready gère désormais les mises à jour,
// mais nous appelons loadData() une première fois pour l'initialisation immédiate.
loadData();
