// ==========================================
// 1. CONFIGURATION
// Central place to adjust map start position, movement speed, and dwell timing.
// ==========================================
const CONFIG = {
    startLat:    49.593777,
    startLng:    17.250879,
    startZoom:   16,
    moveSpeed:   8,       // Pixels per frame the map moves when looking at an edge
    dwellTimeMs: 500      // Milliseconds to look at an edge before movement starts
};

// ==========================================
// 2. MAP INITIALIZATION
// Interactive mode is disabled - all control is done via eye tracking.
// The style URL provides the base map tiles and fonts (glyphs).
// ==========================================
const map = new maplibregl.Map({
    container:   'map',
    style:       'https://tiles.versatiles.org/assets/styles/colorful/style.json',
    center:      [CONFIG.startLng, CONFIG.startLat],
    zoom:        CONFIG.startZoom,
    interactive: false // Disables mouse/keyboard/touch interactions
});

// ==========================================
// 3. GAZE STATE
// All variables that track where the user is looking and what mode is active.
// ==========================================
let gazeX = 0.8, gazeY = 0.5; // Normalized gaze position (0-1 range)

// Edge navigation state
let currentZone   = null;
let zoneEnterTime = null;
let isMoving      = false;

// Zoom mode state
let lookingAtCenter     = false;
let centerLookStartTime = null;
let zoomMode            = false;
const ZOOM_CENTER_TIME  = 1000; // ms of looking at center to activate zoom mode

// Legend dwell state
let hoveredTileId     = null;  // Which legend tile is currently being looked at
let dwellStartTime    = 0;     // When the user started looking at the current tile
let interactionLocked = false; // Prevents re-triggering immediately after activation
const DWELL_TRIGGER_TIME = 1000; // ms needed to activate a legend tile

// ==========================================
// 4. EDGE ZONE DETECTION
// Divides the screen into 8 zones outside the normal view area (x/y outside 0-1).
// Returns the zone name or null if the gaze is inside the screen.
// ==========================================
function getZone(x, y) {
    if ((y < 0 && x < 0.2) || (y < 0.2 && x < 0)) return 'top-left';
    if ((y < 0 && x > 0.8) || (y < 0.2 && x > 1)) return 'top-right';
    if ((y > 0.8 && x < 0) || (y > 1 && x < 0.2)) return 'bottom-left';
    if ((y > 1 && x > 0.8) || (y > 0.8 && x > 1)) return 'bottom-right';
    if (y < 0 && x > 0.2 && x < 0.8)              return 'top';
    if (y > 1 && x > 0.2 && x < 0.8)              return 'bottom';
    if (x < 0 && y > 0.2 && y < 0.8)              return 'left';
    if (x > 1 && y > 0.2 && y < 0.8)              return 'right';
    return null;
}

// ==========================================
// 5. EDGE HIGHLIGHT
// Shows a subtle blue glow on the screen edge the user is looking at.
// ==========================================
function highlightEdge(zone) {
    document.querySelectorAll('.edge-highlight').forEach(el => el.remove());
    if (!zone) return;

    const div = document.createElement('div');
    div.className = 'edge-highlight';

    const styles = {
        'top':          'top:0;left:20%;width:60%;height:15px',
        'bottom':       'bottom:0;left:20%;width:60%;height:15px',
        'left':         'left:0;top:20%;width:15px;height:60%',
        'right':        'right:0;top:20%;width:15px;height:60%',
        'top-left':     'top:0;left:0;width:200px;height:200px;border-radius:0 0 100% 0',
        'top-right':    'top:0;right:0;width:200px;height:200px;border-radius:0 0 0 100%',
        'bottom-left':  'bottom:0;left:0;width:200px;height:200px;border-radius:0 100% 0 0',
        'bottom-right': 'bottom:0;right:0;width:200px;height:200px;border-radius:100% 0 0 0',
    };

    div.style.cssText = styles[zone] || '';
    document.body.appendChild(div);
}

// ==========================================
// 6. MOVEMENT CALCULATION
// Returns how many pixels to pan the map per frame based on the active zone.
// ==========================================
function getMovement(zone) {
    if (!zone || !isMoving) return { x: 0, y: 0 };
    const s = CONFIG.moveSpeed;
    const moves = {
        'top':          { x:  0, y: -s },
        'bottom':       { x:  0, y:  s },
        'left':         { x: -s, y:  0 },
        'right':        { x:  s, y:  0 },
        'top-left':     { x: -s, y: -s },
        'top-right':    { x:  s, y: -s },
        'bottom-left':  { x: -s, y:  s },
        'bottom-right': { x:  s, y:  s },
    };
    return moves[zone] || { x: 0, y: 0 };
}

