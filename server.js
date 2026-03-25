/**
 * server.js — Express server for Aura.
 * 
 * Serves the frontend and provides the analysis API.
 */

import express from 'express';
import { analyzeCodebase } from './analyzer/index.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(resolve(__dirname, 'public')));

// Serve 3d-force-graph from node_modules
app.use('/lib/3d-force-graph', express.static(
    resolve(__dirname, 'node_modules/3d-force-graph/dist')
));
app.use('/lib/three', express.static(
    resolve(__dirname, 'node_modules/three/build')
));

// JSON body parsing
app.use(express.json());

// Cache for analysis results
let analysisCache = null;
let cachedPath = null;

/**
 * POST /api/analyze
 * Body: { path: "/absolute/path/to/codebase", options: {} }
 * Returns the graph JSON.
 */
app.post('/api/analyze', async (req, res) => {
    try {
        const { path: targetPath, options = {} } = req.body;

        if (!targetPath) {
            return res.status(400).json({ error: 'Missing "path" in request body' });
        }

        const resolvedPath = resolve(targetPath);
        console.log(`[server] Analyze request for: ${resolvedPath}`);

        // Use cache if same path
        if (cachedPath === resolvedPath && analysisCache && !options.force) {
            console.log(`[server] Returning cached result`);
            return res.json(analysisCache);
        }

        const graph = await analyzeCodebase(resolvedPath, options);
        analysisCache = graph;
        cachedPath = resolvedPath;

        res.json(graph);
    } catch (err) {
        console.error(`[server] Analysis error:`, err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

app.listen(PORT, () => {
    console.log(`\n  ✨ Aura is running at http://localhost:${PORT}\n`);
});
