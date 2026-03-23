import { RelicsCommon } from "../data/Relics_Common.js";
import { RelicsRare } from "../data/Relics_Rare.js";
import { RelicsEpic } from "../data/Relics_Epic.js";
import { addCustomRelic, getCustomRelics } from "./pocSharedState.js";

const container = document.getElementById("relics-container");
const RARITY_ORDER = ["Common", "Rare", "Epic"];
const RARITY_FILTERS = [
  { value: "all", label: "Toutes", tone: "all" },
  { value: "common", label: "Common", tone: "common" },
  { value: "rare", label: "Rare", tone: "rare" },
  { value: "epic", label: "Epic", tone: "epic" }
];
const BASE_RELICS_BY_RARITY = {
  Common: RelicsCommon.filter(isRealRelic),
  Rare: RelicsRare.filter(isRealRelic),
  Epic: RelicsEpic.filter(isRealRelic)
};

const state = {
  filter: "all",
  addPanelOpen: false,
  form: createEmptyRelicForm()
};

function isRealRelic(relic) {
  return Boolean(relic && relic.Relic_ID && relic.Relic_ID !== 0);
}

function createEmptyRelicForm() {
  return {
    name: "",
    rarity: "Rare",
    description: "",
    icon: ""
  };
}

function normalizeRarity(rarity) {
  const value = String(rarity || "").trim().toLowerCase();
  if (value === "common") return "Common";
  if (value === "epic") return "Epic";
  return "Rare";
}

function getRarityTone(rarity) {
  return normalizeRarity(rarity).toLowerCase();
}

function getDefaultIconForRarity(rarity) {
  return BASE_RELICS_BY_RARITY[normalizeRarity(rarity)][0]?.Relic_Icon || "";
}

function getRelicsForRarity(rarity, customRelics = getCustomRelics()) {
  const normalized = normalizeRarity(rarity);
  return [
    ...BASE_RELICS_BY_RARITY[normalized],
    ...customRelics.filter(relic => normalizeRarity(relic.Relic_Rarity) === normalized)
  ];
}

