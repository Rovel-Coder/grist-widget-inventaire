// 🎯 Configuration des colonnes pour le widget Grist
let allData = [];
let filteredData = [];
let currentMappings = null;
let isConfigured = false;
let searchTerm = '';
let statusColors = {};
let allColumns = {};

// 📋 Initialisation du widget avec configuration des colonnes
grist.ready({
  requiredAccess: 'read table',
  allowSelectBy: true,
  columns: [
    {
      name: "title",
      title: "Titre (Obligatoire)",
      type: "Text",
      optional: false,
      description: "Colonne contenant le titre principal"
    },
    {
      name: "description",
      title: "Description",
      type: "Text",
      optional: true,
      description: "Texte descriptif de l'élément"
    },
    {
      name: "image",
      title: "Image",
      type: "Attachments",
      optional: true,
      description: "Image à afficher dans la carte"
    },
    {
      name: "date",
      title: "Date",
      type: "Date,DateTime",
      optional: true,
      description: "Date associée à l'élément"
    },
    {
      name: "category",
      title: "Catégorie",
      type: "Choice,Text",
      optional: true,
      description: "Catégorie de classification"
    },
    {
      name: "status",
      title: "Statut",
      type: "Choice",
      optional: true,
      description: "Statut actuel avec couleurs"
    },
    {
      name: "author",
      title: "Auteur",
      type: "Text",
      optional: true,
      description: "Auteur ou créateur"
    },
    {
      name: "attachments",
      title: "Pièces jointes",
      type: "Attachments",
      optional: true,
      description: "Fichiers à télécharger"
    },
    {
      name: "additionalFields",
      title: "Champs supplémentaires",
      type: "Any",
      allowMultiple: true,
      optional: true,
      description: "Sélectionnez toutes les colonnes supplémentaires à afficher"
    }
  ]
});

// 📊 Écoute des changements de données avec mappings
grist.onRecords(async function(records, mappings) {
  try {
    console.log('📊 Données reçues:', records);
    console.log('🗺️ Mappings:', mappings);
    
    currentMappings = mappings;
    
    if (!mappings || !mappings.title) {
      isConfigured = false;
      showConfigurationMessage();
      return;
    }
    
    isConfigured = true;
    await fetchStatusColors(mappings);
    
    const tableData = await grist.fetchSelectedTable();
    console.log('📋 Données table complète:', tableData);
    allColumns = tableData;
    
    const mappedData = grist.mapColumnNames(tableData, { mappings: mappings });
    console.log('✅ Données mappées:', mappedData);
    
    if (mappedData && mappedData.id && mappedData.id.length > 0) {
      allData = mappedData;
      
      // Si on a déjà un terme de recherche, l'appliquer
      if (searchTerm) {
        applySearch();
      } else {
        showSearchPrompt();
      }
    } else {
      allData = [];
      showNoData();
    }
  } catch (error) {
    console.error("❌ Erreur lors du traitement des données:", error);
    showError(error.message);
  }
});

