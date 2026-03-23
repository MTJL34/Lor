import { Champion } from "../data/Champion.js";
import { Region } from "../data/Region.js";
import { Level } from "../data/Level.js";
import { AllRelics } from "../data/Relics.js";
import { Constellation_Number } from "../data/Constellation_Number.js";
import { Cost } from "../data/Cost.js";
import { Stars } from "../data/Stars.js";

const toNum = (v) => Number(v) || 0;
const getLevelClass = (levelValue) => {
  const level = Number(levelValue);
  if (!Number.isFinite(level)) return "";
  if (level < 40) return "level-low";
  if (level < 50) return "level-mid";
  return "level-high";
};

let html = ``;

html += `
<section>
    <h2>Champions</h2>
    <div class="actions">
      <button type="button" id="copyChampionsBtn">Copier champions</button>
      <button type="button" id="addChampionBtn">Ajouter champion</button>
    </div>
    <div id="addChampionPanel" class="add-champion-panel" style="display:none; margin: 12px 0;">
      <h3>Ajouter un champion</h3>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; align-items:end;">
        <label>Nom
          <input type="text" id="addChampionName" placeholder="Nom du champion" />
        </label>
        <label>Cost_ID
          <select id="addChampionCost"></select>
        </label>
        <label>Region_ID
          <select id="addChampionRegion"></select>
        </label>
        <label>Stars_ID
          <select id="addChampionStars"></select>
        </label>
        <label>Constellation_Number_ID
          <select id="addChampionConstellation"></select>
        </label>
        <label>Level_ID
          <select id="addChampionLevel"></select>
        </label>
        <label>Champion_Icon
          <input type="text" id="addChampionIcon" placeholder="URL/chemin ou vide" />
        </label>
        <label>Relique 1
          <select id="addChampionRelic1"></select>
        </label>
        <label>Relique 2
          <select id="addChampionRelic2"></select>
        </label>
        <label>Relique 3
          <select id="addChampionRelic3"></select>
        </label>
        <label style="display:flex; gap:6px; align-items:center;">
          <input type="checkbox" id="addChampionPoc" />
          POC
        </label>
        <label style="display:flex; gap:6px; align-items:center;">
          <input type="checkbox" id="addChampionExclusive" />
          LOR_Exclusive
        </label>
      </div>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button type="button" id="addChampionSubmitBtn">Valider</button>
        <button type="button" id="addChampionCancelBtn">Annuler</button>
      </div>
    </div>
    <div class="filters">
      <label>
        POC
        <select id="filterPoc">
          <option value="all">Tous</option>
          <option value="poc">PoC</option>
          <option value="nonpoc">Hors PoC</option>
        </select>
      </label>
      <label>
        Region
        <select id="filterRegion">
          <option value="all">Toutes</option>
        </select>
      </label>
      <label>
        Cout
        <select id="filterCost">
          <option value="all">Tous</option>
        </select>
      </label>
    </div>
    <table id="championsTable">
        <thead>
            <tr>
                <th>Nom</th>
                <th>Cout</th>
                <th>Region</th>
                <th>POC</th>
                <th>Stars</th>
                <th>Constellation</th>
                <th>Niveau</th>
                <th>Niveau Manquant</th>
                <th>Reliques</th>
                <th>Editer</th>
            </tr>
        </thead>
        <tbody></tbody>
        <tfoot></tfoot>
    </table>
</section>
`;

document.querySelector(".js_content").innerHTML = html;

