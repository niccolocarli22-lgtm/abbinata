// State Management
let closet = JSON.parse(localStorage.getItem('my_virtual_closet')) || [];
let currentSection = 'dashboard';
let currentCategoryFilter = 'tutti';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    updateDashboardCounts();
    renderCloset();
    initCalendar();
    
    // Refresh Icons after rendering
    if (window.lucide) lucide.createIcons();
});

// Navigation logic
function switchSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    
    currentSection = sectionId;
}

// Image Upload Logic
let pendingImage = null;

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            pendingImage = e.target.result;
            document.getElementById('preview-img').src = pendingImage;
            document.getElementById('upload-form').style.display = 'block';
            document.querySelector('.upload-zone').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

function saveNewItem() {
    const category = document.getElementById('item-category').value;
    const color = document.getElementById('item-color').value;
    
    const newItem = {
        id: Date.now(),
        image: pendingImage,
        category: category,
        color: color,
        status: 'disponibile', // disponibile, sporco, lavaggio, indosso
        added: new Date().toISOString()
    };
    
    closet.push(newItem);
    localStorage.setItem('my_virtual_closet', JSON.stringify(closet));
    
    // Reset Form
    pendingImage = null;
    document.getElementById('upload-form').style.display = 'none';
    document.querySelector('.upload-zone').style.display = 'block';
    
    // UI Update
    updateDashboardCounts();
    renderCloset();
    switchSection('armadio');
    
    showToast('Capo aggiunto con successo!');
}

// Rendering Closet
function renderCloset() {
    const container = document.getElementById('clothes-grid');
    container.innerHTML = '';
    
    const filtered = closet.filter(item => {
        if (currentCategoryFilter === 'tutti') return true;
        return item.status === currentCategoryFilter;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 4rem;">Nessun capo trovato in questa categoria.</p>`;
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <img src="${item.image}" class="item-img" alt="Vestito">
            <div class="item-info">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span class="status-tag status-${item.status}">${item.status}</span>
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${item.color}; border: 1px solid rgba(255,255,255,0.2);"></div>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button class="nav-btn" onclick="updateItemStatus(${item.id}, 'disponibile')" title="Pulito" style="padding: 5px;"><i data-lucide="sparkles" size="16"></i></button>
                    <button class="nav-btn" onclick="updateItemStatus(${item.id}, 'sporco')" title="Sporco" style="padding: 5px;"><i data-lucide="trash-2" size="16"></i></button>
                    <button class="nav-btn" onclick="updateItemStatus(${item.id}, 'lavaggio')" title="In Lavaggio" style="padding: 5px;"><i data-lucide="droplets" size="16"></i></button>
                    <button class="nav-btn" onclick="deleteItem(${item.id})" title="Elimina" style="padding: 5px; color: var(--accent-red); margin-left: auto;"><i data-lucide="x" size="16"></i></button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    
    if (window.lucide) lucide.createIcons();
}

function updateItemStatus(id, newStatus) {
    closet = closet.map(item => item.id === id ? {...item, status: newStatus} : item);
    localStorage.setItem('my_virtual_closet', JSON.stringify(closet));
    renderCloset();
    updateDashboardCounts();
}

function deleteItem(id) {
    if (confirm('Sei sicuro di voler eliminare questo capo?')) {
        closet = closet.filter(item => item.id !== id);
        localStorage.setItem('my_virtual_closet', JSON.stringify(closet));
        renderCloset();
        updateDashboardCounts();
    }
}

function filterCloset(status) {
    currentCategoryFilter = status;
    document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.innerText.toLowerCase().includes(status.replace('disponibile', 'puliti')));
    });
    renderCloset();
}

// counts
function updateDashboardCounts() {
    document.getElementById('count-available').innerText = closet.filter(i => i.status === 'disponibile').length;
    document.getElementById('count-dirty').innerText = closet.filter(i => i.status === 'sporco').length;
    document.getElementById('count-wash').innerText = closet.filter(i => i.status === 'lavaggio').length;
}

// AI Matching Logic
async function updateWeather() {
    try {
        // Milano coords as default
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=45.4642&longitude=9.1900&current=temperature_2m,weather_code');
        const data = await res.json();
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        
        const weatherEl = document.getElementById('weather-info');
        let icon = 'sun';
        if (code > 3) icon = 'cloud';
        if (code > 50) icon = 'cloud-rain';
        
        weatherEl.innerHTML = `
            <i data-lucide="${icon}" size="48" style="margin-bottom: 1rem; color: var(--secondary);"></i>
            <div style="font-size: 2rem; font-weight: 700;">${temp}°C</div>
            <div style="color: var(--text-dim);">Milano, ${icon === 'sun' ? 'Sereno' : 'Nuvoloso'}</div>
        `;
        lucide.createIcons();
        return temp;
    } catch (e) {
        console.error("Weather fetch failed", e);
        return 22; // Fallback
    }
}

