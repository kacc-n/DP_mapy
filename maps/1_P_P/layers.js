// ==========================================
// 1. KONFIGURACE DAT (KUCHAŘKA)
// ==========================================
const myLayers = [
  { file: 'building_Olomouc.json', color: '#a19d9d', typ: 'fill', legend: 'Budovy' },
  { file: 'leisure_park_Olomouc.json', color: '#9be692e0', typ: 'fill', legend: 'Parky' },
  { file: 'highway_pedestrian_Olomouc.json', color: '#876767', typ: 'line', legend: 'Pěší zóny' },
  { file: 'highway_cycleway_Olomouc.json', color: '#fa78ef', typ: 'line', legend: 'Cyklostezky' },
  { file: 'amenity_parking_Olomouc.json', color: '#393939', typ: 'circle', legend: 'Parkoviště' },
  { file: 'amenity_restaurant_Olomouc.json', color: '#f3ad3c', typ: 'circle', legend: 'Restaurace' },
  { file: 'amenity_cafe_Olomouc.json', color: '#8d5126', typ: 'circle', legend: 'Kavárny' }
];

// Proměnné pro stav legendy
let currentHighlightId = null;

// ==========================================
// 2. FUNKCE PRO NAHRÁNÍ DAT DO MAPY
// ==========================================
async function loadData(map) {
  for (const layer of myLayers) {
    const id = layer.file.replace('.json', '');
    try {
      const res = await fetch(`../../data/${layer.file}`);
      const data = await res.json();
      map.addSource(id, { type: 'geojson', data: data });

      const layerConfig = {
          'id': id,
          'source': id,
          'minzoom': 14 
      };

      if (layer.typ === 'fill') {
        map.addLayer({
          ...layerConfig,
          'type': 'fill',
          'paint': { 'fill-color': layer.color, 'fill-opacity': 0.6, 'fill-outline-color': '#444' }
        });
      } else if (layer.typ === 'line') {
        map.addLayer({
          ...layerConfig,
          'type': 'line',
          'paint': { 'line-color': layer.color, 'line-width': 2 }
        });
      } else if (layer.typ === 'circle') {
        map.addLayer({
          ...layerConfig,
          'type': 'circle',
          'paint': { 'circle-radius': 5, 'circle-color': layer.color, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
        });

        // ← Label layer pro restaurace, hned po přidání circle vrstvy
        if (id === 'amenity_restaurant_Olomouc') {
          map.addLayer({
            'id': 'restaurant-labels',
            'source': id,
            'type': 'symbol',
            'minzoom': 18,
            'layout': {
              'text-field': [
                'format',
                ['get', 'name'], {},
                '\n', {},
                ['case',
                  ['has', 'capacity'],
                  ['concat', 'Kapacita: ', ['to-string', ['get', 'capacity']]],
                  ''
                ], {}
              ],
              'text-font': ['noto_sans_regular'],
              'text-size': 12,
              'text-anchor': 'bottom-left',
              'text-offset':[0.5, -0.5],
              'text-allow-overlap': false
            },
            'paint': {
              'text-color': '#050505',
              'text-halo-color': '#fff',
              'text-halo-width': 2,
              'text-opacity': 0,
            }
          });
        }

      } // ← konec else if circle
    } catch (err) {
      console.error(`❌ Chyba u ${layer.file}:`, err);
    }
  } // ← konec for loop

  initEyeLegend(map);
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
            <div class="dwell-bar" id="bar-${id}"></div>
        `;
        tile.onclick = () => toggleLayerHighlight(id, map);
        
        list.appendChild(tile);
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

        // 2. SPECIÁLNÍ LOGIKA PRO POPISKY RESTAURACÍ
        // Pokud existuje vrstva s popisky, nastavíme jí viditelnost
        if (map.getLayer('restaurant-labels')) {
            // Popisky se ukážou jen když:
            // a) Je vybraná vrstva restaurací (amenity_restaurant_Olomouc)
            // b) Není vybráno vůbec nic (volitelné - pokud je chceš mít v základu skryté, dej sem jen první podmínku)
            const showLabels = (currentHighlightId === 'amenity_restaurant_Olomouc') ? 1 : 0;
            
            map.setPaintProperty('restaurant-labels', 'text-opacity', showLabels);
        }

        // Zvýrazníme dlaždici v legendě
        if (tile) {
            tile.classList.toggle('active', id === currentHighlightId);
        }
    });
}