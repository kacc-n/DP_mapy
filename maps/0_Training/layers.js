// ==========================================
// 1. KONFIGURACE DAT A BAREV
// ==========================================
const facultyColors = {
  'Filozofická': '#3AB0E1',
  'Lékařská': '#B62846',
  'Pedagogická': '#E7AE05',
  'Právnická': '#58507F',
  'Přírodovědecká': '#EB6D25',
  'Teologická': '#9E82B5',
  'Tělesné kultury': '#099652',
  'Zdravotnických věd': '#B2C918',
  'Sport': '#0e9bca',
  'Kolej': '#006bad',
  'Stravování': '#006bad',
  'Univerzita': '#006FAD',
  'VTP': '#66d6c0',
  'CATRIN': '#ff75d8'
};

// ==========================================
// 2. FUNKCE PRO NAHRÁNÍ DAT (MapLibre)
// ==========================================
async function loadData(map) {
  if (!map.isStyleLoaded()) {
    map.once('idle', () => loadData(map));
    return;
  }

  try {
    const res = await fetch('../../data/BudovyUP.json');
    if (!res.ok) throw new Error("Soubor s daty nebyl nalezen.");
    const geojsonData = await res.json();

    // Příprava barev
    const colorExpression = ['match', ['get', 'FAKULTA']];
    for (const [name, color] of Object.entries(facultyColors)) {
      colorExpression.push(name, color);
    }
    colorExpression.push('#a19d9d'); 

    // Vyčištění starých zdrojů (prevence chyb při refresh)
    if (map.getSource('budovy-up')) {
        if (map.getLayer('budovy-up-labels')) map.removeLayer('budovy-up-labels');
        if (map.getLayer('budovy-up')) map.removeLayer('budovy-up');
        map.removeSource('budovy-up');
    }

    map.addSource('budovy-up', { type: 'geojson', data: geojsonData });

    // 1. VRSTVA: KOLEČKA
    map.addLayer({
      'id': 'budovy-up',
      'source': 'budovy-up',
      'type': 'circle',
      'minzoom': 12,
      'paint': {
        'circle-color': colorExpression,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 16, 10],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff'
      }
    });

    // 2. VRSTVA: POPISKY (v nejjednodušší možné formě)
    map.addLayer({
        'id': 'budovy-up-labels',
        'source': 'budovy-up',
        'type': 'symbol',
        'minzoom': 15, 
        'layout': {
            'text-field': ['get', 'nazevCZ'],
            'text-font': ['noto_sans_regular'],
            'text-size': 12,
            'text-anchor': 'bottom-left',
            'text-offset': [0.5, -0.5],
            'text-allow-overlap': false,      // ← force show
            'text-ignore-placement': false,   // ← ignore other layers' symbols too
            'text-optional': false,
        },
        'paint': {
            'text-color': '#050505',
            'text-halo-color': '#fff',
            'text-halo-width': 2
        }
    });

    console.log('✅ Kolečka i popisky jsou v kódu připraveny.');
    initEyeLegend(map);

  } catch (err) {
    console.error('❌ Chyba v loadData:', err);
  }

}// ==========================================
// 3. FUNKCE PRO VYTVOŘENÍ LEGENDY
// ==========================================
function initEyeLegend(map) {
  const container = document.getElementById('eye-legend-container');
  if (!container) return;

  // Vyčistíme kontejner a připravíme dva sloupce
  container.innerHTML = `
    <div id="legend-left" class="legend-column"></div>
    <div id="legend-right" class="legend-column"></div>
  `;

  const leftCol = document.getElementById('legend-left');
  const rightCol = document.getElementById('legend-right');

  // Převedeme klíče na pole, abychom mohli počítat index
  const entries = Object.entries(facultyColors);

  entries.forEach(([fakulta, barva], index) => {
    const tile = document.createElement('div');
    tile.className = 'legend-tile';
    tile.id = `tile-${fakulta}`; // Důležité pro highlightování

    tile.innerHTML = `
      <div class="symbol-container">
        <div class="legend-symbol" 
             style="background-color: ${barva}; border-radius: 50%; border: 1px solid white; width: 12px; height: 12px;">
        </div>
      </div>
      <span style="font-size: 13px; font-family: sans-serif;">${fakulta}</span>
      <div class="dwell-bar" id="bar-${fakulta}"></div>
    `;

    // Prvních 8 (index 0-7) jde vlevo, zbytek vpravo
    if (index < 8) {
      leftCol.appendChild(tile);
    } else {
      rightCol.appendChild(tile);
    }
  });
}