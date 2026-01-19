// =========================================
// CONFIGURATION
// =========================================
const CONFIG = {
    startLat: 49.593777,
    startLng: 17.250879,
    startZoom: 16,
    moveSpeed: 8,
    dwellTimeMs: 500,
};

// =========================================
// INITIALIZE MAP (MapLibre GL JS)
// =========================================
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.versatiles.org/assets/styles/colorful/style.json',
    center: [CONFIG.startLng, CONFIG.startLat],
    zoom: CONFIG.startZoom,
    interactive: false // Disable all default interactions
});

/* const scale = new maplibregl.ScaleControl({
  maxWidth: 100,
  unit: 'metric' // 'metric', 'imperial', or 'nautical'
});

map.addControl(scale, 'bottom-left');
 */

// =========================================
// STATE
// =========================================
let gazeX = 0.2, gazeY = 0.5;
let currentZone = null, zoneEnterTime = null, isMoving = false;

// Zoom state
let lookingAtCenter = false;
let centerLookStartTime = null;
let zoomMode = false;
const ZOOM_CENTER_TIME = 1000;
const ZOOM_CONFIRM_TIME = 500;

// =========================================
// DETECT ZONE
// =========================================
function getZone(x, y) {
    if ((y < 0 && x < 0.2) || (y < 0.2 && x < 0)) return 'top-left';
    if ((y < 0 && x > 0.8) || (y < 0.2 && x > 1)) return 'top-right';
    if ((y > 0.8 && x < 0) || (y > 1 && x < 0.2)) return 'bottom-left';
    if ((y > 1 && x > 0.8) || (y > 0.8 && x > 1)) return 'bottom-right';
    if (y < 0 && x > 0.2 && x < 0.8) return 'top';
    if (y > 1 && x > 0.2 && x < 0.8) return 'bottom';
    if (x < 0 && y > 0.2 && y < 0.8) return 'left';
    if (x > 1 && y > 0.2 && y < 0.8) return 'right';
    
    return null;
}

// =========================================
// HIGHLIGHT EDGE
// =========================================
function highlightEdge(zone) {
    document.querySelectorAll('.edge-highlight').forEach(el => el.remove());
    if (!zone) return;
    
    const div = document.createElement('div');
    div.className = 'edge-highlight';
    
    const styles = {
        'top': 'top:0;left:20%;width:60%;height:15px',
        'bottom': 'bottom:0;left:20%;width:60%;height:15px',
        'left': 'left:0;top:20%;width:15px;height:60%',
        'right': 'right:0;top:20%;width:15px;height:60%',
        'top-left': 'top:0;left:0;width:200px;height:200px;border-radius:0 0 100% 0',
        'top-right': 'top:0;right:0;width:200px;height:200px;border-radius:0 0 0 100%',
        'bottom-left': 'bottom:0;left:0;width:200px;height:200px;border-radius:0 100% 0 0',
        'bottom-right': 'bottom:0;right:0;width:200px;height:200px;border-radius:100% 0 0 0',
    };
    
    div.style.cssText = styles[zone] || '';
    document.body.appendChild(div);
}

// =========================================
// CALCULATE MOVEMENT
// =========================================
function getMovement(zone) {
    if (!zone || !isMoving) return {x: 0, y: 0};
    const s = CONFIG.moveSpeed;
    const moves = {
        'top': {x:0, y:-s}, 'bottom': {x:0, y:s},
        'left': {x:-s, y:0}, 'right': {x:s, y:0},
        'top-left': {x:-s, y:-s}, 'top-right': {x:s, y:-s},
        'bottom-left': {x:-s, y:s}, 'bottom-right': {x:s, y:s},
    };
    return moves[zone] || {x:0, y:0};
}

// =========================================
// ZOOM FUNCTION
// =========================================
function checkZoom(x, y) {
    const centerIndicator = document.getElementById('center-indicator');
    const progressCircle = document.querySelector('.center-progress');
    
    const inCenterX = x >= 0.4 && x <= 0.6;
    const inCenterY = y >= 0.4 && y <= 0.6;
    const inCenter = inCenterX && inCenterY;
    
    const inUpperArea = x > 0.2 && x < 0.8 && y < 0.4;
    const inLowerArea = x > 0.2 && x < 0.8 && y > 0.6;
    
    if (inCenter && !zoomMode) {
        if (!lookingAtCenter) {
            lookingAtCenter = true;
            centerLookStartTime = Date.now();
            centerIndicator.classList.add('active');
        } else {
            const elapsed = Date.now() - centerLookStartTime;
            const progress = Math.min(elapsed / ZOOM_CENTER_TIME, 1);
            const offset = 220 - (progress * 220);
            progressCircle.style.strokeDashoffset = offset;
            
            if (elapsed >= ZOOM_CENTER_TIME) {
                zoomMode = true;
                lookingAtCenter = false;
                centerIndicator.classList.remove('active');
                progressCircle.style.strokeDashoffset = 220;
                console.log('✅ ZOOM MODE ACTIVATED!');
            }
        }
    } 
    else if (zoomMode) {
        if (inUpperArea) {
            console.log('🔍 ZOOM IN!');
            map.zoomIn();
            zoomMode = false;
        } else if (inLowerArea) {
            console.log('🔍 ZOOM OUT!');
            map.zoomOut();
            zoomMode = false;
        } else if (!inCenter && !inUpperArea && !inLowerArea) {
            zoomMode = false;
        }
    }
    else if (!inCenter) {
        lookingAtCenter = false;
        centerLookStartTime = null;
        centerIndicator.classList.remove('active');
        progressCircle.style.strokeDashoffset = 220;
    }
}