const tbody = document.querySelector("#championsTable tbody");
const copyChampionsBtn = document.getElementById("copyChampionsBtn");
const addChampionBtn = document.getElementById("addChampionBtn");
const addChampionPanel = document.getElementById("addChampionPanel");
const addChampionNameInput = document.getElementById("addChampionName");
const addChampionCostSelect = document.getElementById("addChampionCost");
const addChampionRegionSelect = document.getElementById("addChampionRegion");
const addChampionStarsSelect = document.getElementById("addChampionStars");
const addChampionConstellationSelect = document.getElementById("addChampionConstellation");
const addChampionLevelSelect = document.getElementById("addChampionLevel");
const addChampionIconInput = document.getElementById("addChampionIcon");
const addChampionRelic1Select = document.getElementById("addChampionRelic1");
const addChampionRelic2Select = document.getElementById("addChampionRelic2");
const addChampionRelic3Select = document.getElementById("addChampionRelic3");
const addChampionPocCheckbox = document.getElementById("addChampionPoc");
const addChampionExclusiveCheckbox = document.getElementById("addChampionExclusive");
const addChampionSubmitBtn = document.getElementById("addChampionSubmitBtn");
const addChampionCancelBtn = document.getElementById("addChampionCancelBtn");
const filterPoc = document.getElementById("filterPoc");
const filterRegion = document.getElementById("filterRegion");
const filterCost = document.getElementById("filterCost");

const starsById = new Map(Stars.map(star => [star.Stars_ID, star]));
const constellationById = new Map(
  Constellation_Number.map(cn => [cn.Constellation_ID, cn])
);
const levelById = new Map(Level.map(level => [level.Level_ID, level]));
const relicOptions = AllRelics.filter(relic => relic.Relic_ID && relic.Relic_ID !== 0);
const customChampions = [];
const CHAMPION_FIELD_ORDER = [
  "Champion_ID",
  "Champion_Name",
  "Cost_ID",
  "POC",
  "Champion_Icon",
  "Stars_ID",
  "LOR_Exclusive",
  "Constellation_Number_ID",
  "Level_ID",
  "Region_ID",
  "AllRelics"
];

// Keep PoC overrides in memory only. The page currently resets them on every load
// anyway, and avoiding localStorage prevents iframe/storage security errors.
function saveOverrides() {
  return true;
}

const overrides = {};
const editingRows = new Set();
const filters = {
  poc: "all",
  region: "all",
  cost: "all"
};

function compareChampionNames(a, b) {
  const nameA = String(a?.Champion_Name || "");
  const nameB = String(b?.Champion_Name || "");
  return nameA.localeCompare(nameB, "fr", { sensitivity: "base" });
}

function sortChampionsByName(champions) {
  return [...champions].sort(compareChampionNames);
}

function getAllChampions() {
  return Champion.concat(customChampions);
}

function getChampionById(champId) {
  return getAllChampions().find(c => c.Champion_ID === champId) || null;
}

function getDefaultId(list, key, fallback = 0) {
  const hasFallback = list.some(entry => entry[key] === fallback);
  if (hasFallback) return fallback;
  return list[0]?.[key] ?? fallback;
}

function populateSelectFromList(selectEl, list, idKey, labelKey) {
  if (!selectEl) return;
  selectEl.innerHTML = list
    .map(item => `<option value="${item[idKey]}">${item[idKey]}: ${item[labelKey]}</option>`)
    .join("");
}

function populateRelicSelect(selectEl) {
  if (!selectEl) return;
  const options = [
    '<option value="0">0: Aucune</option>',
    ...relicOptions.map(relic => `<option value="${relic.Relic_ID}">${relic.Relic_ID}: ${relic.Relic_Name}</option>`)
  ];
  selectEl.innerHTML = options.join("");
}

function normalizeRelicValue(rawValue) {
  return rawValue === "0" ? 0 : rawValue;
}

function resetAddChampionForm() {
  if (!addChampionNameInput) return;
  addChampionNameInput.value = "";
  addChampionIconInput.value = "";
  addChampionPocCheckbox.checked = false;
  addChampionExclusiveCheckbox.checked = false;

  addChampionCostSelect.value = String(getDefaultId(Cost, "Cost_ID", 0));
  addChampionRegionSelect.value = String(getDefaultId(Region, "Region_ID", 13));
  addChampionStarsSelect.value = String(getDefaultId(Stars, "Stars_ID", 0));
  addChampionConstellationSelect.value = String(getDefaultId(Constellation_Number, "Constellation_ID", 1));
  addChampionLevelSelect.value = String(getDefaultId(Level, "Level_ID", 1));
  addChampionRelic1Select.value = "0";
  addChampionRelic2Select.value = "0";
  addChampionRelic3Select.value = "0";
}