// 🎨 Récupérer les couleurs de la colonne Choice (statut)
async function fetchStatusColors(mappings) {
  try {
    if (!mappings.status) {
      return;
    }
    
    const tables = await grist.docApi.fetchTable('_grist_Tables_column');
    const statusColumnName = mappings.status;
    
    const statusColumn = tables.colId.findIndex((colId, idx) => {
      return tables.label && tables.label[idx] === statusColumnName;
    });
    
    if (statusColumn !== -1 && tables.widgetOptions && tables.widgetOptions[statusColumn]) {
      const widgetOptions = tables.widgetOptions[statusColumn];
      if (typeof widgetOptions === 'string') {
        try {
          const options = JSON.parse(widgetOptions);
          if (options.choices) {
            statusColors = {};
            options.choices.forEach(choice => {
              if (typeof choice === 'object' && choice.value) {
                statusColors[choice.value] = {
                  fillColor: choice.fillColor || '#e0e0e0',
                  textColor: choice.textColor || '#000000'
                };
              }
            });
            console.log('🎨 Couleurs de statut récupérées:', statusColors);
          }
        } catch (e) {
          console.log('⚠️ Impossible de parser widgetOptions:', e);
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Impossible de récupérer les couleurs:', error);
  }
}

// 🔍 Barre de recherche
const searchInput = document.getElementById('searchInput');
const searchBar = document.getElementById('searchBar');

searchInput.addEventListener('input', (e) => {
  searchTerm = e.target.value.toLowerCase().trim();
  console.log('🔍 Recherche:', searchTerm);
  
  if (searchTerm.length > 0) {
    applySearch();
  } else {
    showSearchPrompt();
  }
});

// 🎯 Appliquer la recherche
function applySearch() {
  if (!allData || !allData.id || allData.id.length === 0) {
    console.log('⚠️ Pas de données à rechercher');
    return;
  }
  
  if (!searchTerm) {
    showSearchPrompt();
    return;
  }
  
  console.log('🔎 Application de la recherche sur', allData.id.length, 'éléments');
  
  // Filtrer les données
  const filtered = {
    id: [],
    title: [],
    description: [],
    image: [],
    date: [],
    category: [],
    status: [],
    author: [],
    attachments: [],
    additionalFields: []
  };
  
  allData.id.forEach((id, index) => {
    // Recherche dans tous les champs textuels
    const titleText = allData.title?.[index] || '';
    const descText = allData.description?.[index] || '';
    const catText = allData.category?.[index] || '';
    const statusText = allData.status?.[index] || '';
    const authorText = allData.author?.[index] || '';
    
    const searchableText = [titleText, descText, catText, statusText, authorText]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    
    if (searchableText.includes(searchTerm)) {
      filtered.id.push(id);
      if (allData.title) filtered.title.push(allData.title[index]);
      if (allData.description) filtered.description.push(allData.description[index]);
      if (allData.image) filtered.image.push(allData.image[index]);
      if (allData.date) filtered.date.push(allData.date[index]);
      if (allData.category) filtered.category.push(allData.category[index]);
      if (allData.status) filtered.status.push(allData.status[index]);
      if (allData.author) filtered.author.push(allData.author[index]);
      if (allData.attachments) filtered.attachments.push(allData.attachments[index]);
      if (allData.additionalFields) filtered.additionalFields.push(allData.additionalFields[index]);
    }
  });
  
  console.log('✅ Résultats trouvés:', filtered.id.length);
  filteredData = filtered;
  renderWidget(filtered);
  updateSearchStats(filtered.id.length, allData.id.length);
}

// 📊 Mise à jour des statistiques de recherche
function updateSearchStats(shown, total) {
  const statsElement = document.getElementById('searchStats');
  if (shown === total) {
    statsElement.textContent = `✨ ${total} produit${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}`;
  } else {
    statsElement.textContent = `✨ ${shown} produit${shown > 1 ? 's' : ''} trouvé${shown > 1 ? 's' : ''} sur ${total}`;
  }
}

// 💬 Message de recherche initial
function showSearchPrompt() {
  searchBar.classList.remove('hidden');
  const container = document.getElementById('results');
  const statsElement = document.getElementById('searchStats');
  
  if (allData && allData.id) {
    statsElement.textContent = `${allData.id.length} produit${allData.id.length > 1 ? 's' : ''} disponible${allData.id.length > 1 ? 's' : ''}`;
  } else {
    statsElement.textContent = '';
  }
  
  container.innerHTML = `
    <div class="empty-state">
      <div class="search-icon">🔍</div>
      <p>Tapez dans la barre de recherche pour afficher les produits</p>
    </div>
  `;
}

// 🎨 Rendu du widget avec cartes
function renderWidget(data) {
  const container = document.getElementById('results');
  searchBar.classList.remove('hidden');
  
  if (!data || !data.id || data.id.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="search-icon">🔍</div>
        <p>Aucun résultat trouvé pour "${searchTerm}"</p>
        <p class="hint">Essayez avec d'autres mots-clés</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  data.id.forEach((id, index) => {
    const card = createCard(data, index, id);
    container.appendChild(card);
  });
}

// 🎴 Créer une carte individuelle
function createCard(data, index, rowId) {
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('data-row-id', rowId);
  
  // Image
  if (data.image && data.image[index]) {
    const imageUrl = getAttachmentUrl(data.image[index]);
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = data.title?.[index] || 'Image';
      img.className = 'card-image';
      card.appendChild(img);
    }
  }
  
  // Contenu
  const content = document.createElement('div');
  content.className = 'card-content';
  
  // Titre
  if (data.title && data.title[index]) {
    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = data.title[index];
    content.appendChild(title);
  }
  
  // Métadonnées (catégorie, statut, auteur, date)
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  
  if (data.category && data.category[index]) {
    const cat = document.createElement('span');
    cat.className = 'badge badge-category';
    cat.textContent = data.category[index];
    meta.appendChild(cat);
  }
  
  if (data.status && data.status[index]) {
    const status = document.createElement('span');
    status.className = 'badge badge-status';
    status.textContent = data.status[index];
    
    // Appliquer les couleurs personnalisées
    const statusValue = data.status[index];
    if (statusColors[statusValue]) {
      status.style.backgroundColor = statusColors[statusValue].fillColor;
      status.style.color = statusColors[statusValue].textColor;
    }
    
    meta.appendChild(status);
  }
  
  if (data.author && data.author[index]) {
    const author = document.createElement('span');
    author.className = 'badge badge-author';
    author.textContent = `👤 ${data.author[index]}`;
    meta.appendChild(author);
  }
  
  if (data.date && data.date[index]) {
    const date = document.createElement('span');
    date.className = 'badge badge-date';
    date.textContent = formatDate(data.date[index]);
    meta.appendChild(date);
  }
  
  content.appendChild(meta);
  
  // Description
  if (data.description && data.description[index]) {
    const desc = document.createElement('p');
    desc.className = 'card-description';
    desc.textContent = data.description[index];
    content.appendChild(desc);
  }
  
  card.appendChild(content);
  
  // Actions
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  
  const viewBtn = document.createElement('button');
  viewBtn.className = 'btn btn-primary';
  viewBtn.textContent = '👁️ Voir les détails';
  viewBtn.onclick = () => openModal(data, index, rowId);
  actions.appendChild(viewBtn);
  
  card.appendChild(actions);
  
  return card;
}

// 🔗 Obtenir l'URL d'une pièce jointe
function getAttachmentUrl(attachment) {
  if (!attachment || attachment.length === 0) return null;
  
  const firstAttachment = Array.isArray(attachment) ? attachment[0] : attachment;
  
  if (typeof firstAttachment === 'string') {
    try {
      const parsed = JSON.parse(firstAttachment);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return grist.docApi.getBaseUrl() + '/attachments/' + parsed[0];
      }
    } catch (e) {
      return null;
    }
  }
  
  return null;
}

