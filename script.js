// 🎯 Configuration des colonnes pour le widget Grist
let allData = [];
let filteredData = [];
let currentMappings = null;
let isConfigured = false;
let searchTerm = '';

// 📋 Initialisation du widget avec configuration des colonnes
grist.ready({
    requiredAccess: 'read table',
    allowSelectBy: true,
    columns: [
        // Colonnes principales
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
            type: "Choice,Text",
            optional: true,
            description: "Statut actuel"
        },
        {
            name: "author",
            title: "Auteur",
            type: "Text",
            optional: true,
            description: "Auteur ou créateur"
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

        // Vérifier si la colonne obligatoire est configurée
        if (!mappings || !mappings.title) {
            isConfigured = false;
            showConfigurationMessage();
            return;
        }

        isConfigured = true;

        // Récupérer les données de la table complète
        const tableData = await grist.fetchSelectedTable();
        console.log('📋 Données table complète:', tableData);

        // Mapper les colonnes
        const mappedData = grist.mapColumnNames(tableData, {
            mappings: mappings
        });

        console.log('✅ Données mappées:', mappedData);

        if (mappedData && mappedData.id && mappedData.id.length > 0) {
            allData = mappedData;
            applySearch();
        } else {
            allData = [];
            showNoData();
        }

    } catch (error) {
        console.error("❌ Erreur lors du traitement des données:", error);
        showError(error.message);
    }
});

// 🔍 Barre de recherche
const searchInput = document.getElementById('searchInput');
const searchBar = document.getElementById('searchBar');

searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    applySearch();
});

// 🎯 Appliquer la recherche
function applySearch() {
    if (!allData || !allData.id) {
        return;
    }

    if (!searchTerm) {
        filteredData = allData;
        renderWidget(allData);
        updateSearchStats(allData.id.length, allData.id.length);
        return;
    }

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
        additionalFields: []
    };

    allData.id.forEach((id, index) => {
        // Recherche dans tous les champs textuels
        const searchableText = [
            allData.title?.[index],
            allData.description?.[index],
            allData.category?.[index],
            allData.status?.[index],
            allData.author?.[index]
        ].filter(Boolean).join(' ').toLowerCase();

        if (searchableText.includes(searchTerm)) {
            filtered.id.push(id);
            if (allData.title) filtered.title.push(allData.title[index]);
            if (allData.description) filtered.description.push(allData.description[index]);
            if (allData.image) filtered.image.push(allData.image[index]);
            if (allData.date) filtered.date.push(allData.date[index]);
            if (allData.category) filtered.category.push(allData.category[index]);
            if (allData.status) filtered.status.push(allData.status[index]);
            if (allData.author) filtered.author.push(allData.author[index]);
            if (allData.additionalFields) filtered.additionalFields.push(allData.additionalFields[index]);
        }
    });

    filteredData = filtered;
    renderWidget(filtered);
    updateSearchStats(filtered.id.length, allData.id.length);
}

// 📊 Mise à jour des statistiques de recherche
function updateSearchStats(shown, total) {
    const statsElement = document.getElementById('searchStats');
    if (shown === total) {
        statsElement.textContent = `${total} résultat${total > 1 ? 's' : ''}`;
    } else {
        statsElement.textContent = `${shown} résultat${shown > 1 ? 's' : ''} sur ${total}`;
    }
}

// 🎨 Fonction de rendu du widget
function renderWidget(data) {
    const container = document.getElementById('results');
    searchBar.classList.remove('hidden');

    // Vérifier si nous avons des données
    if (!data || !data.id || data.id.length === 0) {
        container.innerHTML = '<div class="no-data">Aucune donnée à afficher</div>';
        return;
    }

    container.innerHTML = '';

    // Créer une carte pour chaque ligne
    data.id.forEach((id, index) => {
        const card = createCard(data, index, id);
        container.appendChild(card);
    });
}

