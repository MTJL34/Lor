// Resource table component

import { createElement, formatNumber, createResourceIcon } from '../ui.js';
import { computeNeeded } from '../calc.js';
import { NumberInput } from './numberInput.js';

export function ResourceTable(regionBase, inventory, onInventoryChange, regionName = '') {
    const rows = [];
    
    const desiredOrder = ['wild_shards','star_crystal','gemstone','nova_shards','nova_crystal'];
    const totalsKeys = Object.keys(regionBase.totals);
    const added = new Set();

    function pushRowForKey(key) {
        if (!Object.prototype.hasOwnProperty.call(regionBase.totals, key)) return;
        const total = regionBase.totals[key];
        const inv = inventory[key] || 0;
        const needed = computeNeeded(total, inv);
        const warning = inv > total;
        const inputProps = {};
        if (key === 'star_crystal' || key === 'wild_shards') inputProps.step = '5';
        if (key === 'gemstone') inputProps.step = '10';
        if (key === 'nova_shards') inputProps.step = regionName === 'Spirit World' ? '10' : '5';

        const row = createElement('tr', {}, [
            createElement('td', {}, [createResourceIcon(key, 20)]),
            createElement('td', {}, [formatNumber(total)]),
            createElement('td', {}, [
                NumberInput(inv, (val) => {
                    if (onInventoryChange) onInventoryChange(key, val);
                }, inputProps)
            ]),
            createElement('td', {
                style: { 
                    color: warning ? 'var(--warning)' : (needed === 0 ? 'var(--success)' : 'var(--text-secondary)')
                }
            }, [
                warning ? `⚠️ +${inv - total} en trop` : (needed === 0 ? '✅' : formatNumber(needed))
            ])
        ]);

        rows.push(row);
        added.add(key);
    }

    // Push rows in the requested order first
    for (const k of desiredOrder) {
        pushRowForKey(k);
    }

    // Then push any remaining keys in their original order
    for (const k of totalsKeys) {
        if (!added.has(k)) pushRowForKey(k);
    }
    
    const table = createElement('table', {}, [
        createElement('thead', {}, [
            createElement('tr', {}, [
                createElement('th', {}, ['Ressource']),
                createElement('th', {}, ['Total']),
                createElement('th', {}, ['Inventaire']),
                createElement('th', {}, ['Manquant'])
            ])
        ]),
        createElement('tbody', {}, rows)
    ]);
    
    return createElement('div', { className: 'table-container' }, [table]);
}
