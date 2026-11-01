/* Know Your BIS - Search & Catalog JS */

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('catalog-search-input');
    const categorySelect = document.getElementById('category-filter');
    const resultsGrid = document.getElementById('standards-grid');

    if (searchInput && resultsGrid) {
        let debounceTimer;

        const performSearch = async () => {
            const query = searchInput.value.trim();
            const category = categorySelect ? categorySelect.value : 'All';

            try {
                const data = await APIClient.searchStandards(query, category);
                renderStandardsGrid(data.results, resultsGrid);
            } catch (err) {
                resultsGrid.innerHTML = `<p style="color: #ef4444;">Failed to search standards: ${err.message}</p>`;
            }
        };

        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(performSearch, 250);
        });

        if (categorySelect) {
            categorySelect.addEventListener('change', performSearch);
        }

        // Initial Load
        performSearch();
    }
});

function renderStandardsGrid(standards, container) {
    if (!standards || standards.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                🔍 No Indian Standards found matching your search query.
            </div>
        `;
        return;
    }

    let html = '';
    standards.forEach(std => {
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
                
                <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 1rem;">
                    <strong>Department:</strong> ${std.department || 'General'}<br>
                    <strong>Scheme:</strong> ${std.scheme}
                </div>

                <a href="${std.officialUrl}" target="_blank" class="btn btn-outline" style="width: 100%; font-size: 0.85rem;">
                    📖 View Official Standard Details
                </a>
            </div>
        `;
    });

    container.innerHTML = html;
}
