// UI helpers and DOM utilities
import { Region as PoCRegions } from '../data/Region.js';
import { ChampionImages } from '../data/ChampionImages.js';

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

function getChampionInitials(championName) {
    const trimmed = String(championName || '').trim();
    if (!trimmed) return '?';

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase();
}

function normalizeChampionNameForImageLookup(championName) {
    return String(championName || '')
        .replace(/(?:\u00e2\u20ac\u2122|\u00e2\u20ac\u02dc|\u00e2\u20ac\u00b2|\u00e2\u0080\u0099|\u00e2\u0080\u0098|[\u2019\u2018'`\u00b4])/g, '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '')
        .toLowerCase()
        .trim();
}

const championImageLookup = Object.fromEntries(
    Object.entries(ChampionImages).map(([name, url]) => [
        normalizeChampionNameForImageLookup(name),
        url
    ])
);

const championImageAliases = {
    drmund: "Dr. Mundo",
    drmundo: "Dr. Mundo",
    luxilluminated: "Lux",
    nunu: "Nunu & Willump",
    qiyanna: "Qiyana",
    renataglasc: "Renata Glasc",
    spiritbahri: "Ahri",
    spiritbevelynn: "Evelynn",
    spiritbmasteryi: "Master Yi",
    spiritbteemo: "Teemo",
    spiritbyasuo: "Yasuo",
    ziggz: "Ziggs"
};

export function getChampionImageUrl(championName) {
    const normalizedName = normalizeChampionNameForImageLookup(championName);
    if (!normalizedName) return '';

    const directMatch = championImageLookup[normalizedName];
    if (directMatch) return directMatch;

    const aliasName = championImageAliases[normalizedName];
    return aliasName ? ChampionImages[aliasName] || '' : '';
}

export function createChampionAvatar(championName, size = 42) {
    const avatarUrl = getChampionImageUrl(championName);
    const initials = getChampionInitials(championName);
    const isCardArt = avatarUrl.includes('dd.b.pvp.net');

    const avatar = createElement('img', {
        className: `champion-avatar${isCardArt ? ' champion-avatar-card' : ''}`,
        alt: championName,
        title: championName,
        width: size,
        height: size,
        loading: 'lazy',
        draggable: 'false'
    });

    const fallback = createElement('div', {
        className: 'champion-avatar champion-avatar-fallback',
        style: {
            width: `${size}px`,
            height: `${size}px`,
            display: 'none'
        }
    }, [initials]);

    const shell = createElement('div', {
        className: 'champion-avatar-shell',
        style: {
            width: `${size}px`,
            height: `${size}px`
        }
    }, [avatar, fallback]);

    if (avatarUrl) {
        avatar.addEventListener('error', () => {
            avatar.style.display = 'none';
            fallback.style.display = 'flex';
        });
        avatar.src = avatarUrl;
    } else {
        fallback.style.display = 'flex';
    }

    return shell;
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
