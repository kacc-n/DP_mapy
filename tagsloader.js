// ==========================================
// TAGSLOADER.JS
// Reads AprilTag positions from a YAML config file and places
// them on screen as fixed HTML elements.
// Tags snap to screen edges when they are within 5% of the border.
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📍 Loading AprilTags...');

    fetch('../../my_screen/surface_layout.yaml')
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch surface_layout.yaml');
            return response.text();
        })
        .then(yamlText => {
            const data = jsyaml.load(yamlText);

            // Reference resolution the YAML coordinates are based on
            const yamlRefWidth  = data.size[0]; // e.g. 1920
            const yamlRefHeight = data.size[1]; // e.g. 1080

            const container = document.getElementById('apriltags-container');
            container.innerHTML = ''; // Clear any existing tags

            // Tags within 5% of a screen edge will snap flush to that edge
            const SNAP_THRESHOLD = 0.05;

            for (const [tagId, tagData] of Object.entries(data.tags)) {
                const corners = tagData.corners;

                // Calculate bounding box from corner coordinates
                const xs      = corners.map(c => c[0]);
                const ys      = corners.map(c => c[1]);
                const minX    = Math.min(...xs);
                const minY    = Math.min(...ys);
                const widthPx = Math.max(...xs) - minX;
                const heightPx = Math.max(...ys) - minY;

                // Convert position and size to percentages for responsive placement
                const leftPercent  = (minX / yamlRefWidth)  * 100;
                const topPercent   = (minY / yamlRefHeight) * 100;
                const widthPercent = (widthPx / yamlRefWidth) * 100;

                // Create the tag container element
                const tag = document.createElement('div');
                tag.className  = 'apriltag';
                tag.dataset.id = tagId;
                tag.style.position = 'fixed';
                tag.style.width    = widthPercent.toFixed(4) + '%';

                // --- EDGE SNAPPING ---
                // Snap to left edge if tag starts within 5% of left border
                if (minX / yamlRefWidth < SNAP_THRESHOLD) {
                    tag.style.left = '0px';
                } else {
                    tag.style.left = leftPercent.toFixed(4) + '%';
                }

                // Snap to right edge if tag ends within 5% of right border
                if ((minX + widthPx) / yamlRefWidth > (1 - SNAP_THRESHOLD)) {
                    tag.style.left  = 'auto';
                    tag.style.right = '0px';
                }

                // Snap to top edge if tag starts within 5% of top border
                if (minY / yamlRefHeight < SNAP_THRESHOLD) {
                    tag.style.top = '0px';
                } else {
                    tag.style.top = topPercent.toFixed(4) + '%';
                }

                // Snap to bottom edge if tag ends within 5% of bottom border
                if ((minY + heightPx) / yamlRefHeight > (1 - SNAP_THRESHOLD)) {
                    tag.style.top    = 'auto';
                    tag.style.bottom = '0px';
                }

                // Create and attach the tag image
                const img = document.createElement('img');
                img.src            = `../../my_screen/tag_${tagId}.png`;
                img.style.width    = '100%';
                img.style.height   = '100%';
                img.style.objectFit = 'contain';
                img.draggable      = false; // Prevent accidental dragging

                tag.appendChild(img);
                container.appendChild(tag);
            }

            console.log(`✅ ${Object.keys(data.tags).length} AprilTags loaded (edge snapping active).`);
        })
        .catch(err => {
            console.error('❌ Error loading AprilTags:', err);
        });
});