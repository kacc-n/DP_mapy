// ==========================================
// 1. FACULTY COLOR CONFIGURATION
// Each faculty name maps to its brand color.
// These are used to color the circles on the map and the legend tiles.
// ==========================================
const facultyColors = {
    'Filozofická':        '#3AB0E1',
    'Lékařská':           '#B62846',
    'Pedagogická':        '#E7AE05',
    'Právnická':          '#58507F',
    'Přírodovědecká':     '#EB6D25',
    'Teologická':         '#9E82B5',
    'Tělesné kultury':    '#099652',
    'Zdravotnických věd': '#B2C918',
    'Sport':              '#0e9bca',
    'Kolej':              '#006bad',
    'Stravování':         '#006bad',
    'Univerzita':         '#006FAD',
    'VTP':                '#66d6c0',
    'CATRIN':             '#ff75d8'
};

// ==========================================
// 2. LOAD DATA AND ADD MAP LAYERS
// Fetches the GeoJSON file and adds two layers:
//   - circles representing UP buildings
//   - text labels (hidden by default, shown when a faculty is selected)
// ==========================================
async function loadData(map) {
    // Wait until the map style is fully loaded before adding anything
    if (!map.isStyleLoaded()) {
        map.once('idle', () => loadData(map));
        return;
    }

    try {
        const res = await fetch('../../data/BudovyUP.json');
        if (!res.ok) throw new Error('Data file not found: BudovyUP.json');
        const geojsonData = await res.json();

        // Build a MapLibre 'match' expression to assign colors based on FAKULTA property
        const colorExpression = ['match', ['get', 'FAKULTA']];
        for (const [name, color] of Object.entries(facultyColors)) {
            colorExpression.push(name, color);
        }
        colorExpression.push('#a19d9d'); // Fallback color for unknown faculties

        // Remove existing layers and source if they exist (prevents errors on hot reload)
        if (map.getSource('budovy-up')) {
            if (map.getLayer('budovy-up-labels')) map.removeLayer('budovy-up-labels');
            if (map.getLayer('budovy-up'))        map.removeLayer('budovy-up');
            map.removeSource('budovy-up');
        }

        // Add the GeoJSON data as a map source
        map.addSource('budovy-up', { type: 'geojson', data: geojsonData });

        // Layer 1: Circles for each building, colored by faculty
        map.addLayer({
            'id': 'budovy-up',
            'source': 'budovy-up',
            'type': 'circle',
            'minzoom': 12,
            'paint': {
                'circle-color': colorExpression,
                // Circles grow from 5px at zoom 12 to 10px at zoom 16
                'circle-radius': 5,
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff'
            }
        });

        // Layer 2: Text labels with Czech building names
        // Starts fully hidden (text-opacity: 0).
        // Labels become visible only when the user selects a faculty via the legend.
        // The opacity is controlled by toggleLayerHighlight() in map.js.
        map.addLayer({
            'id': 'budovy-up-labels',
            'source': 'budovy-up',
            'type': 'symbol',
            'minzoom': 15,
            'layout': {
                'text-field': ['get', 'nazevCZ'],
                'text-font': ['noto_sans_regular'], // Must match the VersaTiles glyph name exactly
                'text-size': 12,
                'text-anchor': 'bottom-left',
                'text-offset': [0.5, -0.5],
                'text-allow-overlap': false,
                'text-ignore-placement': false
            },
            'paint': {
                'text-color': '#050505',
                'text-halo-color': '#fff',
                'text-halo-width': 2,
                'text-opacity': 0  // Hidden by default - shown only when a faculty is selected
            }
        });

        console.log('✅ Buildings and labels loaded successfully.');
        initEyeLegend(map);

    } catch (err) {
        console.error('❌ Error in loadData:', err);
    }
}

// ==========================================
// 3. BUILD THE LEGEND
// Creates two columns of legend tiles (left and right sides of screen).
// Each tile shows a colored dot and the faculty name.
// The dwell bar at the bottom fills up when the user looks at the tile.
// ==========================================
function initEyeLegend(map) {
    const container = document.getElementById('eye-legend-container');
    if (!container) return;

    // Replace container content with two columns
    container.innerHTML = `
        <div id="legend-left"  class="legend-column"></div>
        <div id="legend-right" class="legend-column"></div>
    `;

    const leftCol  = document.getElementById('legend-left');
    const rightCol = document.getElementById('legend-right');

    Object.entries(facultyColors).forEach(([faculty, color], index) => {
        const tile = document.createElement('div');
        tile.className = 'legend-tile';
        tile.id = `tile-${faculty}`; // Used by map.js to identify the tile during gaze detection

        tile.innerHTML = `
            <div class="symbol-container">
                <div class="legend-symbol"
                     style="background-color: ${color}; border-radius: 50%; border: 1px solid white; width: 12px; height: 12px;">
                </div>
            </div>
            <span style="font-size: 13px; font-family: sans-serif;">${faculty}</span>
            <div class="dwell-bar" id="bar-${faculty}"></div>
        `;

        // First 8 entries go in the left column, the rest in the right
        if (index < 8) {
            leftCol.appendChild(tile);
        } else {
            rightCol.appendChild(tile);
        }
    });
}