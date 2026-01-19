// layers.js

const myLayers = [
  { file: 'building_Olomouc.json', color: '#524f4f', typ: 'fill', legend: 'Budovy' },
  { file: 'leisure_park_Olomouc.json', color: '#9be692e0', typ: 'fill', legend: 'Parky' },
  { file: 'highway_pedestrian_Olomouc.json', color: '#876767', typ: 'line', legend: 'Pěší zóny' },
  { file: 'highway_cycleway_Olomouc.json', color: '#fa78ef', typ: 'line', legend: 'Cyklostezky' },
  { file: 'amenity_parking_Olomouc.json', color: '#393939', typ: 'circle', legend: 'Parkoviště' },
  { file: 'amenity_restaurant_Olomouc.json', color: '#f3ad3c', typ: 'circle', legend: 'Restaurace' },
  { file: 'amenity_cafe_Olomouc.json', color: '#8d5126', typ: 'circle', legend: 'Kavárny' }
];

// Přidali jsme "async", aby funkce uměla používat "await" (čekání)
async function loadData(map) {
  
  // Klasický cyklus for...of, který narozdíl od forEach umí čekat
  for (const layer of myLayers) {
    // Opravili jsme i nahrazení koncovky na .json, jak jsi psala
    const id = layer.file.replace('.json', '');

    try {
      // "await" říká: "Zastav se a čekej, dokud se file nestáhne"
      const res = await fetch(`data/${layer.file}`);
      const data = await res.json();

      map.addSource(id, { type: 'geojson', data: data });

      if (layer.typ === 'fill') {
        map.addLayer({
          'id': id, 'type': 'fill', 'source': id,
          'paint': { 'fill-color': layer.color, 'fill-opacity': 0.6 }
        });
      } else if (layer.typ === 'line') {
        map.addLayer({
          'id': id, 'type': 'line', 'source': id,
          'paint': { 'line-color': layer.color, 'line-width': 3 }
        });
      } else if (layer.typ === 'circle') {
        map.addLayer({
          'id': id, 'type': 'circle', 'source': id,
          'paint': { 'circle-radius': 6, 'circle-color': layer.color, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }
        });
      }
      
      console.log(`✅ Hotovo: ${layer.legend}`);
      
      // TADY POZDĚJI DOPÍŠEME: vytvorRadekLegendy(layer);

    } catch (err) {
      console.error(`❌ Nepodařilo se načíst ${layer.file}:`, err);
    }
  }
}