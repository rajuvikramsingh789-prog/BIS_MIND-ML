const { getDatabase } = require('./init');
const fs = require('fs');
const path = require('path');

function seedDatabase() {
    const db = getDatabase();
    console.log('Seeding Know Your BIS database...');

    // Load JSON data
    const standardsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/bis_standards.json'), 'utf8'));
    const qcoData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/qco_orders.json'), 'utf8'));
    const servicesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/bis_services.json'), 'utf8'));

    db.transaction(() => {
        // 1. Seed Sources
        const insertSource = db.prepare(`
            INSERT OR REPLACE INTO sources (id, name, url, type, publisher, trust_tier)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        insertSource.run(
            'src-bis-gov',
            'Bureau of Indian Standards Official Portal',
            'https://www.bis.gov.in/',
            'official_portal',
            'Bureau of Indian Standards',
            1
        );
        insertSource.run(
            'src-standards-bis',
            'BIS Standards Portal (BSBEDGE)',
            'https://standardsbis.bsbedge.com/',
            'standards_catalog',
            'Bureau of Indian Standards',
            1
        );
        insertSource.run(
            'src-crs-bis',
            'BIS Compulsory Registration Scheme Portal',
            'https://www.crsbis.in/BIS/',
            'official_portal',
            'MeitY & BIS',
            1
        );

        // 2. Seed Standards
        const insertStandard = db.prepare(`
            INSERT OR REPLACE INTO standards (
                id, is_number, year, title, category, department, is_mandatory,
                qco_order, qco_notification_date, enforcing_ministry, scope,
                testing_requirements, clauses, scheme, official_url, lab_capabilities
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const std of standardsData) {
            insertStandard.run(
                std.id,
                std.isNumber,
                std.year,
                std.title,
                std.category,
                std.department || 'General Department',
                std.isMandatory ? 1 : 0,
                std.qcoOrder || null,
                std.qcoNotificationDate || null,
                std.enforcingMinistry || null,
                std.scope,
                JSON.stringify(std.testingRequirements || []),
                JSON.stringify(std.clauses || []),
                std.scheme,
                std.officialUrl,
                JSON.stringify(std.labCapabilities || [])
            );

            // Also create a Document entry for RAG
            const docId = `doc-${std.id}`;
            db.prepare(`
                INSERT OR REPLACE INTO documents (id, source_id, title, document_type, is_number, year, category, content, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                docId,
                'src-standards-bis',
                `${std.isNumber}:${std.year} ${std.title}`,
                'standard_spec',
                std.isNumber,
                std.year,
                std.category,
                `${std.isNumber}:${std.year} - ${std.title}.\nScope: ${std.scope}\nMandatory QCO: ${std.isMandatory ? std.qcoOrder : 'Voluntary'}.\nScheme: ${std.scheme}`,
                JSON.stringify({ mandatory: std.isMandatory, scheme: std.scheme })
            );

            // Create Chunks for RAG
            let chunkIdx = 0;
            // General Chunk
            db.prepare(`
                INSERT OR REPLACE INTO document_chunks (id, document_id, chunk_index, content, is_number, keywords)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                `chunk-${std.id}-overview`,
                docId,
                chunkIdx++,
                `Standard ${std.isNumber}:${std.year}: ${std.title}. Category: ${std.category}. Scope: ${std.scope}. Mandatory Status: ${std.isMandatory ? 'MANDATORY under QCO (' + std.qcoOrder + ')' : 'Voluntary Benchmark'}. Certified Scheme: ${std.scheme}. Testing Requirements: ${(std.testingRequirements || []).join(', ')}.`,
                std.isNumber,
                `${std.isNumber}, ${std.title}, ${std.category}, ${std.scheme}, mandatory, ISI mark`
            );

            // Clause Chunks
            for (const clause of (std.clauses || [])) {
                db.prepare(`
                    INSERT OR REPLACE INTO document_chunks (id, document_id, chunk_index, content, is_number, clause_no, clause_title, keywords)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    `chunk-${std.id}-clause-${clause.clauseNo.replace(/\./g, '_')}`,
                    docId,
                    chunkIdx++,
                    `Official Clause ${clause.clauseNo} (${clause.title}) of ${std.isNumber}: ${clause.text}`,
                    std.isNumber,
                    clause.clauseNo,
                    clause.title,
                    `${std.isNumber}, clause ${clause.clauseNo}, ${clause.title}`
                );
            }
        }

        // 3. Seed QCO Documents & Chunks
        for (const qco of qcoData) {
            const docId = `doc-${qco.id}`;
            db.prepare(`
                INSERT OR REPLACE INTO documents (id, source_id, title, document_type, content, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                docId,
                'src-bis-gov',
                qco.orderName,
                'qco_order',
                `Official Notification ${qco.notificationNumber} dated ${qco.notificationDate} issued by ${qco.issuingMinistry}. ${qco.summary} Affected Products: ${qco.affectedProducts.join(', ')}.`,
                JSON.stringify(qco)
            );

            db.prepare(`
                INSERT OR REPLACE INTO document_chunks (id, document_id, chunk_index, content, keywords)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                `chunk-${qco.id}`,
                docId,
                0,
                `Quality Control Order: ${qco.orderName} (${qco.notificationNumber}, ${qco.notificationDate}) issued by ${qco.issuingMinistry}. Summary: ${qco.summary} Mandatory Coverage: ${qco.affectedProducts.join('; ')}.`,
                `${qco.orderName}, QCO, ${qco.issuingMinistry}, mandatory certification`
            );
        }

        // 4. Seed Services
        const insertService = db.prepare(`
            INSERT OR REPLACE INTO services (
                id, name, category, description, target_audience, key_steps, portal_url, is_mandatory_available
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const srv of servicesData) {
            insertService.run(
                srv.id,
                srv.name,
                srv.category,
                srv.description,
                srv.targetAudience,
                JSON.stringify(srv.keySteps),
                srv.portalUrl,
                srv.isMandatoryAvailable ? 1 : 0
            );

            // Document & Chunks for RAG
            const docId = `doc-service-${srv.id}`;
            db.prepare(`
                INSERT OR REPLACE INTO documents (id, source_id, title, document_type, content)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                docId,
                'src-bis-gov',
                `BIS Service: ${srv.name}`,
                'scheme_doc',
                `${srv.name} (${srv.category}): ${srv.description}\nTarget Audience: ${srv.targetAudience}\nPortal: ${srv.portalUrl}`
            );

            db.prepare(`
                INSERT OR REPLACE INTO document_chunks (id, document_id, chunk_index, content, keywords)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                `chunk-service-${srv.id}`,
                docId,
                0,
                `BIS Service ${srv.name}: ${srv.description} Key Steps: ${srv.keySteps.join(' -> ')}. Target: ${srv.targetAudience}. Portal: ${srv.portalUrl}`,
                `${srv.name}, ${srv.category}, BIS scheme, ${srv.portalUrl}`
            );
        }
    })();

    console.log('Successfully seeded database with official BIS standards, QCO orders, and services data!');
}

if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };
