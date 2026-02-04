// 🎯 Configuration des colonnes pour le widget Grist
let allData = [];
let currentMappings = null;
let isConfigured = false;

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
grist.onRecords(function(records, mappings) {
    try {
        currentMappings = mappings;

        // Vérifier si la colonne obligatoire est configurée
        if (!mappings || !mappings.title) {
            isConfigured = false;
            showConfigurationMessage();
            return;
        }

        isConfigured = true;

        // Utiliser le helper pour mapper automatiquement les colonnes
        const mappedData = grist.mapColumnNames(records, {
            mappings: mappings
        });

        if (mappedData) {
            allData = mappedData;
            renderWidget(mappedData);
        } else {
            showConfigurationMessage();
        }

    } catch (error) {
        console.error("Erreur lors du traitement des données:", error);
        showError(error.message);
    }
});

// 🎨 Fonction de rendu du widget
function renderWidget(data) {
    const container = document.getElementById('results');

    // Vérifier si nous avons des données
    if (!data || !data.id || data.id.length === 0) {
        container.innerHTML = '<div class="no-data">Aucune donnée à afficher</div>';
        return;
    }

    container.innerHTML = '';

    // Créer une carte pour chaque ligne
    data.id.forEach((id, index) => {
        const card = createCard(data, index);
        container.appendChild(card);
    });
}

// 🃏 Création d'une carte individuelle
function createCard(data, index) {
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
        imageUrl = imageData[0];
    }

    // Construction du HTML
    let cardHTML = '';

    // Image si disponible
    if (imageUrl) {
        cardHTML += `<img src="${imageUrl}" alt="${title}" class="card-image" onerror="this.style.display='none'">`;
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
                additionalData.forEach((value, idx) => {
                    if (value !== null && value !== undefined && value !== '') {
                        cardHTML += `<div class="field-item">• ${escapeHtml(String(value))}</div>`;
                    }
                });
            } else {
                // Sinon afficher la valeur unique
                cardHTML += `<div class="field-item">${escapeHtml(String(additionalData))}</div>`;
            }

            cardHTML += '</div>';
        }
    }

    cardHTML += '</div>';
    card.innerHTML = cardHTML;

    // Permettre la sélection de la ligne dans Grist au clic
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
        grist.setCursorPos({rowId: id}).catch(console.error);
    });

    return card;
}

// 📝 Message de configuration
function showConfigurationMessage() {
    const container = document.getElementById('results');
    container.innerHTML = `
        <div class="config-message">
            <h2>⚙️ Configuration requise</h2>
            <p>Veuillez configurer au moins la colonne <strong>"Titre"</strong> dans le panneau de configuration à droite.</p>
            <p style="margin-top: 1rem;">Vous pouvez également configurer les colonnes optionnelles pour enrichir l'affichage.</p>
        </div>
    `;
}

// ❌ Affichage d'erreur
function showError(message) {
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
        // Si c'est un timestamp
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
    if (isConfigured && allData) {
        renderWidget(allData);
    }
});

console.log('✅ Widget Grist configurable chargé');