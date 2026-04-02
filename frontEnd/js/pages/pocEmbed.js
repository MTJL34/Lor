import { createElement } from '../ui.js';
import { PageHeader, Card } from '../components/layout.js';

function attachIframeAutoHeight(iframe) {
    let resizeObserver = null;

    const syncHeight = () => {
        try {
            const doc = iframe.contentDocument;
            if (!doc) return;

            const nextHeight = Math.max(
                doc.body?.scrollHeight || 0,
                doc.documentElement?.scrollHeight || 0,
                doc.body?.offsetHeight || 0,
                doc.documentElement?.offsetHeight || 0
            );

            if (nextHeight > 0) {
                iframe.style.height = `${nextHeight + 8}px`;
            }
        } catch (_) {
            // Ignore cross-origin/early-load failures and keep fallback height.
        }
    };

    const bindResizeTracking = () => {
        try {
            const doc = iframe.contentDocument;
            if (!doc) return;

            resizeObserver?.disconnect();

            if ('ResizeObserver' in window && doc.body) {
                resizeObserver = new ResizeObserver(() => {
                    window.requestAnimationFrame(syncHeight);
                });
                resizeObserver.observe(doc.body);
                if (doc.documentElement) {
                    resizeObserver.observe(doc.documentElement);
                }
            }

            window.requestAnimationFrame(syncHeight);
            window.setTimeout(syncHeight, 180);
            window.setTimeout(syncHeight, 500);
        } catch (_) {
            syncHeight();
        }
    };

    iframe.addEventListener('load', bindResizeTracking);
    window.addEventListener('resize', syncHeight);
}

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
    attachIframeAutoHeight(iframe);

    const info = createElement('p', { className: 'poc-embed-info' }, [
        'Cette vue est integree a Constellation pour n avoir qu une seule application.'
    ]);

    const embedShell = createElement('div', { className: 'poc-embed-shell' }, [iframe]);
    const card = Card('Vue integree', [info, embedShell], [openButton]);
    card.classList.add('poc-embed-card');

    return createElement('div', { className: 'poc-embed-page' }, [
        PageHeader(title, subtitle),
        card
    ]);
}
