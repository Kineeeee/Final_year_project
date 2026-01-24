const Logger = require('../utils/Logger');

class SpatialGrid {
    /**
     * @param {number} worldSize - Size of the world (assumes square 0,0 to size,size)
     * @param {number} cellSize - Size of each grid cell (e.g., 200)
     */
    constructor(worldSize, cellSize) {
        this.worldSize = worldSize;
        this.cellSize = cellSize;
        this.cols = Math.ceil(worldSize / cellSize);
        this.rows = Math.ceil(worldSize / cellSize);

        // Map<cellKey(string), Set<entity>>
        // Use Map/Set for O(1) add/delete
        this.cells = new Map();
        
        // Track which keys an entity belongs to for faster updates
        // WeakMap isn't suitable if we want to iterate easily, but Map<entityId, string[]> works
        // However, sticking to storing keys on entity instance is faster if allowed (e.g. entity._gridKeys)
        // If we want minimal intrusion, we use a separate map.
        this.entityKeys = new Map(); 
    }

    /**
     * Get unique key for cell coordinates
     */
    getKey(col, row) {
        return `${col},${row}`;
    }

    /**
     * Get cell coordinate for world position
     */
    getCellIndex(pos) {
        return Math.floor(pos / this.cellSize);
    }

    /**
     * Add entity to the grid.
     * Entity must have {id, x, y} properties.
     * Optional: {radius} or {width, height} for multi-cell registration.
     * For snakes/points, we usually just register the center point or head.
     * If precise collision is needed, register multiple points or bounding box.
     */
    add(entity) {
        if (!entity || !entity.id) return;

        // For now, simpler point-based registration (Head)
        // Or if entity has radius, register in all overlapping cells
        const keys = this.getOverlappingKeys(entity);
        
        this.entityKeys.set(entity.id, keys);

        for (const key of keys) {
            if (!this.cells.has(key)) {
                this.cells.set(key, new Set());
            }
            this.cells.get(key).add(entity);
        }
    }

    /**
     * Remove entity from grid
     */
    remove(entity) {
        if (!entity || !entity.id) return;

        const keys = this.entityKeys.get(entity.id);
        if (!keys) return;

        for (const key of keys) {
            const cell = this.cells.get(key);
            if (cell) {
                cell.delete(entity);
                if (cell.size === 0) {
                    this.cells.delete(key);
                }
            }
        }
        this.entityKeys.delete(entity.id);
    }

    /**
     * Update entity position in grid
     */
    update(entity) {
        this.remove(entity);
        this.add(entity);
    }

    /**
     * Get keys for cells that the entity overlaps with.
     * Handles point or circle/rect if properties exist.
     */
    getOverlappingKeys(entity) {
        const x = entity.x;
        const y = entity.y;
        
        // Default to point check
        let minCol = this.getCellIndex(x);
        let minRow = this.getCellIndex(y);
        let maxCol = minCol;
        let maxRow = minRow;

        // Support radius buffer
        const r = entity.radius || 0;
        if (r > 0) {
            minCol = this.getCellIndex(x - r);
            maxCol = this.getCellIndex(x + r);
            minRow = this.getCellIndex(y - r);
            maxRow = this.getCellIndex(y + r);
        }

        const keys = [];
        for (let c = minCol; c <= maxCol; c++) {
            for (let r = minRow; r <= maxRow; r++) {
                // Optional: Check bounds? 
                // Grid allows infinite or bounded. 
                // Since world is 0-WORLD_SIZE, we can clamp or just allow negative keys (hash map handles it).
                keys.push(this.getKey(c, r));
            }
        }
        return keys;
    }

    /**
     * Query entities within a rectangular area (or radius approx) around a point.
     * Returns a Set of unique entities (because an entity might be in multiple cells).
     */
    query(x, y, radius) {
        const results = new Set();
        
        const minCol = this.getCellIndex(x - radius);
        const maxCol = this.getCellIndex(x + radius);
        const minRow = this.getCellIndex(y - radius);
        const maxRow = this.getCellIndex(y + radius);

        for (let c = minCol; c <= maxCol; c++) {
            for (let r = minRow; r <= maxRow; r++) {
                const key = this.getKey(c, r);
                const cell = this.cells.get(key);
                if (cell) {
                    for (const entity of cell) {
                        results.add(entity);
                    }
                }
            }
        }
        return results;
    }

    /**
     * Optimized Query: Returns Array instead of Set if uniqueness is not guaranteed or check externally.
     * To avoid Set overhead, we can return iterator or flatten.
     * BUT Set is safer to avoid double-checking the same entity.
     */
    
    getStats() {
        return {
            cells: this.cells.size,
            entities: this.entityKeys.size
        };
    }
}

module.exports = SpatialGrid;
