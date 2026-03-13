// Export/Import page

import { createElement } from '../ui.js';
import { PageHeader, Card, Button, Alert } from '../components/layout.js';
import { saveState } from '../storage.js';
import { validateState } from '../types.js';

export function ExportImportPage(appState, baseData, updateState) {
    function buildUpdatedSiteData() {
        const nextSiteData = JSON.parse(JSON.stringify(baseData));
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

    const preEl = createElement('pre', {
        style: {
            background: 'var(--bg-dark)',
            padding: '1rem',
            borderRadius: '6px',
            overflow: 'auto',
            maxHeight: '300px',
            fontSize: '0.8rem',
            marginBottom: '1rem'
        }
    }, [buildUpdatedSiteDataString()]);

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

    const handleCopySiteData = () => {
        copyText(buildUpdatedSiteDataString(), 'site_data.json copie dans le presse-papier');
    };

    const handleDownloadSiteData = () => {
        const text = buildUpdatedSiteDataString();
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'site_data.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    let lastPasteTimestamp = 0;
    let lastPasteValue = '';

    const importTextarea = createElement('textarea', {
        placeholder: 'Collez votre JSON ici...',
        style: { minHeight: '200px', fontFamily: 'monospace' },
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

            if (!imported.appState || !validateState(imported.appState)) {
                alert('Format invalide: appState manquant ou incorrect');
                return;
            }

            if (confirm('Importer ces donnees ? Cela remplacera votre inventaire actuel.')) {
                Object.assign(appState, imported.appState);
                saveState(appState);
                alert('Import reussi');
                window.location.hash = '#/dashboard';
            }
        } catch (e) {
            alert('Erreur: JSON invalide\n' + e.message);
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

    const content = createElement('div', {}, [
        PageHeader('Export / Import', 'Sauvegardez ou restaurez votre inventaire'),

        Card('Export', [
            Alert('Exporte un site_data.json avec vos currencies de regions actuelles dans inventory_default.', 'info'),
            preEl
        ], [
            Button('Copier site_data.json', handleCopySiteData, 'secondary'),
            Button('Telecharger site_data.json', handleDownloadSiteData, 'secondary')
        ]),

        Card('Import', [
            Alert('Importez un JSON precedemment exporte.', 'warning'),
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
