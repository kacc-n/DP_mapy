// ==========================================
// 1. KONFIGURACE DAT (KUCHAŘKA)
// ==========================================
const myLayers = [
  { file: 'building_Olomouc.json', color: '#524f4f', typ: 'fill', legend: 'Budovy' },
  { file: 'leisure_park_Olomouc.json', color: '#9be692e0', typ: 'fill', legend: 'Parky' },
  { file: 'highway_pedestrian_Olomouc.json', color: '#876767', typ: 'line', legend: 'Pěší zóny' },
  { file: 'highway_cycleway_Olomouc.json', color: '#fa78ef', typ: 'line', legend: 'Cyklostezky' },
  { file: 'amenity_parking_Olomouc.json', color: '#393939', typ: 'circle', legend: 'Parkoviště' },
  { file: 'amenity_restaurant_Olomouc.json', color: '#f3ad3c', typ: 'circle', legend: 'Restaurace' },
  { file: 'amenity_cafe_Olomouc.json', color: '#8d5126', typ: 'circle', legend: 'Kavárny' }
];

// Proměnné pro stav legendy
let legendActive = false;
let currentHighlightId = null;

// ==========================================
// 2. FUNKCE PRO NAHRÁNÍ DAT DO MAPY
// ==========================================
async function loadData(map) {
  for (const layer of myLayers) {
    const id = layer.file.replace('.json', '');

    try {
      const res = await fetch(`data/${layer.file}`);
      const data = await res.json();

      map.addSource(id, { type: 'geojson', data: data });

      // Stylujeme vrstvy v mapě tak, aby odpovídaly legendě
      if (layer.typ === 'fill') {
        map.addLayer({
          'id': id, 'type': 'fill', 'source': id,
          'paint': { 
              'fill-color': layer.color, 
              'fill-opacity': 0.6,
              'fill-outline-color': '#444' // Tmavý obrys budov
          }
        });
      } else if (layer.typ === 'line') {
        map.addLayer({
          'id': id, 'type': 'line', 'source': id,
          'paint': { 
              'line-color': layer.color, 
              'line-width': 4 // Tlustší čáry
          }
        });
      } else if (layer.typ === 'circle') {
        map.addLayer({
          'id': id, 'type': 'circle', 'source': id,
          'paint': { 
              'circle-radius': 6, 
              'circle-color': layer.color,
              'circle-stroke-width': 2, // Bílý obrys bodů
              'circle-stroke-color': '#fff'
          }
        });
      }
      console.log(`✅ Data načtena: ${layer.legend}`);

    } catch (err) {
      console.error(`❌ Chyba u ${layer.file}:`, err);
    }
  }
}

// ==========================================
// 3. FUNKCE PRO VYTVOŘENÍ LEGENDY
// ==========================================
function initEyeLegend(map) {
    const container = document.getElementById('eye-legend-container');
    const list = document.getElementById('eye-legend-list');
    
    // Vyčistíme seznam
    list.innerHTML = '';

    // Projdeme vrstvy a vytvoříme dlaždice
    myLayers.forEach(layer => {
        const id = layer.file.replace('.json', '');
        
        const tile = document.createElement('div');
        tile.className = 'legend-tile';
        tile.id = `tile-${id}`;

        // Zde vytváříme symboly přesně podle typu
        let symbolHtml = '';

        if (layer.typ === 'fill') {
            // Čtvereček s tmavým obrysem
            symbolHtml = `<div class="legend-symbol symbol-fill" 
                style="background-color: ${layer.color}; border: 1px solid #444;"></div>`;
        } 
        else if (layer.typ === 'line') {
            // Vodorovná čára
            symbolHtml = `<div class="legend-symbol symbol-line" 
                style="background-color: ${layer.color}; height: 4px;"></div>`;
        } 
        else if (layer.typ === 'circle') {
            // Kolečko s bílým obrysem
            symbolHtml = `<div class="legend-symbol symbol-circle" 
                style="background-color: ${layer.color}; border: 2px solid white;"></div>`;
        }

        // Vložíme symbol a text do dlaždice
        tile.innerHTML = `
            <div class="symbol-container">${symbolHtml}</div>
            <span>${layer.legend}</span>
        `;

        // Kliknutí myší (pro testování)
        tile.onclick = () => toggleLayerHighlight(id, map);
        
        list.appendChild(tile);
    });

    // Ovládání mezerníkem
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            legendActive = !legendActive;
            container.classList.toggle('hidden', !legendActive);
        }
    });
}

// ==========================================
// 4. FUNKCE PRO ZVÝRAZNĚNÍ (HIGHLIGHT)
// ==========================================
function toggleLayerHighlight(layerId, map) {
    // Přepínání stavu (zapnuto/vypnuto)
    currentHighlightId = (currentHighlightId === layerId) ? null : layerId;

    myLayers.forEach(layer => {
        const id = layer.file.replace('.json', '');
        const tile = document.getElementById(`tile-${id}`);
        
        // Logika průhlednosti: pokud je něco vybráno, ostatní zprůhledníme
        let opacity = 0.6; // Výchozí průhlednost
        let lineOpacity = 1.0;

        if (currentHighlightId) {
            // Pokud je tato vrstva vybraná -> plná viditelnost
            if (id === currentHighlightId) {
                opacity = 0.8;
                lineOpacity = 1.0;
            } else {
                // Pokud není vybraná -> skoro neviditelná
                opacity = 0.1;
                lineOpacity = 0.1;
            }
        }

        // Aplikujeme změny na mapu (pokud vrstva existuje)
        if (map.getLayer(id)) {
            if (layer.typ === 'fill') {
                map.setPaintProperty(id, 'fill-opacity', opacity);
            } else if (layer.typ === 'line') {
                map.setPaintProperty(id, 'line-opacity', lineOpacity);
            } else if (layer.typ === 'circle') {
                map.setPaintProperty(id, 'circle-opacity', lineOpacity);
                map.setPaintProperty(id, 'circle-stroke-opacity', lineOpacity);
            }
        }

        // Zvýrazníme dlaždici v legendě
        if (tile) {
            tile.classList.toggle('active', id === currentHighlightId);
        }
    });
}