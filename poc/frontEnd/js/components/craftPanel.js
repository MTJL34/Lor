// Craft panel component

import { createElement, formatNumber } from '../ui.js';
import { computeCraftable, applyCraft } from '../calc.js';
import { Button } from './layout.js';
import { NumberInput } from './numberInput.js';

export function CraftPanel(inventory, onCraft) {
    const shards = inventory.nova_shards || 0;
    const crystals = inventory.nova_crystal || 0;
    const craftable = computeCraftable(shards);
    
    let craftAmount = Math.min(1, craftable);
    
    const craftInfo = createElement('div', { className: 'craft-info' }, [
        createElement('div', { className: 'craft-stat' }, [
            createElement('div', { className: 'stat-label' }, ['Nova Shards']),
            createElement('div', { className: 'stat-value', style: { fontSize: '1.5rem' } }, [formatNumber(shards)])
        ]),
        createElement('div', { className: 'craft-stat' }, [
            createElement('div', { className: 'stat-label' }, ['Nova Crystal']),
            createElement('div', { className: 'stat-value', style: { fontSize: '1.5rem' } }, [formatNumber(crystals)])
        ]),
        createElement('div', { className: 'craft-stat' }, [
            createElement('div', { className: 'stat-label' }, ['Craftable (÷100)']),
            createElement('div', { className: 'stat-value', style: { fontSize: '1.5rem', color: 'var(--success)' } }, [formatNumber(craftable)])
        ])
    ]);
    
    const craftControls = createElement('div', { className: 'btn-group' }, [
        Button(`Craft Max (${craftable})`, () => {
            if (craftable > 0 && onCraft) {
                const newInv = applyCraft(inventory, craftable);
                if (newInv) onCraft(newInv);
            }
        }, craftable === 0 ? 'secondary' : 'success'),
        NumberInput(craftAmount, (val) => {
            craftAmount = Math.min(val, craftable);
        }, { style: { width: '100px', display: 'inline-block' } }),
        Button('Craft x', () => {
            if (craftAmount > 0 && craftAmount <= craftable && onCraft) {
                const newInv = applyCraft(inventory, craftAmount);
                if (newInv) onCraft(newInv);
            }
        }, craftAmount === 0 || craftAmount > craftable ? 'secondary' : 'primary')
    ]);
    
    return createElement('div', { className: 'craft-panel' }, [
        createElement('h4', { style: { marginBottom: '1rem' } }, ['⚗️ Craft Nova Shards → Crystal']),
        createElement('p', { style: { color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' } }, 
            ['100 Nova Shards = 1 Nova Crystal']),
        craftInfo,
        craftControls
    ]);
}