// 🃏 Création d'une carte individuelle
function createCard(data, index, rowId) {
    const card = document.createElement('div');
    card.className = 'card';

    // Titre (obligatoire)
    const title = data.title?.[index] || 'Sans titre';

    // Description
    const description = data.description?.[index] || '';

    // Image
    const imageData = data.image?.[index];
    let imageUrl = null;
    if (imageData && Array.isArray(imageData) && imageData.length > 0) {
        // Grist retourne les attachments sous forme de tableau d'objets ou d'URLs
        imageUrl = typeof imageData[0] === 'string' ? imageData[0] : imageData[0]?.url;
    }

    // Construction du HTML
    let cardHTML = '';

    // Image si disponible
    if (imageUrl) {
        cardHTML += `<img src="${imageUrl}" alt="${escapeHtml(title)}" class="card-image" onerror="this.style.display='none'">`;
    }

    cardHTML += '<div class="card-content">';
    cardHTML += `<h3 class="card-title">${escapeHtml(title)}</h3>`;

    if (description) {
        cardHTML += `<div class="card-description">${escapeHtml(description)}</div>`;
    }

    // Métadonnées (date, catégorie, statut, auteur)
    const metadata = [];

    if (data.date?.[index]) {
        metadata.push({
            label: 'Date',
            value: formatDate(data.date[index])
        });
    }

    if (data.category?.[index]) {
        metadata.push({
            label: 'Catégorie',
            value: data.category[index]
        });
    }

    if (data.status?.[index]) {
        metadata.push({
            label: 'Statut',
            value: data.status[index]
        });
    }

    if (data.author?.[index]) {
        metadata.push({
            label: 'Auteur',
            value: data.author[index]
        });
    }

    if (metadata.length > 0) {
        cardHTML += '<div class="card-metadata">';
        metadata.forEach(item => {
            cardHTML += `
                <div class="metadata-item">
                    <span class="metadata-label">${item.label}:</span>
                    <span>${escapeHtml(String(item.value))}</span>
                </div>
            `;
        });
        cardHTML += '</div>';
    }

    // Champs supplémentaires (si allowMultiple est utilisé)
    if (data.additionalFields) {
        const additionalData = data.additionalFields[index];

        if (additionalData) {
            cardHTML += '<div class="additional-fields">';

            // Si c'est un tableau (plusieurs colonnes sélectionnées)
            if (Array.isArray(additionalData)) {
                additionalData.forEach((value) => {
                    if (value !== null && value !== undefined && value !== '') {
                        cardHTML += `<div class="field-item">• ${escapeHtml(String(value))}</div>`;
                    }
                });
            } else {
                // Sinon afficher la valeur unique
                if (additionalData !== null && additionalData !== undefined && additionalData !== '') {
                    cardHTML += `<div class="field-item">${escapeHtml(String(additionalData))}</div>`;
                }
            }

            cardHTML += '</div>';
        }
    }

    cardHTML += '</div>';
    card.innerHTML = cardHTML;

    // Permettre la sélection de la ligne dans Grist au clic
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
        grist.setCursorPos({rowId: rowId}).catch(err => console.error('Erreur setCursorPos:', err));
    });

    return card;
}

// 📝 Message de configuration
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

// 📭 Message aucune donnée
function showNoData() {
    searchBar.classList.add('hidden');
    const container = document.getElementById('results');
    container.innerHTML = '<div class="no-data">Aucune donnée dans la table</div>';
}

// ❌ Affichage d'erreur
function showError(message) {
    searchBar.classList.add('hidden');
    const container = document.getElementById('results');
    container.innerHTML = `
        <div class="error-message">
            <strong>Erreur:</strong> ${escapeHtml(message)}
        </div>
    `;
}

// 🛡️ Échapper le HTML pour éviter les injections
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 📅 Formatter une date
function formatDate(dateValue) {
    if (!dateValue) return '';

    try {
        // Si c'est un timestamp Unix (Grist utilise des timestamps)
        if (typeof dateValue === 'number') {
            const date = new Date(dateValue * 1000);
            return date.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Si c'est déjà une date
        if (dateValue instanceof Date) {
            return dateValue.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // Si c'est une chaîne
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

// 🔄 Gestion du redimensionnement
window.addEventListener('resize', () => {
    if (isConfigured && filteredData) {
        renderWidget(filteredData);
    }
});

console.log('✅ Widget Grist configurable chargé et prêt');