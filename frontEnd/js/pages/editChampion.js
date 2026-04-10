import { createElement, formatRegionName } from '../ui.js';
import { applyComputedRegionTotals } from '../calc.js';
import { PageHeader, Card, Button } from '../components/layout.js';
import {
  buildMainAppChampion,
  getRegionStarsMax,
  isSpiritWorldRegion,
  removeChampionFromAppState,
  removeChampionFromBaseData,
  resolveChampionForEdit,
  upsertChampionInAppState,
  upsertChampionInBaseData
} from '../championState.js';

export function EditChampionPage(appState, baseData, region, championName, updateState) {
  const champion = resolveChampionForEdit(appState, baseData, region, championName);
  
  if (!champion) {
    const errorMessage = createElement('div', { style: { padding: '20px' } }, [
      createElement('p', {}, [`Le champion "${championName}" n'a pas été trouvé dans la région ${region}.`]),
      createElement('a', { href: '#/champions', className: 'button' }, ['Retour à la liste'])
    ]);
    
    return createElement('div', {}, [
      PageHeader('Champion introuvable'),
      errorMessage
    ]);
  }
  
  const formData = {
    originalRegion: region,
    originalName: championName,
    region: region,
    name: championName,
    cost: champion.cost || 0,
    stars_current: champion.stars || 0,
    stars_max: getRegionStarsMax(region),
    poc: champion.poc || 0,
    nova_crystal: champion.resources?.nova_crystal || 0,
    star_crystal_tier1: champion.resources?.star_crystal_tiers?.[0] || 0,
    star_crystal_tier2: champion.resources?.star_crystal_tiers?.[1] || 0,
    star_crystal_tier3: champion.resources?.star_crystal_tiers?.[2] || 0,
    star_crystal_tier1_region: champion.resources?.star_crystal_tier1_region || '',
    gemstone_tier1: champion.resources?.gemstone_tiers?.[0] || 0,
    gemstone_tier2: champion.resources?.gemstone_tiers?.[1] || 0,
    gemstone_tier3: champion.resources?.gemstone_tiers?.[2] || 0,
    gemstone_tier4: champion.resources?.gemstone_tiers?.[3] || 0,
    wild_shards_tier1: champion.resources?.wild_shards_tiers?.[0] || 0,
    wild_shards_tier2: champion.resources?.wild_shards_tiers?.[1] || 0,
    wild_shards_tier3: champion.resources?.wild_shards_tiers?.[2] || 0,
    wild_shards_tier4: champion.resources?.wild_shards_tiers?.[3] || 0,
  };

  const defaultGemstoneOptions = {
    tier1: [0, 150, 100, 200],
    tier2: [0, 250, 200],
    tier3: [0, 250, 300],
    tier4: [0, 350, 400]
  };

  const spiritWorldGemstoneOptions = {
    tier1: [0, 100],
    tier2: [0, 200],
    tier3: [0, 250],
    tier4: [0, 350]
  };

  function getGemstoneOptionsForRegion(regionName) {
    return isSpiritWorldRegion(regionName) ? spiritWorldGemstoneOptions : defaultGemstoneOptions;
  }

  function getWildShardConfigForRegion(regionName) {
    if (regionName === 'Spirit World') {
      return {
        defaults: [800, 10, 60, 80],
        steps: [100, 10, 60, 80]
      };
    }
    return {
      defaults: [40, 60, 80, 100],
      steps: [40, 60, 80, 100]
    };
  }

  function buildGemstoneOptionsHTML(options, selectedValue) {
    return options.map((val) => (
      `<option value="${val}" ${selectedValue === val ? 'selected' : ''}>${val}</option>`
    )).join('');
  }

  const starCrystalConfig = {
    spiritWorld: {
      defaults: [40, 10, 50],
      steps: [20, 10, 50]
    },
    standard: {
      defaults: [10, 40, 0],
      steps: [10, 40, 10]
    }
  };

  function getStarCrystalConfigForRegion(regionName) {
    return regionName === 'Spirit World' ? starCrystalConfig.spiritWorld : starCrystalConfig.standard;
  }

  const starCrystalConfigForRegion = getStarCrystalConfigForRegion(region);
  const otherRegions = Object.keys(baseData.regions).filter(r => r !== 'Spirit World');

  const gemstoneOptions = getGemstoneOptionsForRegion(region);
  
  // Create form fields HTML
  const formHTML = `
    <div style="max-width: 1200px; margin: 0 auto;">
      <form id="editChampionForm">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Informations de base</h3></div>
          <div style="padding: 20px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Nom</label>
                <input type="text" id="name" value="${championName}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required />
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Coût</label>
                <input type="number" id="cost" value="${formData.cost}" min="0" step="1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Région</label>
                <select id="region" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                  ${Object.keys(baseData.regions).map(r => `<option value="${r}" ${r === region ? 'selected' : ''}>${formatRegionName(r)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">PoC</label>
                <input type="number" id="poc" value="${formData.poc}" min="0" max="1" step="1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Étoiles (Actuel/Max)</label>
                <div style="display: flex; gap: 5px; align-items: center;">
                  <input type="number" id="stars_current" value="${formData.stars_current}" min="0" max="${formData.stars_max}" step="1" style="width: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
                  <span>/</span>
                  <input type="number" id="stars_max" value="${formData.stars_max}" min="0" max="${formData.stars_max}" step="1" style="width: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card" style="margin-top: 20px;">
          <div class="card-header"><h3 class="card-title">Ressources</h3></div>
          <div style="padding: 20px;">
            <label style="display: block; margin-top: 0; margin-bottom: 5px; font-weight: 500;">Wild Shards par palier</label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 15px;">
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Palier 1</label>
                <input type="number" id="wild_shards_tier1" value="${formData.wild_shards_tier1}" min="0" step="40" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Palier 2</label>
                <input type="number" id="wild_shards_tier2" value="${formData.wild_shards_tier2}" min="0" step="60" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Palier 3</label>
                <input type="number" id="wild_shards_tier3" value="${formData.wild_shards_tier3}" min="0" step="80" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Palier 4</label>
                <input type="number" id="wild_shards_tier4" value="${formData.wild_shards_tier4}" min="0" step="100" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
              </div>
            </div>
            <h4 style="margin: 15px 0 10px 0;">Star Crystal</h4>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px;">
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Palier 1</label>
                <input type="number" id="star_crystal_tier1" value="${formData.star_crystal_tier1}" min="0" step="${starCrystalConfigForRegion.steps[0]}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Palier 2</label>
                <input type="number" id="star_crystal_tier2" value="${formData.star_crystal_tier2}" min="0" step="${starCrystalConfigForRegion.steps[1]}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
              </div>
              <div id="star_crystal_tier3_wrapper" style="${region === 'Spirit World' ? '' : 'display: none;'}">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Palier 3</label>
                <input type="number" id="star_crystal_tier3" value="${formData.star_crystal_tier3}" min="0" step="${starCrystalConfigForRegion.steps[2]}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
              </div>
            </div>
            <div id="star_crystal_tier1_region_wrapper" style="margin-bottom: 15px; ${region === 'Spirit World' ? '' : 'display: none;'}">
              <label style="display: block; margin-bottom: 5px; font-weight: 500;">Région du palier 1</label>
              <select id="star_crystal_tier1_region" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                ${otherRegions.map(r => `<option value="${r}" ${formData.star_crystal_tier1_region === r ? 'selected' : ''}>${formatRegionName(r)}</option>`).join('')}
              </select>
            </div>
            <h4 style="margin: 15px 0 10px 0;">Gemstone</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 15px;">
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Palier 1</label>
                <select id="gemstone_tier1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                  ${buildGemstoneOptionsHTML(gemstoneOptions.tier1, formData.gemstone_tier1)}
                </select>
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Palier 2</label>
                <select id="gemstone_tier2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                  ${buildGemstoneOptionsHTML(gemstoneOptions.tier2, formData.gemstone_tier2)}
                </select>
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Palier 3</label>
                <select id="gemstone_tier3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                  ${buildGemstoneOptionsHTML(gemstoneOptions.tier3, formData.gemstone_tier3)}
                </select>
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Palier 4</label>
                <select id="gemstone_tier4" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                  ${buildGemstoneOptionsHTML(gemstoneOptions.tier4, formData.gemstone_tier4)}
                </select>
              </div>
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: 500;">Nova Crystal</label>
              <input type="number" id="nova_crystal" value="${formData.nova_crystal}" min="0" max="1" step="1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
          <button type="button" class="btn btn-secondary" onclick="window.location.hash = '#/champions'">Annuler</button>
        </div>
      </form>
    </div>
  `;
  
  const container = createElement('div');
  container.innerHTML = formHTML;
  
  // Handle form submission
  setTimeout(() => {
    const form = container.querySelector('#editChampionForm');
    if (form) {
      // Attach step snapping for numeric palier inputs
      function attachStepBehaviorEdit(selector, step) {
        const input = container.querySelector(selector);
        if (!input) return;
        input.setAttribute('step', String(step));
        input.addEventListener('change', (e) => {
          let val = Math.max(0, parseInt(e.target.value) || 0);
          val = Math.round(val / step) * step;
          e.target.value = val;
        });
      }

      function attachDynamicStepBehavior(selector) {
        const input = container.querySelector(selector);
        if (!input) return;
        input.addEventListener('change', (e) => {
          const step = parseInt(e.target.dataset.step) || 1;
          let val = Math.max(0, parseInt(e.target.value) || 0);
          val = Math.round(val / step) * step;
          e.target.value = val;
        });
      }

      attachDynamicStepBehavior('#star_crystal_tier1');
      attachDynamicStepBehavior('#star_crystal_tier2');
      attachDynamicStepBehavior('#star_crystal_tier3');

      function applyWildShardConfig(regionName) {
        const config = getWildShardConfigForRegion(regionName);
        const tierSelectors = [
          '#wild_shards_tier1',
          '#wild_shards_tier2',
          '#wild_shards_tier3',
          '#wild_shards_tier4'
        ];

        tierSelectors.forEach((selector, index) => {
          const input = container.querySelector(selector);
          if (!input) return;
          input.setAttribute('step', String(config.steps[index]));
        });
      }

      applyWildShardConfig(region);
      updateStarCrystalConfig(region);

      function updateGemstoneOptions(regionName) {
        const options = getGemstoneOptionsForRegion(regionName);
        const selectConfigs = [
          { id: '#gemstone_tier1', values: options.tier1 },
          { id: '#gemstone_tier2', values: options.tier2 },
          { id: '#gemstone_tier3', values: options.tier3 },
          { id: '#gemstone_tier4', values: options.tier4 }
        ];

        selectConfigs.forEach(({ id, values }) => {
          const select = container.querySelector(id);
          if (!select) return;
          const current = parseInt(select.value) || 0;
          const nextValue = values.includes(current) ? current : 0;
          select.innerHTML = buildGemstoneOptionsHTML(values, nextValue);
          select.value = String(nextValue);
        });
      }

      function updateStarCrystalConfig(regionName) {
        const config = getStarCrystalConfigForRegion(regionName);
        const isSpiritWorld = regionName === 'Spirit World';
        const tier3Wrapper = container.querySelector('#star_crystal_tier3_wrapper');
        const tier1RegionWrapper = container.querySelector('#star_crystal_tier1_region_wrapper');
        const tier1RegionSelect = container.querySelector('#star_crystal_tier1_region');

        const tierInputs = [
          container.querySelector('#star_crystal_tier1'),
          container.querySelector('#star_crystal_tier2'),
          container.querySelector('#star_crystal_tier3')
        ];

        tierInputs.forEach((input, index) => {
          if (!input) return;
          input.setAttribute('step', String(config.steps[index]));
          input.dataset.step = String(config.steps[index]);
          if (!isSpiritWorld && index === 2) {
            input.value = '0';
          }
        });

        if (tier3Wrapper) tier3Wrapper.style.display = isSpiritWorld ? '' : 'none';
        if (tier1RegionWrapper) tier1RegionWrapper.style.display = isSpiritWorld ? '' : 'none';
        if (tier1RegionSelect && isSpiritWorld) {
          if (!tier1RegionSelect.value && otherRegions.length > 0) {
            tier1RegionSelect.value = otherRegions[0];
          }
        }
        if (tier1RegionSelect && !isSpiritWorld) {
          tier1RegionSelect.value = '';
        }
      }

      const regionSelect = container.querySelector('#region');
      const starsCurrentInput = container.querySelector('#stars_current');
      const starsMaxInput = container.querySelector('#stars_max');

      function updateStarsMax(regionName) {
        const maxStars = getRegionStarsMax(regionName);
        if (starsCurrentInput) {
          starsCurrentInput.setAttribute('max', String(maxStars));
          const currentVal = parseInt(starsCurrentInput.value) || 0;
          if (currentVal > maxStars) starsCurrentInput.value = String(maxStars);
        }
        if (starsMaxInput) {
          starsMaxInput.setAttribute('max', String(maxStars));
          const maxVal = parseInt(starsMaxInput.value) || 0;
          if (maxVal !== maxStars) starsMaxInput.value = String(maxStars);
        }
      }

      if (regionSelect) {
        regionSelect.addEventListener('change', (e) => {
          updateStarsMax(e.target.value);
          applyWildShardConfig(e.target.value);
          updateStarCrystalConfig(e.target.value);
          updateGemstoneOptions(e.target.value);
        });
      }

      form.addEventListener('submit', (e) => {
        e.preventDefault();

        const newRegion = container.querySelector('#region').value;
        const newName = container.querySelector('#name').value.trim();
        
        if (!newName) {
          alert('Le nom du champion est requis.');
          return;
        }
        
        // Collect form data
        const starCrystalTiers = [
          parseInt(container.querySelector('#star_crystal_tier1').value) || 0,
          parseInt(container.querySelector('#star_crystal_tier2').value) || 0,
          parseInt(container.querySelector('#star_crystal_tier3')?.value) || 0
        ];
        const starCrystalTotal = starCrystalTiers.reduce((sum, tier) => sum + tier, 0);
        const starCrystalTier1Region = container.querySelector('#star_crystal_tier1_region')?.value || '';
        
        const gemstoneTiers = [
          parseInt(container.querySelector('#gemstone_tier1').value) || 0,
          parseInt(container.querySelector('#gemstone_tier2').value) || 0,
          parseInt(container.querySelector('#gemstone_tier3').value) || 0,
          parseInt(container.querySelector('#gemstone_tier4').value) || 0
        ];
        const gemstoneTotal = gemstoneTiers.reduce((sum, tier) => sum + tier, 0);
        
        const wildShardsTiers = [
          parseInt(container.querySelector('#wild_shards_tier1').value) || 0,
          parseInt(container.querySelector('#wild_shards_tier2').value) || 0,
          parseInt(container.querySelector('#wild_shards_tier3').value) || 0,
          parseInt(container.querySelector('#wild_shards_tier4').value) || 0
        ];
        const wildShardsTotal = wildShardsTiers.reduce((sum, tier) => sum + tier, 0);
        
        const updatedChampion = buildMainAppChampion({
          name: newName,
          cost: parseInt(container.querySelector('#cost').value) || 0,
          stars: parseInt(container.querySelector('#stars_current').value) || 0,
          poc: parseInt(container.querySelector('#poc').value) || 0,
          regionName: newRegion,
          source: champion.source === 'custom' ? 'custom' : 'modified',
          resources: {
            nova_crystal: parseInt(container.querySelector('#nova_crystal').value) || 0,
            star_crystal_tiers: starCrystalTiers,
            star_crystal_total: starCrystalTotal,
            star_crystal_tier1_region: starCrystalTier1Region,
            gemstone_tiers: gemstoneTiers,
            gemstone_total: gemstoneTotal,
            wild_shards_tiers: wildShardsTiers,
            wild_shards_total: wildShardsTotal
          }
        });

        if (formData.originalRegion !== newRegion || formData.originalName !== newName) {
          removeChampionFromBaseData(baseData, formData.originalRegion, formData.originalName);
          removeChampionFromAppState(appState, formData.originalRegion, formData.originalName);
        }

        upsertChampionInBaseData(baseData, newRegion, updatedChampion);
        upsertChampionInAppState(appState, newRegion, updatedChampion);
      
      applyComputedRegionTotals(baseData);
      // Save state
      updateState(appState);
      
      alert(`Champion "${newName}" mis à jour avec succès!`);
      window.location.hash = '#/champions';
    });
    }
  }, 0);
  
  return createElement('div', {}, [
    PageHeader(`Éditer : ${championName}`),
    container
  ]);
}
