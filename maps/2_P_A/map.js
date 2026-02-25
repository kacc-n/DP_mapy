// ==========================================
// 1. CONFIGURATION
// Central place to adjust map start position and dwell timing.
// ==========================================
const CONFIG = {
    startLat:  49.593777,
    startLng:  17.250879,
    startZoom: 11,
};

// ==========================================
// 2. MAP INITIALIZATION
// Interactive mode is enabled - panning and zooming are done by mouse.
// The style URL provides the base map tiles and fonts (glyphs).
// ==========================================
const map = new maplibregl.Map({
    container:   'map',
    style:       'https://tiles.versatiles.org/assets/styles/colorful/style.json',
    center:      [CONFIG.startLng, CONFIG.startLat],
    zoom:        CONFIG.startZoom,
    interactive: true // Mouse pan and scroll zoom enabled
});

// ==========================================
// 3. GAZE STATE
// Variables for tracking gaze position and legend dwell interaction.
// Gaze does not control map movement or zoom on this map.
// ==========================================
let gazeX = 0.5, gazeY = 0.5; // Normalized gaze position (0-1 range)

// Legend dwell state
let hoveredTileId     = null;  // Which legend tile is currently being looked at
let dwellStartTime    = 0;     // When the user started looking at the current tile
let interactionLocked = false; // Prevents re-triggering immediately after activation
const DWELL_TRIGGER_TIME = 1000; // ms needed to activate a legend tile

// ==========================================
// 4. GAZE POSITION UPDATE
// Called by the WebSocket handler whenever new gaze data arrives.
// Updates the red dot and gaze coordinates used for legend dwell detection.
// ==========================================
function updateGaze(x, y) {
    gazeX = x;
    gazeY = y;
    const dot = document.getElementById('gaze-dot');
    dot.style.display = 'block';
    dot.style.left    = (x * window.innerWidth)  + 'px';
    dot.style.top     = (y * window.innerHeight) + 'px';
}

// ==========================================
// 5. WEBSOCKET CONNECTION (GazeDeck)
// Connects to the eye tracker software running locally on port 8765.
// Gaze coordinates are used only for legend dwell interaction on this map.
// Automatically reconnects if the connection is lost.
// ==========================================
let messageCount = 0;
let wsConnection  = null;

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

        if (!isNaN(x) && !isNaN(y)) {
            updateGaze(x, y);
        } else {
            console.warn('⚠️ Invalid gaze data received:', { x, y });
        }
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
// 6. MAIN ANIMATION LOOP
// Runs every frame via requestAnimationFrame.
// Only handles legend dwell interaction - map movement and zoom are via mouse.
// ==========================================
function update() {
    try {
        if (!interactionLocked) {
            const screenX  = gazeX * window.innerWidth;
            const screenY  = gazeY * window.innerHeight;
            let foundHover = false;

            // Check each layer tile to see if the user is looking at it
            myLayers.forEach(layer => {
                const id   = layer.file.replace('.json', '');
                const tile = document.getElementById(`tile-${id}`);
                const bar  = tile ? tile.querySelector('.dwell-bar') : null;

                if (tile && bar) {
                    const rect      = tile.getBoundingClientRect();
                    const isLooking = screenX >= rect.left && screenX <= rect.right &&
                                      screenY >= rect.top  && screenY <= rect.bottom;

                    if (isLooking) {
                        foundHover = true;

                        // New tile - reset dwell timer and clear other bars
                        if (hoveredTileId !== id) {
                            hoveredTileId  = id;
                            dwellStartTime = Date.now();
                            document.querySelectorAll('.dwell-bar').forEach(b => b.style.width = '0%');
                        }

                        // Update the dwell progress bar
                        const elapsed  = Date.now() - dwellStartTime;
                        const progress = Math.min((elapsed / DWELL_TRIGGER_TIME) * 100, 100);
                        bar.style.width = `${progress}%`;

                        // Trigger toggle after dwell time is complete
                        if (elapsed >= DWELL_TRIGGER_TIME) {
                            handleLayerToggle(id, tile, bar);
                        }
                    } else {
                        bar.style.width = '0%';
                    }
                }
            });

            if (!foundHover) hoveredTileId = null;
        }

    } catch (e) {
        // Silently catch any errors during animation
    }

    requestAnimationFrame(update);
}

// ==========================================
// 7. LEGEND TILE ACTIVATION
// Called when a user has looked at a legend tile long enough.
// Triggers the layer highlight and locks interaction briefly to prevent re-triggering.
// ==========================================
function handleLayerToggle(layerId, tileElement, barElement) {
    console.log(`👁️ Layer toggled by gaze: ${layerId}`);

    // Call the highlight function defined in layers.js
    toggleLayerHighlight(layerId, map);

    // Visual confirmation: tile turns gold briefly
    tileElement.classList.add('locked');
    barElement.style.width = '0%';

    // Lock interaction for 1 second to prevent immediate re-trigger
    interactionLocked = true;
    setTimeout(() => {
        tileElement.classList.remove('locked');
        interactionLocked = false;
        dwellStartTime    = Date.now();
    }, 1000);
}

// ==========================================
// 8. KEYBOARD SHORTCUTS
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
// 9. STARTUP
// Waits for the map style to load, then initializes data, eye tracking, and the loop.
// ==========================================
console.log('🖱️👁️ Passive-active map starting...');
console.log('🖱️ Mouse controls panning and zooming');
console.log('👁️ Gaze controls legend highlight (1s dwell)');
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

    // Start WebSocket connection to eye tracker
    connectGazeDeck();

    // Start the animation loop (legend dwell only)
    update();
});