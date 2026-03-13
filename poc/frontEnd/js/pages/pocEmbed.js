import { createElement } from '../ui.js';
import { PageHeader, Card } from '../components/layout.js';

export function PoCEmbedPage({ title, subtitle, src }) {
    const openButton = createElement('a', {
        href: src,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'btn btn-secondary'
    }, ['Ouvrir dans un onglet']);

    const iframe = createElement('iframe', {
        className: 'poc-embed-frame',
        src,
        title
    });

    const info = createElement('p', { className: 'poc-embed-info' }, [
        'Cette vue est integree a Constellation pour n avoir qu une seule application.'
    ]);

    return createElement('div', {}, [
        PageHeader(title, subtitle),
        Card('Vue integree', [info, iframe], [openButton])
    ]);
}
