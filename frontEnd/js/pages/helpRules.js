// Help/Rules page

import { createElement } from '../ui.js';
import { PageHeader, Card } from '../components/layout.js';

export function HelpRulesPage() {
    const content = createElement('div', {}, [
        PageHeader('❓ Aide & Règles', 'Comment utiliser le calculateur'),
        
        Card('Ressources Régionales', [
            createElement('p', { style: { marginBottom: '1rem' } }, [
                'Les ressources (Nova Shards, Nova Crystal, Star Crystal, Gemstone, Wild Shards) sont gérées par région dans Legends of Runeterra.'
            ]),
            createElement('ul', { style: { paddingLeft: '1.5rem', color: 'var(--text-secondary)' } }, [
                createElement('li', {}, ['Chaque région a ses propres totaux et inventaire']),
                createElement('li', {}, ['Les besoins sont calculés automatiquement : needed = total - inventory']),
                createElement('li', {}, ['Si votre inventaire dépasse le total, un avertissement s\'affiche'])
            ])
        ]),
        
        Card('Calcul des Besoins (Needed)', [
            createElement('p', { style: { marginBottom: '1rem' } }, [
                'La formule est simple :'
            ]),
            createElement('pre', {
                style: {
                    background: 'var(--bg-dark)',
                    padding: '1rem',
                    borderRadius: '6px',
                    marginBottom: '1rem'
                }
            }, ['needed = Math.max(0, total - inventory)']),
            createElement('p', { style: { color: 'var(--text-secondary)' } }, [
                'Si vous avez déjà tout (ou plus), needed = 0.'
            ])
        ]),
        
        Card('Craft Nova Shards → Crystal', [
            createElement('p', { style: { marginBottom: '1rem' } }, [
                'Vous pouvez convertir vos Nova Shards en Nova Crystal :'
            ]),
            createElement('ul', { style: { paddingLeft: '1.5rem', color: 'var(--text-secondary)', marginBottom: '1rem' } }, [
                createElement('li', {}, ['100 Nova Shards = 1 Nova Crystal']),
                createElement('li', {}, ['Le craft est manuel (bouton "Craft Max" ou "Craft x")']),
                createElement('li', {}, ['Les Nova Shards ne sont PAS automatiquement arrondis à 100']),
                createElement('li', {}, ['Vous pouvez stocker n\'importe quel nombre de shards (ex: 450, 73, etc.)'])
            ]),
            createElement('p', { style: { color: 'var(--warning)' } }, [
                '⚠️ Le craft modifie votre inventaire réel et est sauvegardé.'
            ])
        ]),
        
        Card('Sauvegarde & Export', [
            createElement('ul', { style: { paddingLeft: '1.5rem', color: 'var(--text-secondary)' } }, [
                createElement('li', {}, ['Vos données sont sauvegardées automatiquement dans le navigateur à chaque modification']),
                createElement('li', {}, ['Si l\'API est disponible, elles sont aussi synchronisées avec le backend']),
                createElement('li', {}, ['Utilisez Export/Import pour faire des backups ou transférer vos données']),
                createElement('li', {}, ['Le JSON exporté contient votre inventaire + les calculs']),
                createElement('li', {}, ['En cas d\'API indisponible, l\'application garde un fallback local'])
            ])
        ]),
        
        Card('Avertissements Importants', [
            createElement('div', { className: 'alert alert-warning' }, [
                '⚠️ Ce site ne devine pas les drops de ressources. Il gère uniquement votre inventaire manuel.'
            ]),
            createElement('div', { className: 'alert alert-info', style: { marginTop: '1rem' } }, [
                'ℹ️ Les valeurs "needed" du fichier de base sont recalculées en fonction de VOTRE inventaire actuel.'
            ])
        ])
    ]);
    
    return content;
}
