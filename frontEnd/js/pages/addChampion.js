// Add Champion page

import { createElement, formatRegionName } from '../ui.js';
import { applyComputedRegionTotals } from '../calc.js';
import { PageHeader, Card, Button } from '../components/layout.js';
import { Champion as PoCChampions } from '../../data/Champion.js';
import { Region as PoCRegions } from '../../data/Region.js';
import { Cost as PoCCosts } from '../../data/Cost.js';
import { Stars as PoCStars } from '../../data/Stars.js';
import {
    buildMainAppChampion,
    getChampionResourceTemplate,
    getRegionStarsMax,
    mapPoCRegionNameToAppRegion,
    upsertChampionInAppState,
    upsertChampionInBaseData
} from '../championState.js';

export function AddChampionPage(appState, baseData, updateState) {
    const regionNames = Object.keys(baseData.regions).sort();
    const pocRegionById = new Map(PoCRegions.map(region => [region.Region_ID, region.Region_Name]));
    const pocCostById = new Map(PoCCosts.map(cost => [cost.Cost_ID, cost.Cost_Value]));
    const pocStarsById = new Map(PoCStars.map(star => [star.Stars_ID, star.Stars_Value]));
    const pocChampions = PoCChampions
        .filter(champion => champion && champion.Champion_ID && champion.POC)
        .slice()
        .sort((a, b) => a.Champion_Name.localeCompare(b.Champion_Name));
    const pocChampionById = new Map(pocChampions.map(champion => [champion.Champion_ID, champion]));
    let pocRegionFilter = 'all';
    const defaultResources = getChampionResourceTemplate('');
    
    // Form state with requested default tier values
    let formData = {
        region: '',
        name: '',
        cost: 0,
        stars_current: 3,
        stars_max: getRegionStarsMax(''),
        poc: 1,
        nova_crystal: defaultResources.nova_crystal,
        star_crystal_tier1: defaultResources.star_crystal_tiers[0] || 0,
        star_crystal_tier2: defaultResources.star_crystal_tiers[1] || 0,
        gemstone_tier1: defaultResources.gemstone_tiers[0] || 0,
        gemstone_tier2: defaultResources.gemstone_tiers[1] || 0,
        gemstone_tier3: defaultResources.gemstone_tiers[2] || 0,
        gemstone_tier4: defaultResources.gemstone_tiers[3] || 0,
        wild_shards_tier1: defaultResources.wild_shards_tiers[0] || 0,
        wild_shards_tier2: defaultResources.wild_shards_tiers[1] || 0,
        wild_shards_tier3: defaultResources.wild_shards_tiers[2] || 0,
        wild_shards_tier4: defaultResources.wild_shards_tiers[3] || 0
    };
    
    function handleSubmit() {
        if (!formData.name.trim()) {
            alert('Le nom du champion est requis');
            return;
        }
        
        if (!formData.region) {
            alert('La région est requise');
            return;
        }
        
        // Check if champion already exists in this region
        const regionBase = baseData.regions[formData.region];
        if (regionBase && regionBase.champions) {
            const exists = regionBase.champions.find(c => 
                c.name.toLowerCase() === formData.name.trim().toLowerCase()
            );
            if (exists) {
                alert(`Le champion "${formData.name}" existe déjà dans ${formData.region}`);
                return;
            }
        }
        
        const gemstoneTiers = [
            formData.gemstone_tier1,
            formData.gemstone_tier2,
            formData.gemstone_tier3,
            formData.gemstone_tier4
        ];
        const gemstoneTotal = gemstoneTiers.reduce((sum, tier) => sum + tier, 0);
        
        const starCrystalTiers = [
            formData.star_crystal_tier1,
            formData.star_crystal_tier2
        ];
        const starCrystalTotal = starCrystalTiers.reduce((sum, tier) => sum + tier, 0);
        
        const wildShardsTiers = [
            formData.wild_shards_tier1,
            formData.wild_shards_tier2,
            formData.wild_shards_tier3,
            formData.wild_shards_tier4
        ];
        const wildShardsTotal = wildShardsTiers.reduce((sum, tier) => sum + tier, 0);
        
        const newChampion = buildMainAppChampion({
            name: formData.name.trim(),
            cost: formData.cost,
            stars: formData.stars_current,
            poc: formData.poc,
            regionName: formData.region,
            source: 'custom',
            resources: {
                nova_crystal: formData.nova_crystal,
                star_crystal_tiers: starCrystalTiers,
                star_crystal_total: starCrystalTotal,
                gemstone_tiers: gemstoneTiers,
                gemstone_total: gemstoneTotal,
                wild_shards_tiers: wildShardsTiers,
                wild_shards_total: wildShardsTotal
            }
        });
        
        upsertChampionInBaseData(baseData, formData.region, newChampion);
        applyComputedRegionTotals(baseData);
        
        upsertChampionInAppState(appState, formData.region, newChampion);
        
        // Save and redirect
        updateState(appState);
        alert(`Champion "${formData.name}" ajouté à ${formData.region} !`);
        window.location.hash = '#/champions';
    }
    
    const regionSelect = createElement('select', {
        className: 'form-control',
        onChange: (e) => {
            formData.region = e.target.value;
            formData.stars_max = getRegionStarsMax(formData.region);
            if (starsMaxInput) {
                starsMaxInput.value = String(formData.stars_max);
            }
        }
    }, [
        createElement('option', { value: '', selected: !formData.region }, ['Région']),
        ...regionNames.map(name =>
            createElement('option', {
                value: name,
                selected: formData.region === name
            }, [formatRegionName(name)])
        )
    ]);
    
    function getMappedRegionName(champion) {
        const regionName = pocRegionById.get(champion.Region_ID) || '';
        return mapPoCRegionNameToAppRegion(regionName, regionNames);
    }

    function populateChampionOptions(selectEl) {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        selectEl.appendChild(createElement('option', { value: '', selected: true }, ['Choisir un champion']));

        const filtered = pocChampions.filter(champion => {
            if (pocRegionFilter === 'all') return true;
            return getMappedRegionName(champion) === pocRegionFilter;
        });

        filtered.forEach(champion => {
            selectEl.appendChild(createElement('option', {
                value: String(champion.Champion_ID)
            }, [champion.Champion_Name]));
        });
    }

    const pocRegionFilterSelect = createElement('select', {
        className: 'form-control',
        onChange: (e) => {
            pocRegionFilter = e.target.value;
            populateChampionOptions(championSelect);
        }
    }, [
        createElement('option', { value: 'all', selected: true }, ['Toutes les régions']),
        ...regionNames.map(name =>
            createElement('option', {
                value: name
            }, [formatRegionName(name)])
        )
    ]);

    const championSelect = createElement('select', {
        className: 'form-control',
        onChange: (e) => {
            const champId = Number(e.target.value);
            const selected = pocChampionById.get(champId);
            if (!selected) {
                formData.name = '';
                return;
            }

            formData.name = selected.Champion_Name;
            formData.cost = pocCostById.get(selected.Cost_ID) || 0;
            formData.stars_current = pocStarsById.get(selected.Stars_ID) || 0;
            formData.poc = selected.POC ? 1 : 0;

            formData.region = getMappedRegionName(selected);
            formData.stars_max = getRegionStarsMax(formData.region);

            if (costInputEl) costInputEl.value = String(formData.cost);
            if (pocInputEl) pocInputEl.value = String(formData.poc);
            if (starsCurrentInputEl) starsCurrentInputEl.value = String(formData.stars_current);
            if (starsMaxInput) starsMaxInput.value = String(formData.stars_max);
            if (regionSelect) regionSelect.value = formData.region;
        }
    }, [
        createElement('option', { value: '', selected: true }, ['Choisir un champion']),
        ...pocChampions.map(champion => createElement('option', {
            value: String(champion.Champion_ID)
        }, [champion.Champion_Name]))
    ]);

    populateChampionOptions(championSelect);
    
    const createNumberField = (label, value, onChange, max = null) => {
        return createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'form-label' }, [label]),
            createElement('input', {
                type: 'number',
                className: 'form-control',
                value: value,
                min: '0',
                step: '1',
                max: max ? String(max) : null,
                onInput: (e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    onChange(max && val > max ? max : val);
                    e.target.value = max && val > max ? max : val;
                }
            })
        ]);
    };
    
    const createSimpleNumberInput = (value, onChange, max = null) => {
        return createElement('input', {
            type: 'number',
            className: 'form-control',
            value: value,
            min: '0',
            step: '1',
            max: max ? String(max) : null,
            style: { width: '80px' },
            onInput: (e) => {
                const val = Math.max(0, parseInt(e.target.value) || 0);
                onChange(max && val > max ? max : val);
                e.target.value = max && val > max ? max : val;
            }
        });
    };
    
    const costInput = createNumberField('Coût', formData.cost, (val) => { formData.cost = val; });
    const costInputEl = costInput.querySelector('input');
    const starsCurrentInput = createSimpleNumberInput(formData.stars_current, (val) => { formData.stars_current = val; }, 7);
    const starsCurrentInputEl = starsCurrentInput;
    const starsMaxInput = createSimpleNumberInput(formData.stars_max, (val) => { formData.stars_max = val; }, 7);
    const pocInput = createNumberField('PoC (0 ou 1)', formData.poc, (val) => { formData.poc = val; }, 1);
    const pocInputEl = pocInput.querySelector('input');
    
    const novaCrystalInput = createNumberField('Nova Crystal (0 ou 1)', formData.nova_crystal, (val) => { formData.nova_crystal = val; }, 1);
    
    // Totals updater (will be assigned after DOM nodes exist)
    let wildShardsTotalSpan, starCrystalTotalSpan, gemstoneTotalSpan;
    function updateTotals() {
        const wildTiers = [formData.wild_shards_tier1, formData.wild_shards_tier2, formData.wild_shards_tier3, formData.wild_shards_tier4];
        const wildTotal = wildTiers.reduce((s, v) => s + (v || 0), 0);
        if (wildShardsTotalSpan) wildShardsTotalSpan.textContent = String(wildTotal);

        const starTiers = [formData.star_crystal_tier1, formData.star_crystal_tier2];
        const starTotal = starTiers.reduce((s, v) => s + (v || 0), 0);
        if (starCrystalTotalSpan) starCrystalTotalSpan.textContent = String(starTotal);

        const gemTiers = [formData.gemstone_tier1, formData.gemstone_tier2, formData.gemstone_tier3, formData.gemstone_tier4];
        const gemTotal = gemTiers.reduce((s, v) => s + (v || 0), 0);
        if (gemstoneTotalSpan) gemstoneTotalSpan.textContent = String(gemTotal);
    }

    // Helper to create select inputs for constrained gemstone tiers
    const createSelectField = (label, value, options, onChange) => {
        return createElement('div', { className: 'form-group' }, [
            createElement('label', { className: 'form-label' }, [label]),
            createElement('select', {
                className: 'form-control',
                onChange: (e) => onChange(parseInt(e.target.value))
            }, options.map(opt => createElement('option', { value: String(opt), selected: opt === value }, [String(opt)])))
        ]);
    };

    // Star Crystal tiers (step 10 and 40)
    const starCrystalTier1Input = createNumberField('Star Crystal Palier 1', formData.star_crystal_tier1, (val) => { formData.star_crystal_tier1 = val; updateTotals(); });
    const starCrystalTier2Input = createNumberField('Star Crystal Palier 2', formData.star_crystal_tier2, (val) => { formData.star_crystal_tier2 = val; updateTotals(); });

    // Gemstone tiers: constrained choices
    const gemTier1Input = createSelectField('Gemstone Palier 1', formData.gemstone_tier1, [0, 150, 100, 200], (val) => { formData.gemstone_tier1 = val; updateTotals(); });
    const gemTier2Input = createSelectField('Gemstone Palier 2', formData.gemstone_tier2, [0, 250, 200], (val) => { formData.gemstone_tier2 = val; updateTotals(); });
    const gemTier3Input = createSelectField('Gemstone Palier 3', formData.gemstone_tier3, [0, 250, 300], (val) => { formData.gemstone_tier3 = val; updateTotals(); });
    const gemTier4Input = createSelectField('Gemstone Palier 4', formData.gemstone_tier4, [0, 350, 400], (val) => { formData.gemstone_tier4 = val; updateTotals(); });

    // Wild Shards tiers (step 40/60/80/100)
    const wildShardsTier1Input = createNumberField('Wild Shards Palier 1', formData.wild_shards_tier1, (val) => { formData.wild_shards_tier1 = val; updateTotals(); });
    const wildShardsTier2Input = createNumberField('Wild Shards Palier 2', formData.wild_shards_tier2, (val) => { formData.wild_shards_tier2 = val; updateTotals(); });
    const wildShardsTier3Input = createNumberField('Wild Shards Palier 3', formData.wild_shards_tier3, (val) => { formData.wild_shards_tier3 = val; updateTotals(); });
    const wildShardsTier4Input = createNumberField('Wild Shards Palier 4', formData.wild_shards_tier4, (val) => { formData.wild_shards_tier4 = val; updateTotals(); });

    // Attach step snapping behavior
    function attachStepBehavior(wrapper, step, fieldName) {
        const input = wrapper.querySelector('input');
        if (!input) return;
        input.setAttribute('step', String(step));
        input.addEventListener('change', (e) => {
            let val = Math.max(0, parseInt(e.target.value) || 0);
            val = Math.round(val / step) * step;
            e.target.value = val;
            formData[fieldName] = val;
            updateTotals();
        });
    }

    attachStepBehavior(starCrystalTier1Input, 10, 'star_crystal_tier1');
    attachStepBehavior(starCrystalTier2Input, 40, 'star_crystal_tier2');

    attachStepBehavior(wildShardsTier1Input, 40, 'wild_shards_tier1');
    attachStepBehavior(wildShardsTier2Input, 60, 'wild_shards_tier2');
    attachStepBehavior(wildShardsTier3Input, 80, 'wild_shards_tier3');
    attachStepBehavior(wildShardsTier4Input, 100, 'wild_shards_tier4');
    
    const submitBtn = Button('Ajouter le champion', handleSubmit, 'primary');
    const cancelBtn = Button('Annuler', () => {
        window.location.hash = '#/champions';
    }, 'secondary');
    
    const content = createElement('div', {}, [
        PageHeader('Ajouter un champion', 'Créer un nouveau champion personnalisé'),
        Card('Informations du champion', [
            createElement('div', { className: 'form-group' }, [
                createElement('label', { className: 'form-label' }, ['Filtre région (PoC)']),
                pocRegionFilterSelect
            ]),
            createElement('div', { className: 'form-group' }, [
                createElement('label', { className: 'form-label' }, ['Champion (PoC)']),
                championSelect
            ]),
            createElement('div', { className: 'form-row', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' } }, [
                costInput,
                createElement('div', {}, [
                    createElement('label', { className: 'form-label' }, ['Région']),
                    regionSelect
                ])
            ]),
            createElement('div', { className: 'form-row', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' } }, [
                pocInput,
                createElement('div', { className: 'form-group' }, [
                    createElement('label', { className: 'form-label' }, ['Étoiles']),
                    createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' } }, [
                        starsCurrentInput,
                        createElement('span', { style: { fontSize: '1.5rem', fontWeight: 'bold' } }, ['/']),
                        starsMaxInput
                    ])
                ])
            ])
        ]),
        Card('Ressources du champion', [
            createElement('label', { className: 'form-label', style: { marginTop: '0' } }, ['Wild Shards par palier']),
            createElement('div', { className: 'form-row', style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' } }, [
                wildShardsTier1Input,
                wildShardsTier2Input,
                wildShardsTier3Input,
                wildShardsTier4Input
            ]),
            createElement('div', { style: { marginTop: '0.5rem', marginBottom: '0.75rem' } }, [
                createElement('label', { className: 'form-label' }, ['Wild Shards total']),
                createElement('div', {}, [
                    (wildShardsTotalSpan = createElement('span', {}, ['0']))
                ])
            ]),
            createElement('label', { className: 'form-label', style: { marginTop: '0.25rem' } }, ['Star Crystal par palier']),
            createElement('div', { className: 'form-row', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' } }, [
                starCrystalTier1Input,
                starCrystalTier2Input
            ]),
            createElement('div', { style: { marginTop: '0.5rem', marginBottom: '0.75rem' } }, [
                createElement('label', { className: 'form-label' }, ['Star Crystal total']),
                createElement('div', {}, [
                    (starCrystalTotalSpan = createElement('span', {}, ['0']))
                ])
            ]),
            createElement('label', { className: 'form-label', style: { marginTop: '0.25rem' } }, ['Gemstones par palier']),
            createElement('div', { className: 'form-row', style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' } }, [
                gemTier1Input,
                gemTier2Input,
                gemTier3Input,
                gemTier4Input
            ]),
            createElement('div', { style: { marginTop: '0.5rem', marginBottom: '0.75rem' } }, [
                createElement('label', { className: 'form-label' }, ['Gemstone total']),
                createElement('div', {}, [
                    (gemstoneTotalSpan = createElement('span', {}, ['0']))
                ])
            ]),
            createElement('div', { className: 'form-row', style: { display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' } }, [
                novaCrystalInput
            ])
        ]),
        createElement('div', { style: { display: 'flex', gap: '1rem', marginTop: '1rem' } }, [
            submitBtn,
            cancelBtn
        ])
    ]);

    // Initialize totals to reflect defaults
    updateTotals();
    
    return content;
}



