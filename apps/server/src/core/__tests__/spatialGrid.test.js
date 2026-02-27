const test = require('node:test');
const assert = require('node:assert');
const SpatialGrid = require('../SpatialGrid');

test('SpatialGrid adds and queries entities within radius', () => {
    const grid = new SpatialGrid(1000, 100);
    const entity = { id: 'p1', x: 120, y: 140 };
    grid.add(entity);

    const results = grid.query(130, 150, 50);
    assert(results.has(entity), 'entity should be returned by query');
});

test('SpatialGrid remove makes entity undiscoverable', () => {
    const grid = new SpatialGrid(1000, 100);
    const entity = { id: 'p2', x: 300, y: 300 };
    grid.add(entity);
    grid.remove(entity);

    const results = grid.query(300, 300, 80);
    assert(!results.has(entity), 'entity should be removed from query results');
});