function generateNextRelicId(rarity, customRelics = getCustomRelics()) {
  const normalized = normalizeRarity(rarity);
  const prefix = `${normalized}_`;
  const maxNumericId = getRelicsForRarity(normalized, customRelics).reduce((maxId, relic) => {
    const match = String(relic.Relic_ID || "").match(/_(\d+)$/);
    const numericId = match ? Number(match[1]) : 0;
    return Math.max(maxId, numericId);
  }, 0);

  return `${prefix}${maxNumericId + 1}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildRaritySwitch(selectedValue, target) {
  const options = target === "filter"
    ? RARITY_FILTERS
    : RARITY_FILTERS.filter(option => option.value !== "all");

  return `
    <div class="rarity-switch${target === "form" ? " form" : ""}">
      ${options.map((option) => `
        <button
          type="button"
          class="rarity-filter-btn${selectedValue === option.value ? " is-active" : ""}"
          data-rarity-target="${target}"
          data-rarity-value="${option.value}"
          aria-pressed="${selectedValue === option.value ? "true" : "false"}"
        >
          <span class="rarity-chip-dot ${option.tone}"></span>
          <span>${option.label}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function buildRelicPreview(customRelics) {
  const rarity = normalizeRarity(state.form.rarity);
  const previewIcon = state.form.icon.trim() || getDefaultIconForRarity(rarity);
  const previewId = generateNextRelicId(rarity, customRelics);
  const previewName = state.form.name.trim() || "Nouvelle relique";
  const previewDescription = state.form.description.trim() || "Description de la relique";

  return `
    <div class="relic-preview-card ${getRarityTone(rarity)}">
      <div class="relic-preview-header">
        <span class="relic-source-badge custom">Preview</span>
        <span class="relic-preview-id"><code>${escapeHtml(previewId)}</code></span>
      </div>
      <div class="relic-preview-body">
        <img src="${escapeHtml(previewIcon)}" alt="${escapeHtml(previewName)}" width="64" height="64">
        <div class="relic-preview-text">
          <h4>${escapeHtml(previewName)}</h4>
          <p>${escapeHtml(previewDescription)}</p>
        </div>
      </div>
    </div>
  `;
}

function buildAddPanel(customRelics) {
  if (!state.addPanelOpen) return "";

  return `
    <section class="relic-add-panel">
      <div class="relic-add-panel-header">
        <div>
          <h3>Ajouter une relique</h3>
          <p>Choisis une qualite, puis complete les informations de la relique.</p>
        </div>
      </div>
      <div class="relic-add-layout">
        <div class="relic-form-grid">
          <label class="relic-form-field">
            <span>Nom</span>
            <input
              type="text"
              data-form-field="name"
              value="${escapeHtml(state.form.name)}"
              placeholder="Nom de la relique"
            />
          </label>
          <div class="relic-form-field">
            <span>Qualite</span>
            ${buildRaritySwitch(getRarityTone(state.form.rarity), "form")}
          </div>
          <label class="relic-form-field relic-form-field-wide">
            <span>Description</span>
            <textarea
              rows="4"
              data-form-field="description"
              placeholder="Effet ou description"
            >${escapeHtml(state.form.description)}</textarea>
          </label>
          <label class="relic-form-field relic-form-field-wide">
            <span>Icone</span>
            <input
              type="text"
              data-form-field="icon"
              value="${escapeHtml(state.form.icon)}"
              placeholder="URL de l'icone (optionnel)"
            />
          </label>
          <div class="relic-form-hint">
            <strong>ID genere:</strong> <code>${escapeHtml(generateNextRelicId(state.form.rarity, customRelics))}</code>
          </div>
          <div class="relic-form-actions">
            <button type="button" id="submitAddRelicBtn">Valider</button>
            <button type="button" class="secondary" id="cancelAddRelicBtn">Annuler</button>
          </div>
        </div>
        ${buildRelicPreview(customRelics)}
      </div>
    </section>
  `;
}

function buildRelicSections(customRelics) {
  const customRelicIds = new Set(customRelics.map(relic => relic.Relic_ID));
  const raritiesToRender = state.filter === "all"
    ? RARITY_ORDER
    : [normalizeRarity(state.filter)];

  return raritiesToRender.map((rarity) => {
    const tone = getRarityTone(rarity);
    const relics = getRelicsForRarity(rarity, customRelics);

    const rows = relics.map((relic) => {
      const description = relic.Relic_Description || "-";
      const source = customRelicIds.has(relic.Relic_ID) ? "Custom" : "Base";
      const sourceTone = source === "Custom" ? "custom" : "base";

      return `
        <tr>
          <td>
            <img
              src="${escapeHtml(relic.Relic_Icon)}"
              alt="${escapeHtml(relic.Relic_Name)}"
              width="64"
              height="64"
            >
          </td>
          <td><code>${escapeHtml(relic.Relic_ID)}</code></td>
          <td>${escapeHtml(relic.Relic_Name)}</td>
          <td class="relic-description-cell">${escapeHtml(description)}</td>
          <td><span class="relic-source-badge ${sourceTone}">${source}</span></td>
        </tr>
      `;
    }).join("");

    const body = rows || `
      <tr>
        <td colspan="5" class="relic-empty-state">Aucune relique pour cette qualite.</td>
      </tr>
    `;

    return `
      <section class="relic-section ${tone}">
        <div class="relic-section-header">
          <h3>${escapeHtml(rarity)} Relics</h3>
          <span class="relic-count-badge">${relics.length}</span>
        </div>
        <table class="relic-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>ID</th>
              <th>Nom</th>
              <th>Description</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </section>
    `;
  }).join("");
}

function render() {
  if (!container) return;

  const customRelics = getCustomRelics();
  const customCount = customRelics.length;

  container.innerHTML = `
    <div class="relics-toolbar">
      <div class="relics-toolbar-main">
        ${buildRaritySwitch(state.filter, "filter")}
        <span class="relic-toolbar-count">${customCount} relique${customCount > 1 ? "s" : ""} custom</span>
      </div>
      <div class="relics-toolbar-actions">
        <button type="button" id="toggleAddRelicBtn">${state.addPanelOpen ? "Fermer l'ajout" : "Ajouter une relique"}</button>
      </div>
    </div>
    ${buildAddPanel(customRelics)}
    ${buildRelicSections(customRelics)}
  `;
}

function syncFormField(target) {
  const field = target.dataset.formField;
  if (!field) return;
  state.form[field] = target.value;
}

function handleAddRelic() {
  const name = state.form.name.trim();
  const rarity = normalizeRarity(state.form.rarity);
  const description = state.form.description.trim();
  const existingRelics = getRelicsForRarity(rarity);

  if (!name) {
    alert("Le nom de la relique est obligatoire.");
    return;
  }

  const alreadyExists = existingRelics.some(
    relic => String(relic.Relic_Name || "").trim().toLowerCase() === name.toLowerCase()
  );

  if (alreadyExists) {
    alert("Une relique avec ce nom existe deja pour cette qualite.");
    return;
  }

  addCustomRelic({
    Relic_ID: generateNextRelicId(rarity),
    Relic_Name: name,
    Relic_Rarity: rarity,
    Relic_Description: description,
    Relic_Icon: state.form.icon.trim() || getDefaultIconForRarity(rarity)
  });

  state.filter = rarity.toLowerCase();
  state.form = createEmptyRelicForm();
  state.form.rarity = rarity;
  state.addPanelOpen = false;
  render();
}

if (container) {
  container.addEventListener("input", (event) => {
    if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
      return;
    }
    syncFormField(event.target);
  });

  container.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;

    const rarityButton = event.target.closest("[data-rarity-target]");
    if (rarityButton) {
      const target = rarityButton.dataset.rarityTarget;
      const value = rarityButton.dataset.rarityValue || "all";

      if (target === "filter") {
        state.filter = value;
      } else if (target === "form") {
        state.form.rarity = normalizeRarity(value);
      }

      render();
      return;
    }

    if (event.target.closest("#toggleAddRelicBtn")) {
      state.addPanelOpen = !state.addPanelOpen;
      render();
      return;
    }

    if (event.target.closest("#cancelAddRelicBtn")) {
      state.addPanelOpen = false;
      render();
      return;
    }

    if (event.target.closest("#submitAddRelicBtn")) {
      handleAddRelic();
    }
  });

  render();
}
