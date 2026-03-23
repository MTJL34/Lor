import { RelicsCommon } from "../data/Relics_Common.js";
import { RelicsRare } from "../data/Relics_Rare.js";
import { RelicsEpic } from "../data/Relics_Epic.js";

const relicGroups = [
  { title: "Common", data: RelicsCommon },
  { title: "Rare", data: RelicsRare },
  { title: "Epic", data: RelicsEpic }
];

const container = document.getElementById("relics-container");

relicGroups.forEach(group => {
  const section = document.createElement("section");
  section.className = `relic-section ${group.title.toLowerCase()}`;

  section.innerHTML = `
    <h3>${group.title} Relics</h3>
    <table class="relic-table">
      <thead>
        <tr>
          <th>Image</th>
          <th>ID</th>
          <th>Nom</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const tbody = section.querySelector("tbody");

  group.data.forEach(relic => {
    if (!relic.Relic_ID || relic.Relic_ID === 0) return;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <img
          src="${relic.Relic_Icon}"
          alt="${relic.Relic_Name}"
          width="64"
          height="64"
        >
      </td>
      <td><code>${relic.Relic_ID}</code></td>
      <td>${relic.Relic_Name}</td>
    `;

    tbody.appendChild(tr);
  });

  container.appendChild(section);
});
