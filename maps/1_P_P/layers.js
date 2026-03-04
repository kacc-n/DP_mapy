// ==========================================
// 1. LAYER CONFIGURATION
// Each entry defines one data layer: the GeoJSON file, color, geometry type,
// and the label shown in the legend.
// ==========================================
const myLayers = [
    { file: 'building_Olomouc.json',           color: '#a19d9d',   selectedColor: '#7a7676',   typ: 'fill',   legend: 'Budovy'      },
    { file: 'amenity_parking_Olomouc.json',     color: '#6a88a8',   selectedColor: '#5a7da0',   typ: 'fill',   legend: 'Parkoviště'  },
    { file: 'leisure_park_Olomouc.json',        color: '#9be692e0', selectedColor: '#5eaf5c',   typ: 'fill',   legend: 'Parky'       },
    { file: 'highway_pedestrian_Olomouc.json',  color: '#876767',   selectedColor: '#6b4e4e',   typ: 'line',   legend: 'Pěší zóny'  },
    { file: 'highway_cycleway_Olomouc.json',    color: '#fa78ef',   selectedColor: '#d93ec8',   typ: 'line',   legend: 'Cyklostezky' },
    { file: 'amenity_restaurant_Olomouc.json',  color: '#f3ad3c',   selectedColor: '#d4891a',   typ: 'circle', legend: 'Restaurace'  },
    { file: 'amenity_cafe_Olomouc.json',        color: '#8d5126',   selectedColor: '#814218',   typ: 'circle', legend: 'Kavárny'     }
];

// Tracks which layer is currently highlighted (null = none)
let currentHighlightId = null;

// ==========================================
// 2. LOAD DATA AND ADD MAP LAYERS
// Loops through myLayers, fetches each GeoJSON file, and adds it to the map.
// Restaurant layer also gets a separate text label layer (hidden by default).
// All layers are visible from zoom 14+.
// ==========================================
async function loadData(map) {
    for (const layer of myLayers) {
        const id = layer.file.replace('.json', '');

        try {
            const res  = await fetch(`../../data/${layer.file}`);
            const data = await res.json();

            map.addSource(id, { type: 'geojson', data: data });

            // Shared config applied to all layer types
            const layerConfig = {
                'id':      id,
                'source':  id,
                'minzoom': 14  // Layers become visible at zoom 14
            };

            if (layer.typ === 'fill') {
                map.addLayer({
                    ...layerConfig,
                    'type': 'fill',
                    'paint': {
                        'fill-color':        layer.color,
                        'fill-opacity':       0.6,
                        'fill-outline-color': '#444'
                    }
                });

            } else if (layer.typ === 'line') {
                map.addLayer({
                    ...layerConfig,
                    'type': 'line',
                    'paint': {
                        'line-color': layer.color,
                        'line-width': 2
                    }
                });

            } else if (layer.typ === 'circle') {
                map.addLayer({
                    ...layerConfig,
                    'type': 'circle',
                    'paint': {
                        'circle-radius':       5,
                        'circle-color':        layer.color,
                        'circle-stroke-width': 1,
                        'circle-stroke-color': '#fff'
                    }
                });

                // Restaurant layer gets text labels (name + capacity).
                // Labels start hidden and appear only when Restaurace is selected in the legend.
                if (id === 'amenity_restaurant_Olomouc') {
                    map.addLayer({
                        'id':      'restaurant-labels',
                        'source':  id,
                        'type':    'symbol',
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
                            'text-font':          ['noto_sans_regular'],
                            'text-size':          12,
                            'text-anchor':        'bottom-left',
                            'text-offset':        [0.5, -0.5],
                            'text-allow-overlap': false
                        },
                        'paint': {
                            'text-color':      '#050505',
                            'text-halo-color': '#fff',
                            'text-halo-width': 2,
                            'text-opacity':    0  // Hidden by default
                        }
                    });
                }

            } // end circle block

        } catch (err) {
            console.error(`❌ Error loading ${layer.file}:`, err);
        }
    } // end layer loop

    initEyeLegend(map);
}

