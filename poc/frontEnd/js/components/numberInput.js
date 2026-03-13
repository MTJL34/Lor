// Number input component

import { createElement } from '../ui.js';
import { clampInt } from '../types.js';

export function NumberInput(value, onChange, props = {}) {
    const input = createElement('input', {
        type: 'number',
        value: value,
        min: '0',
        step: '1',
        ...props,
        onInput: (e) => {
            const val = clampInt(e.target.value);
            e.target.value = val;
            if (onChange) onChange(val);
        }
    });
    
    return input;
}