// ==========================================
// 7. ZOOM MODE
// Look at the center of the screen for 1 second to enter zoom mode.
// Then look at the upper half to zoom in, or lower half to zoom out.
// ==========================================
function checkZoom(x, y) {
    const centerIndicator = document.getElementById('center-indicator');
    const progressCircle  = document.querySelector('.center-progress');

    const inCenter    = x >= 0.4 && x <= 0.6 && y >= 0.4 && y <= 0.6;
    const inUpperArea = x > 0.2 && x < 0.8 && y < 0.4;
    const inLowerArea = x > 0.2 && x < 0.8 && y > 0.6;

    if (inCenter && !zoomMode) {
        // User is looking at center - start or continue the progress timer
        if (!lookingAtCenter) {
            lookingAtCenter     = true;
            centerLookStartTime = Date.now();
            centerIndicator.classList.add('active');
        } else {
            const elapsed  = Date.now() - centerLookStartTime;
            const progress = Math.min(elapsed / ZOOM_CENTER_TIME, 1);
            progressCircle.style.strokeDashoffset = 220 - (progress * 220);

            if (elapsed >= ZOOM_CENTER_TIME) {
                // Zoom mode activated
                zoomMode        = true;
                lookingAtCenter = false;
                centerIndicator.classList.remove('active');
                progressCircle.style.strokeDashoffset = 220;
                console.log('✅ Zoom mode activated!');
            }
        }
    } else if (zoomMode) {
        // Zoom mode active - look up to zoom in, down to zoom out
        if (inUpperArea) {
            map.zoomIn();
            zoomMode = false;
            console.log('🔍 Zoomed in');
        } else if (inLowerArea) {
            map.zoomOut();
            zoomMode = false;
            console.log('🔍 Zoomed out');
        } else if (!inCenter) {
            zoomMode = false; // Cancel zoom mode if looking elsewhere
        }
    } else if (!inCenter) {
        // Reset center indicator when not looking at center
        lookingAtCenter     = false;
        centerLookStartTime = null;
        centerIndicator.classList.remove('active');
        progressCircle.style.strokeDashoffset = 220;
    }
}

// ==========================================
// 8. MAIN ANIMATION LOOP
// Runs every frame via requestAnimationFrame.
// Handles map panning, zoom mode, and legend interaction.
// ==========================================
function update() {
    try {
        // --- Map panning via edge zones ---
        const zone = getZone(gazeX, gazeY);

        if (zone !== currentZone) {
            currentZone   = zone;
            zoneEnterTime = zone ? Date.now() : null;
            isMoving      = false;
            highlightEdge(null);
            if (zone) console.log('📍 Entered zone:', zone);
        }

        if (zone && zoneEnterTime) {
            const dwellTime = Date.now() - zoneEnterTime;
            if (dwellTime >= CONFIG.dwellTimeMs && !isMoving) {
                isMoving = true;
                highlightEdge(zone);
                console.log('🟢 Moving:', zone);
            }
        }

        const move = getMovement(zone);
        if (move.x || move.y) {
            map.panBy([move.x, move.y], { animate: false });
        }

        // --- Zoom mode check ---
        checkZoom(gazeX, gazeY);

        // --- Legend dwell interaction ---
        const legendContainer = document.getElementById('eye-legend-container');

        if (legendContainer && !interactionLocked) {
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
        // Silently catch any map rendering errors during animation
    }

    requestAnimationFrame(update);
}

// ==========================================
// 9. GAZE POSITION UPDATE
// Called by the WebSocket handler whenever new gaze data arrives.
// Updates the red dot position on screen.
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
// 10. WEBSOCKET CONNECTION (GazeDeck)
// Connects to the eye tracker software running locally on port 8765.
// Receives binary gaze data packets and passes coordinates to updateGaze().
// Automatically reconnects if the connection is lost.
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
// 11. LEGEND TILE ACTIVATION
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
// 12. KEYBOARD SHORTCUT: Return to start
// Press 'H' at any time to fly back to the starting position and zoom level.
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
});

// ==========================================
// 13. STARTUP
// Waits for the map style to load, then initializes data, controls, and eye tracking.
// ==========================================
console.log('👁️ Eye-tracking map starting...');
console.log('💡 Look outside the screen edges to pan the map');
console.log('🔍 Look at the center for 1 second, then up/down to zoom');
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

    // Start the main animation loop
    update();
});