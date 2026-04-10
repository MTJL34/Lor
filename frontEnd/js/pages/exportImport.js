// Export/Import page

import { createElement } from '../ui.js';
import { PageHeader, Card, Button, Alert } from '../components/layout.js';
import {
    clearPreferredApiBase,
    getApiBase,
    getPreferredApiBase,
    probeApiBase,
    setPreferredApiBase
} from '../api.js';
import { validateState } from '../types.js';
import {
    getPoCDataSnapshot,
    initializePoCSharedState,
    replacePoCData
} from '../pocSharedState.js';

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createPreBlock(initialValue = '') {
    return createElement('pre', {
        style: {
            background: 'var(--bg-dark)',
            padding: '1rem',
            borderRadius: '6px',
            overflow: 'auto',
            maxHeight: '300px',
            fontSize: '0.8rem',
            marginBottom: '1rem',
            whiteSpace: 'pre-wrap'
        }
    }, [initialValue]);
}

function makeDownload(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function sanitizeFileNameSegment(value) {
    return String(value || '')
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

function buildTimestampFileSuffix() {
    return sanitizeFileNameSegment(new Date().toISOString().replace(/[:.]/g, '-'));
}

function normalizeImportedBackup(imported) {
    if (imported && typeof imported === 'object' && imported.appState && validateState(imported.appState)) {
        return {
            appState: deepClone(imported.appState),
            pocData: imported.pocData && typeof imported.pocData === 'object'
                ? deepClone(imported.pocData)
                : null,
            apiBase: String(imported.apiBase || '').trim()
        };
    }

    if (validateState(imported)) {
        return {
            appState: deepClone(imported),
            pocData: null,
            apiBase: ''
        };
    }

    throw new Error('Format invalide: backup complet ou appState attendu');
}

export function ExportImportPage(appState, baseData, updateState) {
    function buildUpdatedSiteData() {
        const nextSiteData = deepClone(baseData);
        const inventoryByRegion = appState?.inventoryByRegion || {};

        for (const [regionName, regionBase] of Object.entries(nextSiteData.regions || {})) {
            const currentInv = inventoryByRegion[regionName] || {};
            regionBase.inventory_default = {
                ...(regionBase.inventory_default || {}),
                ...currentInv
            };
        }

        return nextSiteData;
    }

    function buildUpdatedSiteDataString() {
        return JSON.stringify(buildUpdatedSiteData(), null, 2);
    }

    function buildCompleteBackup() {
        return {
            format: 'lor-backup',
            version: 1,
            exportedAt: new Date().toISOString(),
            apiBase: getPreferredApiBase() || '',
            appState: deepClone(appState),
            pocData: getPoCDataSnapshot()
        };
    }

    function buildCompleteBackupString() {
        return JSON.stringify(buildCompleteBackup(), null, 2);
    }

    let copyInProgress = false;
    let lastCopyTimestamp = 0;
    let lastCopiedValue = '';

    const copyText = (toCopy, successMessage) => {
        const now = Date.now();
        if (copyInProgress) return;
        if (toCopy === lastCopiedValue && now - lastCopyTimestamp < 500) return;

        copyInProgress = true;
        navigator.clipboard.writeText(toCopy).then(() => {
            lastCopyTimestamp = Date.now();
            lastCopiedValue = toCopy;
            const lineCount = String(toCopy || '').split(/\r?\n/).length;
            alert(`${successMessage} (${lineCount} lignes)`);
        }).catch(() => {
            alert('Erreur lors de la copie');
        }).finally(() => {
            copyInProgress = false;
        });
    };

    const apiBaseInput = createElement('input', {
        type: 'text',
        className: 'form-control',
        value: getPreferredApiBase(),
        placeholder: 'http://IP-DU-PC-QUI-HEBERGE:3000/api'
    });

    const apiStatus = createElement('div', {
        style: {
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            marginTop: '0.5rem'
        }
    }, ['']);

    const backupPreEl = createPreBlock('');
    const siteDataPreEl = createPreBlock(buildUpdatedSiteDataString());

    function refreshApiStatus(message = '') {
        const preferredApiBase = getPreferredApiBase();
        const activeApiBase = getApiBase();
        const lines = [
            `API active: ${activeApiBase || 'aucune'}`,
            preferredApiBase
                ? `API partagee enregistree sur ce PC: ${preferredApiBase}`
                : 'API partagee enregistree sur ce PC: aucune'
        ];

        if (message) {
            lines.push(message);
        }

        apiStatus.textContent = lines.join(' | ');
    }

    function refreshBackupPreview() {
        backupPreEl.textContent = buildCompleteBackupString();
    }

    const handleCopyBackup = () => {
        copyText(buildCompleteBackupString(), 'Backup complet copie dans le presse-papier');
    };

    const handleDownloadBackup = () => {
        makeDownload(`lor-backup-${buildTimestampFileSuffix()}.json`, buildCompleteBackupString());
    };

    const handleCopySiteData = () => {
        copyText(buildUpdatedSiteDataString(), 'site_data.json copie dans le presse-papier');
    };

    const handleDownloadSiteData = () => {
        makeDownload('site_data.json', buildUpdatedSiteDataString());
    };

    const handleSaveApiBase = () => {
        const savedValue = setPreferredApiBase(apiBaseInput.value);
        apiBaseInput.value = savedValue;
        refreshApiStatus(savedValue
            ? 'Backend partage enregistre sur ce PC.'
            : 'Retour au mode auto/local.'
        );
        alert(savedValue
            ? `Backend partage enregistre: ${savedValue}`
            : 'Backend partage supprime, retour au mode auto/local.'
        );
    };

    const handleClearApiBase = () => {
        clearPreferredApiBase();
        apiBaseInput.value = '';
        refreshApiStatus('Retour au mode auto/local.');
        alert('Backend partage supprime sur ce PC.');
    };

    const handleTestApiBase = async () => {
        const candidate = apiBaseInput.value.trim() || getApiBase();

        try {
            await probeApiBase(candidate);
            refreshApiStatus(`Connexion OK vers ${candidate}`);
            alert(`Connexion OK vers ${candidate}`);
        } catch (error) {
            refreshApiStatus(`Echec de connexion vers ${candidate}: ${error.message}`);
            alert(`Impossible de joindre ${candidate}\n${error.message}`);
        }
    };

    let lastPasteTimestamp = 0;
    let lastPasteValue = '';

    const importTextarea = createElement('textarea', {
        placeholder: 'Collez votre backup complet ici...',
        style: { minHeight: '220px', fontFamily: 'monospace' },
        onPaste: (e) => {
            const pasted = e.clipboardData ? e.clipboardData.getData('text') : '';
            const now = Date.now();

            if (pasted && pasted === lastPasteValue && now - lastPasteTimestamp < 500) {
                e.preventDefault();
                return;
            }

            lastPasteValue = pasted;
            lastPasteTimestamp = now;
        }
    });

    const handleImport = () => {
        try {
            const imported = JSON.parse(importTextarea.value);
            const normalizedImport = normalizeImportedBackup(imported);

            if (!confirm('Importer ce backup ? Cela remplacera vos donnees locales actuelles sur ce PC.')) {
                return;
            }

            if (normalizedImport.pocData) {
                replacePoCData(normalizedImport.pocData);
            }

            if (normalizedImport.apiBase) {
                const shouldApplyApiBase = confirm(
                    `Le backup contient un backend partage:\n${normalizedImport.apiBase}\n\nVoulez-vous l'appliquer aussi sur ce PC ?`
                );

                if (shouldApplyApiBase) {
                    const savedValue = setPreferredApiBase(normalizedImport.apiBase);
                    apiBaseInput.value = savedValue;
                }
            }

            const nextAppState = normalizedImport.appState;
            updateState(nextAppState);
            refreshApiStatus('Backup importe avec succes.');
            refreshBackupPreview();
            alert('Import reussi');
            window.location.hash = '#/dashboard';
        } catch (error) {
            alert(`Erreur d'import\n${error.message}`);
        }
    };

    const handleFileImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            importTextarea.value = event.target.result;
        };
        reader.readAsText(file);
    };

    const fileInput = createElement('input', {
        type: 'file',
        accept: '.json',
        onChange: handleFileImport,
        style: { marginBottom: '1rem' }
    });

    refreshApiStatus();
    refreshBackupPreview();

    initializePoCSharedState()
        .then(() => {
            refreshBackupPreview();
        })
        .catch((error) => {
            refreshApiStatus(`PoC local: ${error.message}`);
        });

    const content = createElement('div', {}, [
        PageHeader('Export / Import', 'Sauvegardez, restaurez et synchronisez entre vos PC'),

        Card('Backend Partage', [
            Alert(
                'Pour synchroniser plusieurs PC en direct, entrez ici l URL du backend commun. Exemple: http://IP-DU-PC-QUI-HEBERGE:3000/api',
                'info'
            ),
            createElement('div', { className: 'form-group' }, [
                createElement('label', { className: 'form-label' }, ['URL API partagee']),
                apiBaseInput,
                apiStatus
            ])
        ], [
            Button('Tester', handleTestApiBase, 'secondary'),
            Button('Enregistrer', handleSaveApiBase, 'primary'),
            Button('Effacer', handleClearApiBase, 'secondary')
        ]),

        Card('Backup Complet', [
            Alert(
                'Ce backup contient l inventaire principal, les champions personalises et les donnees PoC locales pour recuperer un autre PC.',
                'info'
            ),
            backupPreEl
        ], [
            Button('Copier le backup', handleCopyBackup, 'secondary'),
            Button('Telecharger le backup', handleDownloadBackup, 'secondary')
        ]),

        Card('Export site_data.json', [
            Alert(
                'Exporte un site_data.json avec vos currencies de regions actuelles dans inventory_default.',
                'info'
            ),
            siteDataPreEl
        ], [
            Button('Copier site_data.json', handleCopySiteData, 'secondary'),
            Button('Telecharger site_data.json', handleDownloadSiteData, 'secondary')
        ]),

        Card('Import Backup', [
            Alert(
                'Importez ici un backup complet depuis un autre PC. Le backup peut aussi proposer d appliquer la meme URL de backend partage.',
                'warning'
            ),
            createElement('div', { className: 'form-group' }, [
                createElement('label', { className: 'form-label' }, ['Fichier JSON']),
                fileInput
            ]),
            createElement('div', { className: 'form-group' }, [
                createElement('label', { className: 'form-label' }, ['Ou collez le JSON']),
                importTextarea
            ])
        ], [
            Button('Importer', handleImport, 'primary')
        ])
    ]);

    return content;
}
