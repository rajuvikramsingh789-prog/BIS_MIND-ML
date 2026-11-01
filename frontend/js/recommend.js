/* Know Your BIS - Product Standard Recommender Logic */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('recommend-form');
    const input = document.getElementById('product-input');
    const resultsContainer = document.getElementById('recommend-results');
    const exampleBtns = document.querySelectorAll('.example-btn');

    if (form && input && resultsContainer) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const productDesc = input.value.trim();
            if (!productDesc) return;

            await runRecommendation(productDesc);
        });

        exampleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-query');
                input.value = text;
                runRecommendation(text);
            });
        });
    }
});

async function runRecommendation(productDescription) {
    const resultsContainer = document.getElementById('recommend-results');
    resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
            <div class="typing-indicator" style="justify-content: center;">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <p style="margin-top: 1rem; color: var(--text-muted);">Analyzing product scope against 15,000+ Indian Standards and Quality Control Orders...</p>
        </div>
    `;

    try {
        const data = await APIClient.recommendStandard(productDescription);

        let html = '';

        // Top Summary Card
        const confidencePercent = Math.round((data.confidenceScore || 0.85) * 100);
        html += `
            <div class="card" style="border-left: 5px solid var(--primary-color); margin-bottom: 2rem;">
                <div class="card-header">
                    <div>
                        <h2 class="card-title">BIS Compliance Analysis for "${data.query}"</h2>
                        <p class="card-subtitle">Official Standard Identification & Mandatory Guidance</p>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge badge-scheme">Match Confidence: ${confidencePercent}%</span>
                    </div>
                </div>
                <div class="markdown-body" style="margin-top: 1rem;">
                    ${parseSimpleMarkdown(data.recommendationText)}
                </div>
            </div>
        `;

        // Matched Standards Grid
        if (data.matchedStandards && data.matchedStandards.length > 0) {
            html += `<h3 style="margin-bottom: 1rem; color: var(--primary-color);">Relevant Indian Standards (${data.matchedStandards.length})</h3>`;
            html += `<div class="grid-2">`;

            data.matchedStandards.forEach(std => {
                html += `
                    <div class="card">
                        <div class="card-header">
                            <div>
                                <h3 class="card-title">${std.isNumber}:${std.year}</h3>
                                <p class="card-subtitle">${std.category}</p>
                            </div>
                            <span class="badge ${std.isMandatory ? 'badge-mandatory' : 'badge-voluntary'}">
                                ${std.isMandatory ? 'MANDATORY QCO' : 'VOLUNTARY'}
                            </span>
                        </div>
                        <p style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.5rem;">${std.title}</p>
                        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1rem;">${std.scope}</p>
                        
                        <div style="font-size: 0.85rem; background: rgba(13, 59, 102, 0.04); padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem;">
                            <strong>Certification Scheme:</strong> ${std.scheme}<br>
                            ${std.isMandatory ? '<strong>Order:</strong> ' + std.qcoOrder : ''}
                        </div>

                        <a href="${std.officialUrl}" target="_blank" class="btn btn-outline" style="width: 100%; font-size: 0.85rem;">
                            🌐 View Official Specification on BIS Portal
                        </a>
                    </div>
                `;
            });

            html += `</div>`;
        }

        resultsContainer.innerHTML = html;

    } catch (err) {
        resultsContainer.innerHTML = `
            <div class="card" style="border-left: 5px solid #ef4444;">
                <h3 style="color: #ef4444;">Analysis Error</h3>
                <p>Failed to analyze product: ${err.message}</p>
            </div>
        `;
    }
}

// Markdown Parser Helper
function parseSimpleMarkdown(text) {
    if (!text) return '';
    let parsed = text;
    parsed = parsed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    parsed = parsed.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    parsed = parsed.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    parsed = parsed.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    parsed = parsed.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    parsed = parsed.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    parsed = parsed.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');
    parsed = parsed.replace(/\n\n/g, '<br><br>');
    return parsed;
}