// 📅 Formater une date
function formatDate(timestamp) {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return '';
  }
}

// 🪟 Ouvrir la modale avec détails complets
function openModal(data, index, rowId) {
  const modal = document.getElementById('detailModal');
  const modalContent = document.getElementById('modalContent');
  
  modalContent.innerHTML = '';
  
  // Image principale
  if (data.image && data.image[index]) {
    const imageUrl = getAttachmentUrl(data.image[index]);
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = data.title?.[index] || 'Image';
      img.className = 'modal-image';
      modalContent.appendChild(img);
    }
  }
  
  // Titre
  if (data.title && data.title[index]) {
    const title = document.createElement('h2');
    title.textContent = data.title[index];
    modalContent.appendChild(title);
  }
  
  // Métadonnées
  const metaSection = document.createElement('div');
  metaSection.className = 'modal-meta';
  
  if (data.category && data.category[index]) {
    const cat = document.createElement('span');
    cat.className = 'badge badge-category';
    cat.textContent = data.category[index];
    metaSection.appendChild(cat);
  }
  
  if (data.status && data.status[index]) {
    const status = document.createElement('span');
    status.className = 'badge badge-status';
    status.textContent = data.status[index];
    
    const statusValue = data.status[index];
    if (statusColors[statusValue]) {
      status.style.backgroundColor = statusColors[statusValue].fillColor;
      status.style.color = statusColors[statusValue].textColor;
    }
    
    metaSection.appendChild(status);
  }
  
  if (data.author && data.author[index]) {
    const author = document.createElement('p');
    author.innerHTML = `<strong>👤 Auteur:</strong> ${data.author[index]}`;
    metaSection.appendChild(author);
  }
  
  if (data.date && data.date[index]) {
    const date = document.createElement('p');
    date.innerHTML = `<strong>📅 Date:</strong> ${formatDate(data.date[index])}`;
    metaSection.appendChild(date);
  }
  
  modalContent.appendChild(metaSection);
  
  // Description
  if (data.description && data.description[index]) {
    const descSection = document.createElement('div');
    descSection.className = 'modal-section';
    const descTitle = document.createElement('h3');
    descTitle.textContent = 'Description';
    descSection.appendChild(descTitle);
    const desc = document.createElement('p');
    desc.textContent = data.description[index];
    descSection.appendChild(desc);
    modalContent.appendChild(descSection);
  }
  
  // Pièces jointes
  if (data.attachments && data.attachments[index]) {
    const attachmentsSection = document.createElement('div');
    attachmentsSection.className = 'modal-section';
    const attachTitle = document.createElement('h3');
    attachTitle.textContent = '📎 Pièces jointes';
    attachmentsSection.appendChild(attachTitle);
    
    const attachmentsList = getAttachmentsList(data.attachments[index]);
    if (attachmentsList.length > 0) {
      const list = document.createElement('ul');
      list.className = 'attachments-list';
      attachmentsList.forEach(att => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = att.url;
        link.textContent = att.name;
        link.download = att.name;
        link.target = '_blank';
        li.appendChild(link);
        list.appendChild(li);
      });
      attachmentsSection.appendChild(list);
    }
    
    modalContent.appendChild(attachmentsSection);
  }
  
  // Champs supplémentaires
  if (data.additionalFields && data.additionalFields[index]) {
    const additionalSection = document.createElement('div');
    additionalSection.className = 'modal-section';
    const addTitle = document.createElement('h3');
    addTitle.textContent = 'Informations supplémentaires';
    additionalSection.appendChild(addTitle);
    
    const additionalFields = data.additionalFields[index];
    if (Array.isArray(additionalFields)) {
      additionalFields.forEach(fieldName => {
        if (allColumns[fieldName] && allColumns[fieldName][index]) {
          const p = document.createElement('p');
          p.innerHTML = `<strong>${fieldName}:</strong> ${formatFieldValue(allColumns[fieldName][index])}`;
          additionalSection.appendChild(p);
        }
      });
    }
    
    modalContent.appendChild(additionalSection);
  }
  
  modal.classList.add('show');
}

