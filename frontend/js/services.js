/* Know Your BIS - BIS Services Display JS */

document.addEventListener('DOMContentLoaded', () => {
    const servicesGrid = document.getElementById('services-grid');
    if (servicesGrid) {
        loadServices();
    }
});

async function loadServices() {
    const servicesGrid = document.getElementById('services-grid');
    try {
        const data = await APIClient.getServices();
        
        if (!data || !data.services || data.services.length === 0) {
            servicesGrid.innerHTML = '<p>No services found.</p>';
            return;
        }

        let html = '';
        data.services.forEach(srv => {
            html += `
                <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div class="card-header">
                            <div>
                                <h3 class="card-title">${srv.name}</h3>
                                <p class="card-subtitle">${srv.category}</p>
                            </div>
                            ${srv.is_mandatory_available ? '<span class="badge badge-mandatory">Mandatory Schemes</span>' : ''}
                        </div>
                        
                        <p style="font-size: 0.92rem; margin-bottom: 1rem;">${srv.description}</p>
                        
                        <div style="font-size: 0.85rem; background: rgba(13, 59, 102, 0.04); padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem;">
                            <strong>Target Audience:</strong> ${srv.target_audience || 'Manufacturers & Citizens'}
                        </div>

                        ${srv.key_steps && srv.key_steps.length > 0 ? `
                            <div style="font-size: 0.85rem; margin-bottom: 1rem;">
                                <strong>Key Implementation Steps:</strong>
                                <ol style="padding-left: 1.2rem; margin-top: 0.3rem;">
                                    ${srv.key_steps.map(step => `<li style="margin-bottom: 0.25rem;">${step}</li>`).join('')}
                                </ol>
                            </div>
                        ` : ''}
                    </div>

                    <a href="${srv.portal_url}" target="_blank" class="btn btn-primary" style="width: 100%; font-size: 0.9rem;">
                        🌐 Access Official Portal
                    </a>
                </div>
            `;
        });

        servicesGrid.innerHTML = html;

    } catch (err) {
        servicesGrid.innerHTML = `<p style="color: #ef4444;">Failed to load services: ${err.message}</p>`;
    }
}
