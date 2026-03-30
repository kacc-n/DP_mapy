// ==========================================
// 1. CONFIGURATION
// Central place to adjust map start position and zoom level.
// ==========================================
const CONFIG = {
    startLat:  49.593777,
    startLng:  17.250879,
    startZoom: 11,
};

// ==========================================
// 2. MAP INITIALIZATION
// Interactive mode is enabled - this map is controlled by mouse.
// The style URL provides the base map tiles and fonts (glyphs).
// ==========================================
const map = new maplibregl.Map({
    container:   'map',
    style:       'https://tiles.versatiles.org/assets/styles/colorful/style.json',
    center:      [CONFIG.startLng, CONFIG.startLat],
    zoom:        CONFIG.startZoom,
    interactive: true // Mouse pan, scroll zoom, and click are all enabled
});

// ==========================================
// 3. GAZE DOT
// Updates the red dot position on screen so gaze can be monitored
// during testing even though gaze does not control this map.
// ==========================================
function updateGaze(x, y) {
    const dot = document.getElementById('gaze-dot');
    dot.style.display = 'block';
    dot.style.left    = (x * window.innerWidth)  + 'px';
    dot.style.top     = (y * window.innerHeight) + 'px';
}

// ==========================================
// 4. WEBSOCKET CONNECTION (GazeDeck)
// Keeps the connection to GazeDeck alive even though gaze does not
// control this map. This prevents GazeDeck from needing to reconnect
// when switching between maps during user testing.
// Gaze coordinates are still received and used to update the gaze dot.
// ==========================================
let messageCount = 0;
let wsConnection = null;

function connectGazeDeck() {
    console.log('🔌 Connecting to GazeDeck at ws://localhost:8765...');

    wsConnection = new WebSocket('ws://localhost:8765');
    wsConnection.binaryType = 'arraybuffer';

    wsConnection.onopen = () => {
        console.log('✅ GazeDeck connected!');
    };

    wsConnection.onmessage = (e) => {
        // Binary packet format: int32 deviceId, int32 surfaceId, float32 x, float32 y, float64 timestamp
        const v = new DataView(e.data);
        const x = v.getFloat32(8,  true);
        const y = v.getFloat32(12, true);

        messageCount++;

        // Log the first 5 messages to verify data is arriving correctly
        if (messageCount <= 5) {
            console.log(`📦 Message #${messageCount}: x=${x.toFixed(3)}, y=${y.toFixed(3)}`);
        }

        // Periodic status log every 100 messages
        if (messageCount % 100 === 0) {
            console.log(`✔ ${messageCount} messages received | x=${x.toFixed(3)}, y=${y.toFixed(3)}`);
        }

        // Update gaze dot position even though gaze doesn't control the map
        if (!isNaN(x) && !isNaN(y)) {
            updateGaze(x, y);
/*         } else {
            console.warn('⚠️ Invalid gaze data received:', { x, y }); //uncomment for debugging invalid data issues
 */        }
    };

    wsConnection.onerror = () => {
        console.error('❌ GazeDeck connection error. Is GazeDeck running on localhost:8765?');
    };

    wsConnection.onclose = () => {
        console.log('🔌 GazeDeck disconnected. Retrying in 2 seconds...');
        messageCount = 0;
        setTimeout(connectGazeDeck, 2000);
    };
}

// ==========================================
// 5. KEYBOARD SHORTCUTS
// H    - fly back to starting position
// Space - advance to the next slide in the parent testing window.
//         Uses postMessage because after the user clicks inside the iframe,
//         keyboard focus shifts there and the parent window stops receiving
//         keydown events directly.
// ==========================================
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') {
        console.log('🏠 Returning to start position...');
        map.flyTo({
            center:    [CONFIG.startLng, CONFIG.startLat],
            zoom:      CONFIG.startZoom,
            essential: true,
            speed:     1,
            curve:     1
        });
    }

    if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scrolling
        window.parent.postMessage('nextSlide', '*'); // Tell parent to advance to next slide
    }
});

// ==========================================
// 6. STARTUP
// Waits for the map style to load, then initializes data and eye tracker connection.
// ==========================================
console.log('🖱️ Mouse-controlled map starting...');
console.log('🏠 Press H to return to starting position');

map.on('load', async () => {
    console.log('✅ Map style loaded');

    // Load GeoJSON layers and generate legend tiles
    await loadData(map);

    // Add metric scale bar at the bottom center
    map.addControl(
        new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
        'bottom-left'
    );

    // Keep GazeDeck connection alive for seamless switching between maps
    connectGazeDeck();
});