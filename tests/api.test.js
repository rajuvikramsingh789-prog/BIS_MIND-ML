const http = require('http');
const app = require('../backend/app');
const { getDatabase } = require('../database/init');
const { seedDatabase } = require('../database/seed');

let server;
const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, body: json });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('===================================================');
    console.log('🚀 Running Know Your BIS API Integration Tests');
    console.log('===================================================');

    // 1. Ensure DB Seeded
    try {
        const db = getDatabase();
        const count = db.prepare(`SELECT COUNT(*) as c FROM standards`).get().c;
        if (count === 0) seedDatabase();
    } catch (e) {
        console.error('DB seed error:', e.message);
    }

    server = app.listen(PORT);

    let failed = false;

    try {
        // Test 1: GET /api/health
        console.log('Testing GET /api/health...');
        const healthRes = await makeRequest('GET', '/api/health');
        if (healthRes.status === 200 && healthRes.body.status === 'healthy') {
            console.log('✅ GET /api/health PASSED');
        } else {
            console.error('❌ GET /api/health FAILED', healthRes);
            failed = true;
        }

        // Test 2: GET /api/standards
        console.log('Testing GET /api/standards...');
        const stdsRes = await makeRequest('GET', '/api/standards');
        if (stdsRes.status === 200 && stdsRes.body.standards.length > 0) {
            console.log(`✅ GET /api/standards PASSED (${stdsRes.body.standards.length} standards found)`);
        } else {
            console.error('❌ GET /api/standards FAILED', stdsRes);
            failed = true;
        }

        // Test 3: GET /api/services
        console.log('Testing GET /api/services...');
        const srvRes = await makeRequest('GET', '/api/services');
        if (srvRes.status === 200 && srvRes.body.services.length > 0) {
            console.log(`✅ GET /api/services PASSED (${srvRes.body.services.length} services found)`);
        } else {
            console.error('❌ GET /api/services FAILED', srvRes);
            failed = true;
        }

        // Test 4: GET /api/search?q=water
        console.log('Testing GET /api/search?q=water...');
        const searchRes = await makeRequest('GET', '/api/search?q=water');
        if (searchRes.status === 200 && searchRes.body.results.length > 0) {
            console.log(`✅ GET /api/search PASSED (${searchRes.body.results.length} matches found)`);
        } else {
            console.error('❌ GET /api/search FAILED', searchRes);
            failed = true;
        }

        // Test 5: POST /api/recommend-standard
        console.log('Testing POST /api/recommend-standard...');
        const recRes = await makeRequest('POST', '/api/recommend-standard', {
            productDescription: 'I manufacture TMT steel rebar'
        });
        if (recRes.status === 200 && recRes.body.primaryStandard) {
            console.log(`✅ POST /api/recommend-standard PASSED (Recommended: ${recRes.body.primaryStandard.isNumber})`);
        } else {
            console.error('❌ POST /api/recommend-standard FAILED', recRes);
            failed = true;
        }

        // Test 6: POST /api/chat
        console.log('Testing POST /api/chat...');
        const chatRes = await makeRequest('POST', '/api/chat', {
            message: 'Is IS 14543 mandatory for packaged drinking water?'
        });
        if (chatRes.status === 200 && chatRes.body.answer) {
            console.log('✅ POST /api/chat PASSED (Received grounded answer)');
        } else {
            console.error('❌ POST /api/chat FAILED', chatRes);
            failed = true;
        }

        // Test 7: POST /api/feedback
        console.log('Testing POST /api/feedback...');
        const fbRes = await makeRequest('POST', '/api/feedback', {
            queryText: 'Is IS 14543 mandatory?',
            rating: 1,
            comments: 'Very accurate response'
        });
        if (fbRes.status === 200 && fbRes.body.success) {
            console.log('✅ POST /api/feedback PASSED');
        } else {
            console.error('❌ POST /api/feedback FAILED', fbRes);
            failed = true;
        }

    } catch (err) {
        console.error('Test execution error:', err);
        failed = true;
    } finally {
        server.close();
        if (failed) {
            console.error('❌ Integration Tests Completed with Failures.');
            process.exit(1);
        } else {
            console.log('===================================================');
            console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
            console.log('===================================================');
            process.exit(0);
        }
    }
}

runTests();
