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
  // POJISTKA: Počkáme, až bude styl mapy připraven, jinak se vrstva nepřidá
  if (!map.isStyleLoaded()) {
    map.once('idle', () => loadData(map));
    return;
  }

  try {
    const res = await fetch('../../data/BudovyUP.json');
    const data = await res.json();
    
    // Kontrolní výpis do konzole (užitečné pro ladění)
    console.log("Data načtena. První fakulta v souboru:", data.features[0].properties.FAKULTA);

    // Dynamické sestavení barevného schématu ze seznamu facultyColors
    const colorExpression = ['match', ['get', 'FAKULTA']];
    for (const [name, color] of Object.entries(facultyColors)) {
      colorExpression.push(name, color);
    }
    colorExpression.push('#a19d9d'); // Výchozí šedá pro neznámé fakulty

    // Přidání zdroje dat
    map.addSource('budovy-up', { 
      type: 'geojson', 
      data: data 
    });

    // Přidání samotné vrstvy bodů
    map.addLayer({
      'id': 'budovy-up',
      'source': 'budovy-up',
      'type': 'circle',
      'minzoom': 10, // Sníženo, aby body byly vidět i při větším oddálení
      'paint': {
        'circle-color': colorExpression,
        'circle-radius': 7,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
      }
    });

    console.log('✅ Vrstva budov byla úspěšně přidána do mapy.');

  } catch (err) {
    console.error('❌ Kritická chyba při nahrávání dat:', err);
  }
}
// ==========================================
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