// =========================================
// MAIN LOOP
// =========================================
function update() {
    try {
        const zone = getZone(gazeX, gazeY);
        
        if (zone !== currentZone) {
            currentZone = zone;
            zoneEnterTime = zone ? Date.now() : null;
            isMoving = false;
            highlightEdge(null);
            if (zone) console.log('📍 Entered zone:', zone);
        }
        
        if (zone && zoneEnterTime) {
            const dwellTime = Date.now() - zoneEnterTime;
            if (dwellTime >= CONFIG.dwellTimeMs && !isMoving) {
                isMoving = true;
                console.log('🟢 Activating zone:', zone);
                highlightEdge(zone);
            }
        }
        
        // Move map
        const move = getMovement(zone);
        if (move.x || move.y) {
            map.panBy([move.x, move.y], {animate: false});
        }
        
        checkZoom(gazeX, gazeY);
    } catch (e) {
        // Ignore map errors during window resize
    }
    
    requestAnimationFrame(update);
}

// =========================================
// GAZE UPDATE
// =========================================
function updateGaze(x, y) {
    gazeX = x;
    gazeY = y;
    const dot = document.getElementById('gaze-dot');
    dot.style.display = 'block';
    dot.style.left = x * window.innerWidth + 'px';
    dot.style.top = y * window.innerHeight + 'px';
}

// =========================================
// WEBSOCKET
// =========================================
let messageCount = 0;
let wsConnection = null;

function connectGazeDeck() {
    console.log('🔌 Connecting to GazeDeck at ws://localhost:8765...');
    
    wsConnection = new WebSocket('ws://localhost:8765');
    wsConnection.binaryType = 'arraybuffer';
    
    wsConnection.onopen = () => {
        console.log('✅ GazeDeck connected successfully!');
        console.log('👁️ Waiting for gaze data...');
    };
    
    wsConnection.onmessage = (e) => {
        const v = new DataView(e.data);
        const deviceId = v.getInt32(0, true);
        const surfaceId = v.getInt32(4, true);
        const x = v.getFloat32(8, true);
        const y = v.getFloat32(12, true);
        const timestamp = v.getFloat64(16, true);
        
        messageCount++;
        
        if (messageCount <= 5) {
            console.log(`📦 Message #${messageCount}:`, {
                deviceId,
                surfaceId,
                x: x.toFixed(3),
                y: y.toFixed(3),
                timestamp,
                valid: !isNaN(x) && !isNaN(y)
            });
        }
        
        if (messageCount % 100 === 0) {
            console.log(`✔ ${messageCount} messages received | Latest: x=${x.toFixed(3)}, y=${y.toFixed(3)}`);
        }
        
        if (!isNaN(x) && !isNaN(y)) {
            updateGaze(x, y);
        } else {
            console.warn('⚠️ Invalid gaze data:', {x, y});
        }
    };
    
    wsConnection.onerror = (error) => {
        console.error('❌ GazeDeck connection error:', error);
        console.log('💡 Troubleshooting:');
        console.log('   1. Is GazeDeck running?');
        console.log('   2. Is the IP correct? (currently: localhost:8765)');
        console.log('   3. Check firewall settings');
    };
    
    wsConnection.onclose = () => {
        console.log('🔌 GazeDeck disconnected. Reconnecting in 2 seconds...');
        messageCount = 0;
        setTimeout(connectGazeDeck, 2000);
    };
}

// =========================================
// INIT - SINGLE map.on('load') EVENT!
// =========================================
console.log('👁️ EYE-TRACKING MODE');
console.log('💡 Look OUTSIDE screen to move map');

map.on('load', async () => {
    console.log('✅ Map ready');
    console.log('🕐 Dwell time: 500ms');
    console.log('🔍 Zoom: Look at CENTER (1s) → then UP/DOWN');
    
    await loadData(map);
    initEyeLegend(map);
    
    map.addControl(
    new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    }),
    'bottom-left'
  );

    // START EYE TRACKING
    connectGazeDeck();
    update();
});