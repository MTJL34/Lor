# 💎 LoR Calculator - Path of Champions

Calculateur de ressources pour Legends of Runeterra - Path of Champions / Constellations.

Site web statique (HTML/CSS/JS vanilla) compatible Windows et Mac.

## 🚀 Démarrage Rapide

### Prérequis

- VS Code
- Extension "Live Server" ([ritwickdey.LiveServer](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer))

### Installation

1. **Ouvrir le dossier** `LOR calculator` dans VS Code
2. **Clic droit** sur `index.html` → **Open with Live Server**
3. Le site s'ouvre automatiquement dans votre navigateur

> ⚠️ **Important** : Vous **devez** utiliser Live Server (serveur HTTP) car le site charge `site_data.json` via `fetch()`. Un simple double-clic sur `index.html` ne fonctionnera pas (CORS).

### Mode connecté au backend (recommandé)

Le front essaie d'abord l'API backend:
- `GET /api/site-data`
- `GET /api/inventory/export`
- `POST /api/inventory/import`

Si l'API n'est pas dispo, il bascule automatiquement en mode local (`site_data.json` + `localStorage`).

## 📁 Structure du Projet

```
LOR calculator/
├── index.html              # Page principale
├── README.md               # Ce fichier
├── data/
│   └── site_data.json      # Données de base (régions, champions, totaux)
├── css/
│   └── app.css             # Styles
└── js/
    ├── app.js              # Point d'entrée (routing, init)
    ├── types.js            # Validation & schemas
    ├── storage.js          # LocalStorage (load/save)
    ├── calc.js             # Calculs purs (needed, craft, etc.)
    ├── ui.js               # Helpers DOM
    ├── pages/              # Pages de l'app
    │   ├── dashboard.js
    │   ├── regions.js
    │   ├── regionDetail.js
    │   ├── champions.js
    │   ├── exportImport.js
    │   └── helpRules.js
    └── components/         # Composants réutilisables
        ├── layout.js
        ├── resourceTable.js
        ├── craftPanel.js
        ├── numberInput.js
        ├── diffBadge.js
        └── jsonPreview.js
```

## 🎮 Utilisation

### 1. Dashboard

Vue d'ensemble :
- Ressources manquantes globales
- Top 5 régions par besoins

### 2. Régions

Liste de toutes les régions avec :
- Nombre de champions
- Ressources manquantes
- Barre de progression

Cliquez sur une région pour accéder au détail.

### 3. Détail d'une Région

- Tableau : Total / Inventaire (éditable) / Manquant (auto)
- **Craft Panel** : convertir Nova Shards → Crystal (100:1)
- Boutons : Reset, Tout à 0

### 4. Champions

Liste filtrée par région avec :
- Nom, Coût, Étoiles, Source (bundle/normal)

### 5. Export / Import

- **Export** : Copier ou télécharger votre inventaire en JSON
- **Import** : Restaurer depuis un JSON sauvegardé

## ⚗️ Craft Nova Shards → Crystal

**Règle** : 100 Nova Shards = 1 Nova Crystal

- Les Nova Shards acceptent **n'importe quel nombre** (pas de contrainte multiple de 100)
- Le craft se fait **manuellement** via le bouton dans le détail d'une région
- Le craft **modifie l'inventaire réel** et est sauvegardé

## 💾 Sauvegarde

- **Automatique** : Vos données sont sauvegardées dans le `localStorage` du navigateur à chaque modification
- **Synchronisation API** : Si le backend est disponible, l'état de l'application est aussi persisté côté serveur
- **PoC inclus** : Les modifications faites dans `PoC Champions` et `PoC Reliques` sont persistées elles aussi
- **Export/Import** : Faites des backups JSON pour transférer entre appareils

## 🔧 Personnalisation

### Modifier les Données

Éditez `data/site_data.json` avec vos propres régions/champions/totaux.

Pour les données gemstones par champion, utilisez le SQL:
- `data/gemstone_tiers.sql`
- Table: `champion_gemstone_tiers`
- Vue: `champion_gemstone_totals`

Structure requise :

```json
{
  "resources": {
    "regional": {
      "nova_crystal": { "name": "Nova Crystal" },
      "nova_shards": { "name": "Nova Shards" },
      "star_crystal": { "name": "Star Crystal" },
      "gemstone": { "name": "Gemstone" },
      "wild_shards": { "name": "Wild Shards" }
    }
  },
  "regions": {
    "RegionName": {
      "totals": {
        "nova_crystal": 0,
        "nova_shards": 0,
        "star_crystal": 0,
        "gemstone": 0,
        "wild_shards": 0
      },
      "inventory_default": {
        "nova_crystal": 0,
        "nova_shards": 0,
        "star_crystal": 0,
        "gemstone": 0,
        "wild_shards": 0
      },
      "champions": [
        {
          "name": "ChampionName",
          "cost": 0,
          "poc": 1,
          "stars": 6,
          "source": "normal"
        }
      ]
    }
  }
}
```

### Réinitialiser Complètement

**Méthode 1** : Dans la page d'une région → Bouton "🔄 Reset"

**Méthode 2** : Ouvrir la console du navigateur (F12) et taper :
```javascript
localStorage.removeItem('lor_calc_state_v1');
location.reload();
```

## 🌐 Compatibilité

- ✅ Chrome / Edge (recommandé)
- ✅ Firefox
- ✅ Safari (macOS)
- ✅ Tout navigateur récent supportant ES Modules

## 📝 Formules

### Needed (Manquant)
```javascript
needed = Math.max(0, total - inventory)
```

### Craft
```javascript
craftable = Math.floor(nova_shards / 100)
nova_shards -= crafted * 100
nova_crystal += crafted
```

### Progression
```javascript
progress = 1 - (neededSum / totalSum)
```

## ⚠️ Limitations

- Le site ne "devine" pas les drops de ressources
- Il gère uniquement votre inventaire **manuel**
- Les calculs se basent sur **votre inventaire actuel**

## 🐛 Dépannage

### Le site ne charge pas

- Vérifiez que vous utilisez **Live Server** (pas juste ouvrir index.html)
- Vérifiez que `data/site_data.json` existe
- Ouvrez la console (F12) pour voir les erreurs

### Mes données ont disparu

- Vérifiez le localStorage (F12 → Application → Local Storage)
- Importez votre dernier export JSON si vous en avez un

### Le craft ne fonctionne pas

- Vérifiez que vous avez au moins 100 Nova Shards
- Le bouton "Craft Max" sera grisé si craftable = 0

## 📄 License

Projet personnel - Utilisation libre

---

**Enjoy!** 🎮✨
