// ==========================================
// 1. CONFIGURATION
// Central place to adjust map start position, movement speed, and dwell timing.
// ==========================================
const CONFIG = {
    startLat:    49.593777,
    startLng:    17.250879,
    startZoom:   11,
    moveSpeed:   8,       // Pixels per frame the map moves when looking at an edge
    dwellTimeMs: 500      // Milliseconds to look at an edge before movement starts
};

// ==========================================
// 2. MAP INITIALIZATION
// Interactive mode is disabled - panning and zooming are controlled by gaze.
// Legend tiles are activated by mouse click (defined in layers.js).
// ==========================================
const map = new maplibregl.Map({
    container:   'map',
    style:       'https://tiles.versatiles.org/assets/styles/colorful/style.json',
    center:      [CONFIG.startLng, CONFIG.startLat],
    zoom:        CONFIG.startZoom,
    interactive: false // Disables mouse pan and scroll zoom - gaze controls movement
});

// ==========================================
// 3. GAZE STATE
// Variables for tracking gaze position, edge navigation, and zoom mode.
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
// Handles map panning and zoom mode via gaze.
// Legend is controlled by mouse click - no dwell logic here.
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

    } catch (e) {
        // Silently catch any map rendering errors during animation
    }

    requestAnimationFrame(update);
}

// ==========================================
// 9. GAZE POSITION UPDATE
// Called by the WebSocket handler whenever new gaze data arrives.
// Updates the red dot and gaze coordinates used for movement and zoom.
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
// Gaze coordinates are used for map panning and zoom mode.
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
// 11. KEYBOARD SHORTCUTS
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
// 12. STARTUP
// Waits for the map style to load, then initializes data, eye tracking, and the loop.
// ==========================================
console.log('👁️🖱️ Active-passive map starting...');
console.log('👁️ Gaze controls panning and zooming');
console.log('🖱️ Mouse click controls legend highlight');
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