// ==========================================
// 3. BUILD THE LEGEND
// Creates a tile for each layer in myLayers.
// Each tile shows a symbol matching the layer type and is clickable.
// ==========================================
function initEyeLegend(map) {
    const list = document.getElementById('eye-legend-list');
    list.innerHTML = ''; // Clear any existing tiles

    myLayers.forEach(layer => {
        const id = layer.file.replace('.json', '');

        const tile = document.createElement('div');
        tile.className = 'legend-tile';
        tile.id        = `tile-${id}`;

        // Build the correct symbol HTML based on layer geometry type
        let symbolHtml = '';
        if (layer.typ === 'fill') {
            symbolHtml = `<div class="legend-symbol symbol-fill"
                style="background-color: ${layer.color}; border: 1px solid #444;"></div>`;
        } else if (layer.typ === 'line') {
            symbolHtml = `<div class="legend-symbol symbol-line"
                style="background-color: ${layer.color}; height: 4px;"></div>`;
        } else if (layer.typ === 'circle') {
            symbolHtml = `<div class="legend-symbol symbol-circle"
                style="background-color: ${layer.color}; border: 2px solid white;"></div>`;
        }

        tile.innerHTML = `
            <div class="symbol-container">${symbolHtml}</div>
            <span>${layer.legend}</span>
            <div class="dwell-bar" id="bar-${id}"></div>
        `;

        // Mouse click activates the layer highlight
        tile.onclick = () => toggleLayerHighlight(id, map);

        list.appendChild(tile);
    });
}

// ==========================================
// 4. LAYER HIGHLIGHT TOGGLE
// Clicking a tile dims all other layers to 0.1 opacity.
// Clicking the same tile again resets everything to default.
// Restaurant labels are shown only when that layer is selected.
// ==========================================
function toggleLayerHighlight(layerId, map) {
    // Toggle: clicking the same layer again deselects it
    currentHighlightId = (currentHighlightId === layerId) ? null : layerId;

    myLayers.forEach(layer => {
        const id   = layer.file.replace('.json', '');
        const tile = document.getElementById(`tile-${id}`);

        // Determine opacity: selected layer gets full opacity, others get dimmed
        const isSelected  = (id === currentHighlightId);
        const fillOpacity = currentHighlightId ? (isSelected ? 0.8 : 0.1) : 0.6;
        const lineOpacity = currentHighlightId ? (isSelected ? 1.0 : 0.1) : 1.0;

        // Apply opacity to the map layer
        if (map.getLayer(id)) {
        if (layer.typ === 'fill') {
            map.setPaintProperty(id, 'fill-opacity', fillOpacity);
            map.setPaintProperty(id, 'fill-color', isSelected ? layer.selectedColor : layer.color);
        } else if (layer.typ === 'line') {
            map.setPaintProperty(id, 'line-opacity', lineOpacity);
            map.setPaintProperty(id, 'line-color', isSelected ? layer.selectedColor : layer.color);
        } else if (layer.typ === 'circle') {
            map.setPaintProperty(id, 'circle-opacity',        lineOpacity);
            map.setPaintProperty(id, 'circle-stroke-opacity', lineOpacity);
            map.setPaintProperty(id, 'circle-color', isSelected ? layer.selectedColor : layer.color);
        }
    }

        // Update legend symbol color to match
        const symbol = document.querySelector(`#tile-${id} .legend-symbol`);
        if (symbol) symbol.style.backgroundColor = isSelected ? layer.selectedColor : layer.color;

        // Update legend tile active state
        if (tile) tile.classList.toggle('active', isSelected);
    });

    // Show restaurant labels only when that layer is selected
    if (map.getLayer('restaurant-labels')) {
        const showLabels = (currentHighlightId === 'amenity_restaurant_Olomouc') ? 1 : 0;
        map.setPaintProperty('restaurant-labels', 'text-opacity', showLabels);
    }
}