// tagsloader.js - snap to edges

document.addEventListener('DOMContentLoaded', () => {
    console.log('Starting to load tags...');

    fetch('my_screen/surface_layout.yaml') 
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch YAML');
            return response.text();
        })
        .then(yamlText => {
            const data = jsyaml.load(yamlText);
            
            const yamlRefWidth = data.size[0];  // 1920
            const yamlRefHeight = data.size[1]; // 1080

            const container = document.getElementById('apriltags-container');
            container.innerHTML = ''; 

            //tolerance for snapping to edges
            // 5 % for 25px space
            const SNAP_THRESHOLD = 0.05; 

            for (const [tagId, tagData] of Object.entries(data.tags)) {
                const corners = tagData.corners;

                // Getting dimensions from YAML
                const xs = corners.map(c => c[0]);
                const ys = corners.map(c => c[1]);
                
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);
                const widthPx = Math.max(...xs) - minX;
                const heightPx = Math.max(...ys) - minY; // Needed for bottom edge calculation

                // Basic calculation in percentages (as before)
                let leftPercent = (minX / yamlRefWidth) * 100;
                let topPercent = (minY / yamlRefHeight) * 100;
                const widthPercent = (widthPx / yamlRefWidth) * 100;

                // Creating the element
                const tag = document.createElement('div');
                tag.className = 'apriltag';
                tag.dataset.id = tagId;
                
                tag.style.position = 'fixed';
                tag.style.width = widthPercent.toFixed(4) + '%';
                
                // --- SNAP TO EDGES LOGIC ---
                
                // 1. Check LEFT edge
                if (minX / yamlRefWidth < SNAP_THRESHOLD) {
                    tag.style.left = '0px'; // Snap to left edge
                } else {
                    tag.style.left = leftPercent.toFixed(4) + '%';
                }

                // 2. Check RIGHT edge  
                // If it ends near the right edge (minX + width > 95% width)
                if ((minX + widthPx) / yamlRefWidth > (1 - SNAP_THRESHOLD)) {
                    tag.style.left = 'auto';  // Remove left
                    tag.style.right = '0px';  // Snap to right edge
                }

                // 3. Check TOP edge
                if (minY / yamlRefHeight < SNAP_THRESHOLD) {
                    tag.style.top = '0px';
                } else {
                    tag.style.top = topPercent.toFixed(4) + '%';
                }

                // 4. Check BOTTOM edge
                if ((minY + heightPx) / yamlRefHeight > (1 - SNAP_THRESHOLD)) {
                    tag.style.top = 'auto';
                    tag.style.bottom = '0px';
                }

                // Image
                const img = document.createElement('img');
                img.src = `my_screen/tag_${tagId}.png`; 
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                
                // Disable dragging with mouse
                img.draggable = false;

                tag.appendChild(img);
                container.appendChild(tag);
            }
            
            console.log(`Loaded ${Object.keys(data.tags).length} tags (Edge Snapping Active).`);
        })
        .catch(err => {
            console.error('Error loading tags:', err);
        });
});