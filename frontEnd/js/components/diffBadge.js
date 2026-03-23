// Diff badge component

import { createElement } from '../ui.js';

export function DiffBadge(value) {
    if (value === 0) return null;
    
    const type = value > 0 ? 'success' : 'danger';
    const prefix = value > 0 ? '+' : '';
    
    return createElement('span', {
        className: `badge badge-${type}`
    }, [`${prefix}${value}`]);
}