function initializeAddChampionForm() {
  populateSelectFromList(addChampionCostSelect, Cost, "Cost_ID", "Cost_Value");
  populateSelectFromList(addChampionRegionSelect, Region, "Region_ID", "Region_Name");
  populateSelectFromList(addChampionStarsSelect, Stars, "Stars_ID", "Stars_Value");
  populateSelectFromList(addChampionConstellationSelect, Constellation_Number, "Constellation_ID", "Constellation_Value");
  populateSelectFromList(addChampionLevelSelect, Level, "Level_ID", "Actual_Level");
  populateRelicSelect(addChampionRelic1Select);
  populateRelicSelect(addChampionRelic2Select);
  populateRelicSelect(addChampionRelic3Select);
  resetAddChampionForm();
}

function createChampionTemplate(values = {}) {
  return {
    Champion_ID: Number(values.Champion_ID) || 0,
    Champion_Name: String(values.Champion_Name || ""),
    Cost_ID: Number(values.Cost_ID) || 0,
    POC: Boolean(values.POC),
    Champion_Icon: String(values.Champion_Icon || ""),
    Stars_ID: Number(values.Stars_ID) || 0,
    LOR_Exclusive: Boolean(values.LOR_Exclusive),
    Constellation_Number_ID: Number(values.Constellation_Number_ID) || 1,
    Level_ID: Number(values.Level_ID) || 1,
    Region_ID: Number(values.Region_ID) || 13,
    AllRelics: Array.isArray(values.AllRelics) ? values.AllRelics : [0, 0, 0]
  };
}