// 📎 Obtenir la liste des pièces jointes
function getAttachmentsList(attachment) {
  if (!attachment) return [];
  
  try {
    let parsed;
    if (typeof attachment === 'string') {
      parsed = JSON.parse(attachment);
    } else {
      parsed = attachment;
    }
    
    if (Array.isArray(parsed)) {
      return parsed.map(attId => ({
        name: `Fichier ${attId}`,
        url: grist.docApi.getBaseUrl() + '/attachments/' + attId
      }));
    }
  } catch (e) {
    console.log('⚠️ Erreur parsing attachments:', e);
  }
  
  return [];
}

// 🔧 Formater une valeur de champ
function formatFieldValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && value > 1000000000 && value < 2000000000) {
    return formatDate(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value.toString();
}

// ❌ Fermer la modale
const modal = document.getElementById('detailModal');
const closeBtn = document.querySelector('.close-modal');

closeBtn.onclick = () => {
  modal.classList.remove('show');
};

window.onclick = (event) => {
  if (event.target === modal) {
    modal.classList.remove('show');
  }
};

// 📭 Pas de données
function showNoData() {
  searchBar.classList.add('hidden');
  const container = document.getElementById('results');
  container.innerHTML = `
    <div class="empty-state">
      <div class="search-icon">📭</div>
      <h2>Aucune donnée</h2>
      <p>Aucune donnée n'est disponible dans la table sélectionnée</p>
    </div>
  `;
}

// ⚙️ Message de configuration
function showConfigurationMessage() {
  searchBar.classList.add('hidden');
  const container = document.getElementById('results');
  container.innerHTML = `
    <div class="empty-state">
      <div class="search-icon">⚙️</div>
      <h2>Configuration requise</h2>
      <p>Veuillez configurer les colonnes dans les options du widget</p>
      <p class="hint">Cliquez sur l'icône ⚙️ en haut à droite</p>
    </div>
  `;
}

// ⚠️ Message d'erreur
function showError(message) {
  searchBar.classList.add('hidden');
  const container = document.getElementById('results');
  container.innerHTML = `
    <div class="empty-state error">
      <div class="search-icon">⚠️</div>
      <h2>Erreur</h2>
      <p>${message}</p>
    </div>
  `;
}

console.log('✅ Widget Grist professionnel avec modal chargé et prêt');
