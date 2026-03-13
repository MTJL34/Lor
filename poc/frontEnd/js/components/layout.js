// Layout components

import { createElement } from '../ui.js';

export function PageHeader(title, subtitle = '') {
    return createElement('div', { className: 'page-header' }, [
        createElement('h2', {}, [title]),
        subtitle ? createElement('p', {}, [subtitle]) : null
    ].filter(Boolean));
}

export function Card(title, children, headerButtons = []) {
    const header = createElement('div', { className: 'card-header' }, [
        createElement('h3', { className: 'card-title' }, [title]),
        headerButtons.length > 0 
            ? createElement('div', { className: 'btn-group' }, headerButtons)
            : null
    ].filter(Boolean));
    
    return createElement('div', { className: 'card' }, [
        header,
        ...children
    ]);
}

export function Button(text, onClick, variant = 'primary') {
    return createElement('button', {
        className: `btn btn-${variant}`,
        onClick
    }, [text]);
}

export function Alert(message, type = 'info') {
    return createElement('div', {
        className: `alert alert-${type}`
    }, [message]);
}