function populateFilters() {
  if (filterRegion) {
    const regionOptions = Region
      .filter(region => region.Region_ID !== undefined && region.Region_ID !== null)
      .map(region => ({
        id: region.Region_ID,
        name: region.Region_Name
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const regionHtml = regionOptions
      .map(region => `<option value="${region.id}">${region.name}</option>`)
      .join("");
    filterRegion.insertAdjacentHTML("beforeend", regionHtml);
  }

  if (filterCost) {
    const costOptions = Cost
      .filter(cost => cost.Cost_ID !== undefined && cost.Cost_ID !== null)
      .map(cost => ({
        id: cost.Cost_ID,
        value: cost.Cost_Value
      }))
      .sort((a, b) => Number(a.value) - Number(b.value));

    const costHtml = costOptions
      .map(cost => `<option value="${cost.id}">${cost.value}</option>`)
      .join("");
    filterCost.insertAdjacentHTML("beforeend", costHtml);
  }
}

function applyFilters(champions) {
  return champions.filter(champion => {
    if (filters.poc === "poc" && !champion.POC) return false;
    if (filters.poc === "nonpoc" && champion.POC) return false;
    if (filters.region !== "all" && String(champion.Region_ID) !== filters.region) return false;
    if (filters.cost !== "all" && String(champion.Cost_ID) !== filters.cost) return false;
    return true;
  });
}

function getEffectiveChampion(champion) {
  const override = overrides[champion.Champion_ID];
  return override ? { ...champion, ...override } : champion;
}

function formatOptionLabel(value) {
  if (value === "" || value === null || value === undefined) return "-";
  return String(value);
}

function buildOptions(list, idKey, labelKey, currentId) {
  return list
    .map(item => {
      const id = item[idKey];
      const label = formatOptionLabel(item[labelKey]);
      const selected = id === currentId ? "selected" : "";
      return `<option value="${id}" ${selected}>${label}</option>`;
    })
    .join("");
}

function formatJsValue(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (value === null || value === undefined) return "null";
  return JSON.stringify(value);
}

function formatRelicsArray(values) {
  if (!Array.isArray(values)) return "[]";
  const parts = values.map(item => {
    if (typeof item === "string") return JSON.stringify(item);
    if (typeof item === "number") return String(item);
    return JSON.stringify(item);
  });
  return `[${parts.join(", ")}]`;
}

function buildChampionObjectBlock(champion) {
  const normalized = createChampionTemplate(champion);
  const lines = CHAMPION_FIELD_ORDER.map((key) => {
    if (key === "AllRelics") {
      return `    ${key}: ${formatRelicsArray(normalized[key])}`;
    }
    return `    ${key}: ${formatJsValue(normalized[key])}`;
  });
  return `  {\n${lines.join(",\n")}\n  }`;
}

function buildChampionsExport() {
  const champions = sortChampionsByName(getAllChampions().map(getEffectiveChampion)).map((champion, index) =>
    createChampionTemplate({
      ...champion,
      Champion_ID: index + 1
    })
  );
  const body = champions.map(buildChampionObjectBlock).join(",\n");

  return `export const Champion = [\n${body}\n];\n`;
}

function buildChampionFileExport() {
  const header = `import { Constellation_Number } from "./Constellation_Number.js";
import { Region } from "./Region.js";  
import { Level } from "./Level.js";
import { Cost } from "./Cost.js";
import { AllRelics } from "./Relics.js";
import { RelicsCommon } from "./Relics_Common.js";
import { RelicsRare } from "./Relics_Rare.js";
import { RelicsEpic } from "./Relics_Epic.js";
import { Stars } from "./Stars.js";

`;

  const footer = `
function getRelicsForChampion(relicIds = []) {
  return relicIds
    .map(id => AllRelics.find(relic => relic.AllRelics === id))
    .filter(Boolean);
}

export const ChampionsWithRelics = Champion.map(champion => ({
  ...champion,
  Relics: getRelicsForChampion(champion.AllRelics)
}));
`;

  return `${header}${buildChampionsExport()}\n${footer}`;
}

let activeRelicTarget = null;
let relicMenu = null;

function buildRelicMenuHtml() {
  const options = relicOptions.map(relic => {
    return `
      <button class="relic-option" type="button" data-relic-id="${relic.Relic_ID}">
        <img src="${relic.Relic_Icon}" alt="${relic.Relic_Name}" />
        <span class="relic-option-name">${relic.Relic_Name}</span>
        <span class="relic-option-rarity">${relic.Relic_Rarity}</span>
      </button>
    `;
  });

  options.unshift(`
    <button class="relic-option relic-option-empty" type="button" data-relic-id="0">
      <span class="relic-option-name">Aucune</span>
    </button>
  `);

  return `<div class="relic-menu-list">${options.join("")}</div>`;
}

function createRelicMenu() {
  const menu = document.createElement("div");
  menu.className = "relic-menu";
  menu.innerHTML = buildRelicMenuHtml();
  document.body.appendChild(menu);

  menu.addEventListener("click", (event) => {
    const option = event.target.closest(".relic-option");
    if (!option || !activeRelicTarget) return;

    const relicId = option.dataset.relicId;
    const { champId, slotIndex } = activeRelicTarget;
    const sourceChampion = getChampionById(champId);
    if (!sourceChampion) return;
    const current = getEffectiveChampion(sourceChampion);
    const nextRelics = Array.isArray(current.AllRelics)
      ? [...current.AllRelics]
      : [0, 0, 0];

    nextRelics[slotIndex] = relicId === "0" ? 0 : relicId;

    overrides[champId] = {
      ...(overrides[champId] || {}),
      AllRelics: nextRelics
    };

    saveOverrides(overrides);
    renderTable();
    closeRelicMenu();
  });

  return menu;
}

function openRelicMenu(targetEl, champId, slotIndex) {
  if (!relicMenu) {
    relicMenu = createRelicMenu();
  }

  activeRelicTarget = { champId, slotIndex };

  const rect = targetEl.getBoundingClientRect();
  relicMenu.style.left = `${rect.left + window.scrollX}px`;
  relicMenu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  relicMenu.style.minWidth = `${rect.width}px`;
  relicMenu.classList.add("open");
}

function closeRelicMenu() {
  if (!relicMenu) return;
  relicMenu.classList.remove("open");
  activeRelicTarget = null;
}

function renderTable() {
  tbody.innerHTML = "";

  const effectiveChampions = sortChampionsByName(getAllChampions().map(getEffectiveChampion));
  const visibleChampions = applyFilters(effectiveChampions);

  visibleChampions.forEach(champion => {
    const tr = document.createElement("tr");
    const isEditing = editingRows.has(champion.Champion_ID);

    const MyRegion = Region.find(r => r.Region_ID === champion.Region_ID);
    const MyLevel = levelById.get(champion.Level_ID);
    const MyCost = Cost.find(c => c.Cost_ID === champion.Cost_ID);
    const MyStars = starsById.get(champion.Stars_ID);
    const MyConstellation = constellationById.get(champion.Constellation_Number_ID);

    const relicSlotsHTML = champion.AllRelics.map((relicId, index) => {
      const relic = AllRelics.find(r => r.Relic_ID === relicId);
      const isEmpty = !relicId || relicId === 0 || !relic;
      const relicClass = isEmpty ? "empty" : relic.Relic_Rarity.toLowerCase();
      const relicName = isEmpty ? "-" : relic.Relic_Name;
      const relicIcon = isEmpty ? "" : relic.Relic_Icon;

      return `
        <div
          class="relic-slot ${relicClass}${isEditing ? "" : " relic-disabled"}"
          data-champion-id="${champion.Champion_ID}"
          data-field="AllRelics"
          data-index="${index}"
          title="Choisir une relique"
        >
          ${isEmpty ? "-" : `
            <img
              src="${relicIcon}"
              alt="${relicName}"
              width="32"
              height="32"
            />
            <span class="relic-name">${relicName}</span>
          `}
        </div>
      `;
    }).join("");

    tr.innerHTML = `
      <td>${champion.Champion_Name}</td>
      <td>
        ${isEditing ? `
          <select
            class="stat-select"
            data-champion-id="${champion.Champion_ID}"
            data-field="Cost_ID"
          >
            ${buildOptions(Cost, "Cost_ID", "Cost_Value", champion.Cost_ID)}
          </select>
        ` : `
          <span>${MyCost?.Cost_Value ?? ""}</span>
        `}
      </td>

      <td class="region-cell">
        ${isEditing ? `
          <select
            class="stat-select"
            data-champion-id="${champion.Champion_ID}"
            data-field="Region_ID"
          >
            ${buildOptions(Region, "Region_ID", "Region_Name", champion.Region_ID)}
          </select>
        ` : `
          ${MyRegion ? `
            <div class="region-content">
              ${champion.Region_ID !== 13 ? `
                <img
                  src="${MyRegion.Region_Icon}"
                  alt="${MyRegion.Region_Name}"
                  title="${MyRegion.Region_Name}"
                  class="region-icon"
                />
              ` : ""}
              <span class="region-name">${MyRegion.Region_Name}</span>
            </div>
          ` : ""}
        `}
      </td>

      <td class="poc-cell">
        ${isEditing ? `
          <input
            type="checkbox"
            class="stat-checkbox"
            data-champion-id="${champion.Champion_ID}"
            data-field="POC"
            ${champion.POC ? "checked" : ""}
          />
        ` : `
          ${champion.POC ? `<span class="poc-yes">&#x2705;</span>` : ""}
        `}
      </td>
      <td>
        ${isEditing ? `
          <select
            class="stat-select"
            data-champion-id="${champion.Champion_ID}"
            data-field="Stars_ID"
          >
            ${buildOptions(Stars, "Stars_ID", "Stars_Value", champion.Stars_ID)}
          </select>
        ` : `
          <span>${MyStars?.Stars_Value ?? ""}</span>
        `}
      </td>
      <td>
        ${isEditing ? `
          <select
            class="stat-select"
            data-champion-id="${champion.Champion_ID}"
            data-field="Constellation_Number_ID"
          >
            ${buildOptions(
              Constellation_Number,
              "Constellation_ID",
              "Constellation_Value",
              champion.Constellation_Number_ID
            )}
          </select>
        ` : `
          <span>${MyConstellation?.Constellation_Value ?? ""}</span>
        `}
      </td>
      <td>
        ${isEditing ? `
          <select
            class="stat-select"
            data-champion-id="${champion.Champion_ID}"
            data-field="Level_ID"
          >
            ${buildOptions(Level, "Level_ID", "Actual_Level", champion.Level_ID)}
          </select>
        ` : `
          <span class="${getLevelClass(MyLevel?.Actual_Level)}">${MyLevel?.Actual_Level ?? ""}</span>
        `}
      </td>
      <td>${MyLevel?.Level_Needed ?? ""}</td>

      <td>
        <div class="relic-editor">
          ${relicSlotsHTML}
        </div>
      </td>
      <td>
        <button
          type="button"
          class="edit-btn"
          data-champion-id="${champion.Champion_ID}"
        >
          ${isEditing ? "OK" : "Editer"}
        </button>
      </td>
    `;

    tr.dataset.editing = isEditing ? "1" : "0";
    tbody.appendChild(tr);
  });

  const championsPOC = visibleChampions.filter(c => c.POC);

  const totalPOC = championsPOC.length;

  const totalStars = championsPOC.reduce((sum, c) => {
    const stars = starsById.get(c.Stars_ID);
    return sum + (stars?.Stars_Value ?? 0);
  }, 0);

  const totalConstellations = championsPOC.reduce((sum, c) => {
    const constellation = constellationById.get(c.Constellation_Number_ID);
    return sum + toNum(constellation?.Constellation_Value);
  }, 0);

  const totalLevels = championsPOC.reduce((sum, c) => {
    const level = levelById.get(c.Level_ID);
    const actual = Number(level?.Actual_Level);
    return sum + (Number.isFinite(actual) ? actual : 0);
  }, 0);

  const totalMissingLevels = championsPOC.reduce((sum, c) => {
    const level = levelById.get(c.Level_ID);
    const missing = Number(level?.Level_Needed);
    return sum + (Number.isFinite(missing) ? missing : 0);
  }, 0);

  const tfoot = document.querySelector("#championsTable tfoot");
  tfoot.innerHTML = "";

const totalRow = document.createElement("tr");
totalRow.innerHTML = `
    <th class="total-label">TOTAL</th>
    <th></th>
    <th></th>
    <th>${totalPOC}</th>
    <th>${totalStars}</th>
    <th>${totalConstellations}</th>
    <th>${totalLevels}</th>
    <th>${totalMissingLevels}</th>
    <th></th>
    <th></th>
  `;

tfoot.appendChild(totalRow);
}

if (copyChampionsBtn) {
  copyChampionsBtn.addEventListener("click", async () => {
    const exportText = buildChampionFileExport();
    try {
      await navigator.clipboard.writeText(exportText);
      alert("Champions copiés dans le presse-papiers.");
    } catch (err) {
      const textarea = document.createElement("textarea");
      textarea.value = exportText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      alert("Champions copiés dans le presse-papiers.");
    }
  });
}

if (addChampionBtn) {
  addChampionBtn.addEventListener("click", () => {
    if (!addChampionPanel) return;
    const isOpen = addChampionPanel.style.display !== "none";
    if (isOpen) {
      addChampionPanel.style.display = "none";
      return;
    }
    resetAddChampionForm();
    addChampionPanel.style.display = "block";
    addChampionNameInput?.focus();
  });
}

if (addChampionCancelBtn) {
  addChampionCancelBtn.addEventListener("click", () => {
    if (!addChampionPanel) return;
    addChampionPanel.style.display = "none";
  });
}

if (addChampionSubmitBtn) {
  addChampionSubmitBtn.addEventListener("click", () => {
    const cleanedName = String(addChampionNameInput?.value || "").trim();
    if (!cleanedName) {
      alert("Le nom du champion est obligatoire.");
      return;
    }

    const alreadyExists = getAllChampions().some(
      champion => String(champion.Champion_Name || "").toLowerCase() === cleanedName.toLowerCase()
    );
    if (alreadyExists) {
      alert("Ce champion existe déjà.");
      return;
    }

    const nextChampionId = getAllChampions().reduce((maxId, champion) => {
      const id = Number(champion.Champion_ID) || 0;
      return Math.max(maxId, id);
    }, 0) + 1;

    const costId = Number(addChampionCostSelect?.value);
    const regionId = Number(addChampionRegionSelect?.value);
    const starsId = Number(addChampionStarsSelect?.value);
    const constellationId = Number(addChampionConstellationSelect?.value);
    const levelId = Number(addChampionLevelSelect?.value);
    const championIcon = String(addChampionIconInput?.value || "").trim();
    const poc = Boolean(addChampionPocCheckbox?.checked);
    const lorExclusive = Boolean(addChampionExclusiveCheckbox?.checked);

    if (!Number.isFinite(costId) || !Number.isFinite(regionId) || !Number.isFinite(starsId) || !Number.isFinite(constellationId) || !Number.isFinite(levelId)) {
      alert("Un ou plusieurs IDs sont invalides.");
      return;
    }

    const allRelics = [
      normalizeRelicValue(addChampionRelic1Select?.value || "0"),
      normalizeRelicValue(addChampionRelic2Select?.value || "0"),
      normalizeRelicValue(addChampionRelic3Select?.value || "0")
    ];

    customChampions.push(createChampionTemplate({
      Champion_ID: nextChampionId,
      Champion_Name: cleanedName,
      Cost_ID: costId,
      POC: poc,
      Champion_Icon: championIcon,
      Stars_ID: starsId,
      LOR_Exclusive: lorExclusive,
      Constellation_Number_ID: constellationId,
      Level_ID: levelId,
      Region_ID: regionId,
      AllRelics: allRelics
    }));

    if (addChampionPanel) addChampionPanel.style.display = "none";
    renderTable();
  });
}

if (filterPoc) {
  filterPoc.addEventListener("change", (event) => {
    filters.poc = event.target.value;
    renderTable();
  });
}

if (filterRegion) {
  filterRegion.addEventListener("change", (event) => {
    filters.region = event.target.value;
    renderTable();
  });
}

if (filterCost) {
  filterCost.addEventListener("change", (event) => {
    filters.cost = event.target.value;
    renderTable();
  });
}

tbody.addEventListener("change", (event) => {
  const target = event.target;
  const champId = Number(target?.dataset?.championId);
  const field = target?.dataset?.field;

  if (!champId || !field) return;

  const sourceChampion = getChampionById(champId);
  if (!sourceChampion) return;
  const current = getEffectiveChampion(sourceChampion);
  const nextOverride = { ...(overrides[champId] || {}) };

  if (field === "POC") {
    nextOverride.POC = Boolean(target.checked);
  } else if (field === "AllRelics") {
    const slotIndex = Number(target?.dataset?.index);
    const nextRelics = Array.isArray(current.AllRelics)
      ? [...current.AllRelics]
      : [0, 0, 0];
    nextRelics[slotIndex] = target.value === "0" ? 0 : target.value;
    nextOverride.AllRelics = nextRelics;
  } else {
    nextOverride[field] = Number(target.value) || 0;
  }

  overrides[champId] = nextOverride;

  saveOverrides(overrides);
  renderTable();
});

tbody.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const editBtn = event.target.closest(".edit-btn");
  if (!editBtn) return;

  const champId = Number(editBtn.dataset.championId);
  if (!champId) return;

  if (editingRows.has(champId)) {
    editingRows.delete(champId);
    closeRelicMenu();
  } else {
    editingRows.add(champId);
  }

  renderTable();
});

document.addEventListener("click", (event) => {
  if (!relicMenu || !relicMenu.classList.contains("open")) return;
  if (!(event.target instanceof Element)) return;
  if (event.target.closest(".relic-menu")) return;
  if (event.target.closest(".relic-slot")) return;
  closeRelicMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeRelicMenu();
});

tbody.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const target = event.target.closest(".relic-slot");
  if (!target) return;

  const row = target.closest("tr");
  if (!row || row.dataset.editing !== "1") return;

  const champId = Number(target.dataset.championId);
  const field = target.dataset.field;
  const slotIndex = Number(target.dataset.index);

  if (!champId || field !== "AllRelics") return;
  if (!relicOptions.length) return;

  openRelicMenu(target, champId, slotIndex);
});

populateFilters();
initializeAddChampionForm();
renderTable();



