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

        const mappedData = grist.mapColumnNames(tableData, {
            mappings: mappings
        });

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
        <div class="search-prompt">
            <div class="search-prompt-icon">🔍</div>
            <h2>Commencez votre recherche</h2>
            <p>Tapez dans la barre de recherche pour afficher les produits</p>
        </div>
    `;
}

// 🎨 Fonction de rendu du widget
function renderWidget(data) {
    const container = document.getElementById('results');
    searchBar.classList.remove('hidden');

    if (!data || !data.id || data.id.length === 0) {
        container.innerHTML = '<div class="no-data">😔 Aucun produit ne correspond à votre recherche</div>';
        return;
    }

    container.innerHTML = '';

    data.id.forEach((id, index) => {
        const card = createCard(data, index, id);
        container.appendChild(card);
    });
}

// 🃏 Création d'une carte individuelle
function createCard(data, index, rowId) {
    const card = document.createElement('div');
    card.className = 'card';

    const title = data.title?.[index] || 'Sans titre';
    const description = data.description?.[index] || '';
    const imageData = data.image?.[index];
    let imageUrl = null;

    if (imageData && Array.isArray(imageData) && imageData.length > 0) {
        imageUrl = typeof imageData[0] === 'string' ? imageData[0] : imageData[0]?.url;
    }

    const statusValue = data.status?.[index];

    let cardHTML = '';

    cardHTML += '<div class="card-image-container">';
    if (imageUrl) {
        cardHTML += `<img src="${imageUrl}" alt="${escapeHtml(title)}" class="card-image" onerror="this.parentElement.innerHTML='<div class=\'card-no-image\'>📦</div>'">`;
    } else {
        cardHTML += '<div class="card-no-image">📦</div>';
    }
    cardHTML += '</div>';

    cardHTML += '<div class="card-content">';
    cardHTML += '<div class="card-header">';
    cardHTML += `<h3 class="card-title">${escapeHtml(title)}</h3>`;
    cardHTML += '</div>';

    if (statusValue) {
        const colors = getStatusColors(statusValue);
        cardHTML += `
            <div class="status-badge" style="background-color: ${colors.fillColor}; color: ${colors.textColor};">
                ${escapeHtml(statusValue)}
            </div>
        `;
    }

    if (description) {
        cardHTML += `<div class="card-description">${escapeHtml(description)}</div>`;
    }

    const hasMetadata = data.date?.[index] || data.category?.[index] || data.author?.[index];

    if (hasMetadata) {
        cardHTML += '<div class="card-metadata">';

        if (data.date?.[index]) {
            cardHTML += `
                <div class="metadata-row">
                    <div class="metadata-icon" style="background: #e3f2fd; color: #1976d2;">📅</div>
                    <div class="metadata-content">
                        <div class="metadata-label">Date</div>
                        <div class="metadata-value">${formatDate(data.date[index])}</div>
                    </div>
                </div>
            `;
        }

        if (data.category?.[index]) {
            cardHTML += `
                <div class="metadata-row">
                    <div class="metadata-icon" style="background: #f3e5f5; color: #7b1fa2;">🏷️</div>
                    <div class="metadata-content">
                        <div class="metadata-label">Catégorie</div>
                        <div class="metadata-value">${escapeHtml(String(data.category[index]))}</div>
                    </div>
                </div>
            `;
        }

        if (data.author?.[index]) {
            cardHTML += `
                <div class="metadata-row">
                    <div class="metadata-icon" style="background: #e8f5e9; color: #388e3c;">👤</div>
                    <div class="metadata-content">
                        <div class="metadata-label">Auteur</div>
                        <div class="metadata-value">${escapeHtml(String(data.author[index]))}</div>
                    </div>
                </div>
            `;
        }

        cardHTML += '</div>';
    }

    cardHTML += '</div>';
    card.innerHTML = cardHTML;

    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
        openModal(data, index, rowId);
    });

    return card;
}

// 🔓 Ouvrir le modal avec les détails
function openModal(data, index, rowId) {
    const modal = document.getElementById('modalOverlay');
    const modalContent = document.getElementById('modalContent');

    const title = data.title?.[index] || 'Sans titre';
    const description = data.description?.[index] || '';
    const statusValue = data.status?.[index];
    const imageData = data.image?.[index];
    const attachmentsData = data.attachments?.[index];

    let modalHTML = '';

    modalHTML += '<div class="modal-header">';
    modalHTML += `<h2>${escapeHtml(title)}</h2>`;
    modalHTML += '<button class="modal-close" onclick="closeModal()">✕</button>';
    modalHTML += '</div>';

    modalHTML += '<div class="modal-body">';

    if (statusValue) {
        const colors = getStatusColors(statusValue);
        modalHTML += `
            <div class="modal-status-badge" style="background-color: ${colors.fillColor}; color: ${colors.textColor};">
                ${escapeHtml(statusValue)}
            </div>
        `;
    }

    if (imageData && Array.isArray(imageData) && imageData.length > 0) {
        modalHTML += '<div class="modal-section">';
        modalHTML += '<div class="modal-section-title">📸 Images</div>';
        modalHTML += '<div class="modal-image-gallery">';

        imageData.forEach(img => {
            const imgUrl = typeof img === 'string' ? img : img?.url;
            if (imgUrl) {
                modalHTML += `<img src="${imgUrl}" alt="${escapeHtml(title)}" class="modal-image" onclick="window.open('${imgUrl}', '_blank')">`;
            }
        });

        modalHTML += '</div>';
        modalHTML += '</div>';
    }

    if (description) {
        modalHTML += '<div class="modal-section">';
        modalHTML += '<div class="modal-section-title">📝 Description</div>';
        modalHTML += `<div class="modal-description">${escapeHtml(description)}</div>`;
        modalHTML += '</div>';
    }

    const hasInfo = data.date?.[index] || data.category?.[index] || data.author?.[index];
    if (hasInfo) {
        modalHTML += '<div class="modal-section">';
        modalHTML += '<div class="modal-section-title">ℹ️ Informations</div>';
        modalHTML += '<div class="modal-info-grid">';

        if (data.date?.[index]) {
            modalHTML += `
                <div class="modal-info-item">
                    <div class="modal-info-label">📅 Date</div>
                    <div class="modal-info-value">${formatDate(data.date[index])}</div>
                </div>
            `;
        }

        if (data.category?.[index]) {
            modalHTML += `
                <div class="modal-info-item">
                    <div class="modal-info-label">🏷️ Catégorie</div>
                    <div class="modal-info-value">${escapeHtml(String(data.category[index]))}</div>
                </div>
            `;
        }

        if (data.author?.[index]) {
            modalHTML += `
                <div class="modal-info-item">
                    <div class="modal-info-label">👤 Auteur</div>
                    <div class="modal-info-value">${escapeHtml(String(data.author[index]))}</div>
                </div>
            `;
        }

        modalHTML += '</div>';
        modalHTML += '</div>';
    }

    if (attachmentsData && Array.isArray(attachmentsData) && attachmentsData.length > 0) {
        modalHTML += '<div class="modal-section">';
        modalHTML += '<div class="modal-section-title">📎 Pièces jointes</div>';
        modalHTML += '<div class="modal-attachments">';

        attachmentsData.forEach(attachment => {
            const attUrl = typeof attachment === 'string' ? attachment : attachment?.url;
            const attName = attachment?.filename || attachment?.name || 'Fichier';
            const attSize = attachment?.size ? formatFileSize(attachment.size) : '';

            if (attUrl) {
                modalHTML += `
                    <a href="${attUrl}" target="_blank" class="attachment-item">
                        <div class="attachment-icon">📄</div>
                        <div class="attachment-info">
                            <div class="attachment-name">${escapeHtml(attName)}</div>
                            ${attSize ? `<div class="attachment-size">${attSize}</div>` : ''}
                        </div>
                        <span class="attachment-download">⬇️ Télécharger</span>
                    </a>
                `;
            }
        });

        modalHTML += '</div>';
        modalHTML += '</div>';
    }

    if (data.additionalFields) {
        const additionalData = data.additionalFields[index];

        if (additionalData) {
            const fieldsToShow = [];

            if (Array.isArray(additionalData)) {
                additionalData.forEach((value) => {
                    if (value !== null && value !== undefined && value !== '') {
                        fieldsToShow.push(escapeHtml(String(value)));
                    }
                });
            } else {
                if (additionalData !== null && additionalData !== undefined && additionalData !== '') {
                    fieldsToShow.push(escapeHtml(String(additionalData)));
                }
            }

            if (fieldsToShow.length > 0) {
                modalHTML += '<div class="modal-section">';
                modalHTML += '<div class="modal-section-title">➕ Informations complémentaires</div>';
                modalHTML += '<div class="modal-additional-fields">';
                fieldsToShow.forEach(field => {
                    modalHTML += `<div class="modal-field-item">${field}</div>`;
                });
                modalHTML += '</div>';
                modalHTML += '</div>';
            }
        }
    }

    modalHTML += '</div>';

    modalContent.innerHTML = modalHTML;
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);

    grist.setCursorPos({rowId: rowId}).catch(err => console.error('Erreur setCursorPos:', err));
}

// 🔒 Fermer le modal
function closeModal() {
    const modal = document.getElementById('modalOverlay');
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') {
        closeModal();
    }
});

// 🎨 Obtenir les couleurs du statut
function getStatusColors(statusValue) {
    if (statusColors[statusValue]) {
        return statusColors[statusValue];
    }

    const defaultColors = {
        'validé': { fillColor: '#d4edda', textColor: '#155724' },
        'valide': { fillColor: '#d4edda', textColor: '#155724' },
        'validée': { fillColor: '#d4edda', textColor: '#155724' },
        'en cours': { fillColor: '#fff3cd', textColor: '#856404' },
        'en attente': { fillColor: '#fff3cd', textColor: '#856404' },
        'attente': { fillColor: '#fff3cd', textColor: '#856404' },
        'non validé': { fillColor: '#f8d7da', textColor: '#721c24' },
        'refusé': { fillColor: '#f8d7da', textColor: '#721c24' },
        'brouillon': { fillColor: '#e2e3e5', textColor: '#383d41' },
        'archivé': { fillColor: '#e2e3e5', textColor: '#383d41' }
    };

    const lowerStatus = statusValue.toLowerCase();

    for (const [key, colors] of Object.entries(defaultColors)) {
        if (lowerStatus.includes(key)) {
            return colors;
        }
    }

    return { fillColor: '#e0e0e0', textColor: '#333333' };
}

function showConfigurationMessage() {
    searchBar.classList.add('hidden');
    const container = document.getElementById('results');
    container.innerHTML = `
        <div class="config-message">
            <h2>⚙️ Configuration requise</h2>
            <p>Veuillez configurer au moins la colonne <strong>"Titre"</strong> dans le panneau de configuration à droite.</p>
            <p style="margin-top: 1rem;">Vous pouvez également configurer les colonnes optionnelles pour enrichir l'affichage.</p>
        </div>
    `;
}

function showNoData() {
    searchBar.classList.add('hidden');
    const container = document.getElementById('results');
    container.innerHTML = '<div class="no-data">📭 Aucune donnée dans la table</div>';
}

function showError(message) {
    searchBar.classList.add('hidden');
    const container = document.getElementById('results');
    container.innerHTML = `
        <div class="error-message">
            <strong>Erreur:</strong> ${escapeHtml(message)}
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateValue) {
    if (!dateValue) return '';

    try {
        if (typeof dateValue === 'number') {
            const date = new Date(dateValue * 1000);
            return date.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        if (dateValue instanceof Date) {
            return dateValue.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        return String(dateValue);
    } catch (e) {
        return String(dateValue);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

console.log('✅ Widget Grist professionnel avec modal chargé et prêt');