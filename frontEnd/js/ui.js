// UI helpers and DOM utilities
import { Region as PoCRegions } from '../data/Region.js';

export function $(selector) {
    return document.querySelector(selector);
}

export function $$(selector) {
    return Array.from(document.querySelectorAll(selector));
}

export function createElement(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    
    for (const [key, value] of Object.entries(props)) {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.substring(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, value);
        }
    }
    
    for (const child of children) {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    }
    
    return el;
}

export function render(container, content) {
    if (typeof container === 'string') {
        container = $(container);
    }
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (typeof content === 'string') {
        container.innerHTML = content;
    } else if (content instanceof Node) {
        container.appendChild(content);
    } else if (Array.isArray(content)) {
        content.forEach(item => {
            if (item instanceof Node) {
                container.appendChild(item);
            }
        });
    }
}


function normalizeRegionNameForIcon(regionName) {
    const map = {
        '\u00celes Obscures': 'Shadow Isles',
        'ÃŽles Obscures': 'Shadow Isles'
    };
    return map[regionName] || regionName;
}

export function getRegionIconPath(regionName) {
    if (!regionName) return '';
    const normalized = normalizeRegionNameForIcon(regionName);
    const match = PoCRegions.find(region => region.Region_Name === normalized);
    const iconPath = match?.Region_Icon || '';
    if (!iconPath) return '';
    return iconPath.replace('../img/Region_Icon/', 'img/Region_Icon/');
}

export function createRegionIcon(regionName, size = 24) {
    const iconPath = getRegionIconPath(regionName);
    if (!iconPath) return document.createTextNode(formatRegionName(regionName));
    return createElement('img', {
        src: iconPath,
        alt: formatRegionName(regionName),
        title: formatRegionName(regionName),
        style: {
            width: `${size}px`,
            height: `${size}px`,
            objectFit: 'contain'
        }
    });
}

const resourceIconMap = {
    wild_shards: { file: 'img/200px-Wild_Fragment_LoR_icon.png', label: 'Wild Shards' },
    star_crystal: { file: 'img/200px-Star_Crystal_LoR_Icon.png', label: 'Star Crystal' },
    gemstone: { file: 'img/200px-Gemstones_LoR_Icon.png', label: 'Gemstone' },
    nova_shards: { file: 'img/200px-Nova_Shards_LoR_Icon.png', label: 'Nova Shards' },
    nova_crystal: { file: 'img/200px-Nova_Crystal_LoR_Icon.png', label: 'Nova Crystal' }
};

export function createResourceIcon(resourceKey, size = 18) {
    const entry = resourceIconMap[resourceKey];
    if (!entry) return document.createTextNode(resourceKey);
    return createElement('img', {
        src: entry.file,
        alt: entry.label,
        title: entry.label,
        style: {
            width: `${size}px`,
            height: `${size}px`,
            objectFit: 'contain'
        }
    });
}

export function formatNumber(num) {
    return new Intl.NumberFormat('fr-FR').format(num);
}

export function formatRegionName(regionName) {
    const map = {
        'Shadow Isles': '\u00celes Obscures',
        'ÃŽles Obscures': '\u00celes Obscures'
    };
    return map[regionName] || regionName;
}

export function getRegionStarsMax(regionName) {
    return regionName === 'Spirit World' ? 7 : 6;
}

export function formatPercent(num) {
    return `${(num * 100).toFixed(1)}%`;
}

export function setActiveNav(route) {
    $$('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-nav') === route) {
            link.classList.add('active');
        }
    });
}
