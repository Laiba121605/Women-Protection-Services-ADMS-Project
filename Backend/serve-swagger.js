// serve-swagger.js
// Run: node serve-swagger.js
// Then open: http://localhost:3001/api-docs

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const app  = express();
const PORT = 3001;

// Load and parse the swagger YAML
const swaggerDocument = yaml.load(
    fs.readFileSync(path.join(__dirname, 'swagger.yaml'), 'utf8')
);

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'WPS API Docs',
    swaggerOptions: {
        persistAuthorization: true,   // keeps the Bearer token between page refreshes
        displayRequestDuration: true, // shows response time
        filter: true,                 // adds a filter box to search endpoints
        tryItOutEnabled: true,        // enables "Try it out" by default
    }
}));

// Serve raw JSON (useful for importing into Postman or other tools)
app.get('/api-docs.json', (req, res) => {
    res.json(swaggerDocument);
});

app.listen(PORT, () => {
    console.log(`\n✅ Swagger UI running at:  http://localhost:${PORT}/api-docs`);
    console.log(`   Raw JSON available at:   http://localhost:${PORT}/api-docs.json\n`);
    console.log('Steps to test:');
    console.log('  1. Make sure your WPS server is running on port 5000');
    console.log('  2. Open http://localhost:3001/api-docs in your browser');
    console.log('  3. Click Authorize (🔒) and paste your JWT token');
    console.log('  4. Use "Try it out" on any endpoint\n');
});