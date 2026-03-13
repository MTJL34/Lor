// JSON preview component

import { createElement } from '../ui.js';

export function JsonPreview(data) {
    const jsonString = JSON.stringify(data, null, 2);
    
    return createElement('pre', {
        style: {
            background: 'var(--bg-dark)',
            padding: '1rem',
            borderRadius: '6px',
            overflow: 'auto',
            maxHeight: '500px',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)'
        }
    }, [jsonString]);
}