async function generateOutfit() {
    const temp = await updateWeather();
    const available = closet.filter(i => i.status === 'disponibile');
    
    // Filtro per temperatura
    let suitableTops = available.filter(i => i.category === 'top');
    let suitableOuter = available.filter(i => i.category === 'outerwear');
    
    if (temp < 15) {
        // Serve un capospalla se fa freddo
        if (suitableOuter.length === 0) {
            showToast("Fa freddo! Aggiungi una giacca o un cappotto per un consiglio migliore.");
        }
    } else if (temp > 25) {
        // Solo magliette leggere
        suitableOuter = [];
    }

    const tops = suitableTops;
    const bottoms = available.filter(i => i.category === 'bottom');
    const shoes = available.filter(i => i.category === 'shoes');
    
    if (tops.length === 0 || bottoms.length === 0) {
        showToast("Carica almeno un Top e un Pantalone puliti!");
        return;
    }

    const randomTop = tops[Math.floor(Math.random() * tops.length)];
    const randomBottom = bottoms[Math.floor(Math.random() * bottoms.length)];
    const randomShoes = shoes.length > 0 ? shoes[Math.floor(Math.random() * shoes.length)] : null;
    const randomOuter = temp < 18 && suitableOuter.length > 0 ? suitableOuter[Math.floor(Math.random() * suitableOuter.length)] : null;
    const accessories = available.filter(i => i.category === 'accessory');
    const randomAcc = accessories.length > 0 ? accessories[Math.floor(Math.random() * accessories.length)] : null;

    const container = document.getElementById('suggestion-container');
    container.innerHTML = `
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem; overflow-x: auto; padding-bottom: 1rem;">
            ${randomOuter ? `
            <div class="match-item">
                <img src="${randomOuter.image}" style="width: 100px; height: 120px; object-fit: cover; border-radius: 12px; border: 2px solid ${randomOuter.color}">
                <p style="font-size: 0.6rem; text-align: center; margin-top: 5px;">ESTERNO</p>
            </div>
            ` : ''}
            <div class="match-item">
                <img src="${randomTop.image}" style="width: 100px; height: 120px; object-fit: cover; border-radius: 12px; border: 2px solid ${randomTop.color}">
                <p style="font-size: 0.6rem; text-align: center; margin-top: 5px;">SOPRA</p>
            </div>
            <div class="match-item">
                <img src="${randomBottom.image}" style="width: 100px; height: 120px; object-fit: cover; border-radius: 12px; border: 2px solid ${randomBottom.color}">
                <p style="font-size: 0.6rem; text-align: center; margin-top: 5px;">SOTTO</p>
            </div>
            ${randomShoes ? `
            <div class="match-item">
                <img src="${randomShoes.image}" style="width: 100px; height: 120px; object-fit: cover; border-radius: 12px; border: 2px solid ${randomShoes.color}">
                <p style="font-size: 0.6rem; text-align: center; margin-top: 5px;">SCARPE</p>
            </div>
            ` : ''}
            ${randomAcc ? `
            <div class="match-item">
                <img src="${randomAcc.image}" style="width: 100px; height: 120px; object-fit: cover; border-radius: 12px; border: 2px solid ${randomAcc.color}">
                <p style="font-size: 0.6rem; text-align: center; margin-top: 5px;">ACCESSORIO</p>
            </div>
            ` : ''}
        </div>
        <div class="glass-card" style="margin-top: 1rem; padding: 1rem; border-radius: 16px;">
            <p style="font-size: 0.85rem; line-height: 1.4;">
                <span style="color: var(--primary);">✦</span> <strong>Analisi AI:</strong> 
                Considerando i ${temp}°C a Milano, questo abbinamento bilancia comfort e stile. 
                ${temp < 15 ? 'Si consiglia di chiudere la giacca.' : 'Un look fresco e traspirante.'}
            </p>
        </div>
    `;
}

// Chiamata iniziale meteo
updateWeather();

// Calendar Mock
function initCalendar() {
    const grid = document.getElementById('calendar-grid');
    const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    
    days.forEach(day => {
        const d = document.createElement('div');
        d.className = 'glass-card';
        d.style.padding = '1rem';
        d.style.textAlign = 'center';
        d.innerHTML = `<div style="font-size: 0.8rem; margin-bottom: 0.5rem; font-weight: 700;">${day}</div>
                       <i data-lucide="plus" size="16" style="color: var(--text-dim); cursor: pointer;"></i>`;
        grid.appendChild(d);
    });
}

// Utility
function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '2rem';
    toast.style.right = '2rem';
    toast.style.background = 'var(--primary)';
    toast.style.padding = '1rem 2rem';
    toast.style.borderRadius = '12px';
    toast.style.zIndex = '1000';
    toast.style.animation = 'fadeIn 0.3s ease-out';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
