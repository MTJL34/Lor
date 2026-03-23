import { Champion } from "../data/Champion.js";
import { Relics } from "../data/Relics.js";

export const Own = [
    {
        Champion_ID: 1,
        Relics_IDs: [2, 8, 41]
    },
    {
        Champion_ID: 21,
        Relics_IDs: [4, 11]
    }
];

export function getOwnChampions() {
    return Own.map(entry => {
        const champion = Champion.find(
            c => c.Champion_ID === entry.Champion_ID
        );

        const relics = entry.Relics_IDs.map(id =>
            Relics.find(r => r.Relic_ID === id)
        );

        return {
            ...champion,
            Relics: relics
        };
    });
}