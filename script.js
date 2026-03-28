const ITEM_DB = {
    apple: { name: 'แอปเปิล', icon: '🍎', type: 'God Food' },
    soil:  { name: 'ดิน',    icon: '🟫', type: 'Nature' },
    water: { name: 'น้ำ',    icon: '💧', type: 'Nature' },
    stone: { name: 'หิน',    icon: '🪨', type: 'Nature' },
    stick: { name: 'กิ่งไม้', icon: '🥢', type: 'Material' }
};

const ACTIONS = {
    eat: { input: { apple: 1 }, costE: 0, label: 'กินแอปเปิล' },
    trade_soil: { input: { apple: 1 }, costE: 0, label: 'แลกดิน' },
    trade_water: { input: { apple: 1 }, costE: 0, label: 'แลกน้ำ' },
    trade_stone: { input: { apple: 1 }, costE: 0, label: 'แลกหิน' },
    plant_apple: { input: { apple: 1, soil: 1, water: 1 }, costE: 4, label: 'ปลูกแอปเปิล' },
    f_water: { input: { water: 1 }, costE: 1, label: 'รดน้ำ' },
    f_destroy: { costE: 1, label: 'ทำลาย' },
    f_harvest: { costE: 1, label: 'เก็บเกี่ยว' }
};

const GROWTH_STAGES = {
    seed:    { name: 'ต้นอ่อน', icon: '🌱', hours: 12, next: 'small', canDestroy: false }, 
    small:   { name: 'ต้นแอปเปิล(เล็ก)', icon: '🌿', hours: 36, next: 'big', canDestroy: true, gain: { stick: 3 } },
    big:     { name: 'ต้นแอปเปิล(ใหญ่)', icon: '🌳', hours: 24, next: 'ready', canDestroy: true, gain: { stick: 5 } },
    ready:   { name: 'พร้อมเก็บเกี่ยว', icon: '🍎🌳', canHarvest: true, canDestroy: true, gain: { stick: 5 } }
};

let gameState = { 
    energy: 0, 
    inventory: { apple: 40, soil: 0, water: 0, stone: 0, stick: 0 }, 
    farms: [],
    lastUpdate: Date.now(),
    lastDailyReward: null
};

let currentAction = '', currentItemId = '', currentFarmIdx = -1;

function saveGame() {
    gameState.lastUpdate = Date.now();
    localStorage.setItem('the_apple_save', JSON.stringify(gameState));
}

function loadGame() {
    const saved = localStorage.getItem('the_apple_save');
    if (saved) {
        const parsed = JSON.parse(saved);
        gameState = parsed;
        calculateOfflineProgress();
    }
}

function calculateOfflineProgress() {
    const now = Date.now();
    const diffMs = now - gameState.lastUpdate;
    const diffHours = diffMs / (1000 * 60 * 60);

    gameState.farms.forEach(p => {
        const s = GROWTH_STAGES[p.stage];
        if (s.hours && p.isWatered) {
            p.elapsed += diffHours;
            while (p.stage && GROWTH_STAGES[p.stage].hours && p.elapsed >= GROWTH_STAGES[p.stage].hours) {
                p.elapsed -= GROWTH_STAGES[p.stage].hours;
                p.stage = GROWTH_STAGES[p.stage].next;
                p.isWatered = false; 
                if (!GROWTH_STAGES[p.stage].hours) break; 
            }
        }
    });

    checkDailyReward();
    gameState.lastUpdate = now;
}

function checkDailyReward() {
    const now = new Date();
    const todayStr = now.toDateString();
    if (gameState.lastDailyReward !== todayStr && now.getHours() >= 7) {
        gameState.inventory.apple += 1;
        gameState.lastDailyReward = todayStr;
        console.log("Daily reward 7:00 AM granted!");
    }
}

setInterval(() => {
    const now = Date.now();
    const diffMs = now - gameState.lastUpdate;
    const diffHours = diffMs / (1000 * 60 * 60);

    gameState.farms.forEach(p => {
        const s = GROWTH_STAGES[p.stage];
        if (s.hours && p.isWatered) {
            p.elapsed += diffHours;
            if (p.elapsed >= s.hours) {
                p.stage = s.next;
                p.elapsed = 0;
                p.isWatered = false;
            }
        }
    });

    checkDailyReward();
    gameState.lastUpdate = now;
    updateTimeDisplay();
    render();
    saveGame();
}, 1000);

function updateTimeDisplay() {
    const now = new Date();
    document.getElementById('date').innerText = now.toLocaleDateString('th-TH', {year:'numeric', month:'long', day:'numeric'});
    document.getElementById('time').innerText = now.toLocaleTimeString('th-TH', {hour12:false});
}

function render() {
    document.getElementById('stat-energy').innerText = Math.floor(gameState.energy);
    
    const invList = document.getElementById('inventory-list');
    invList.innerHTML = '';
    let hasItem = false;
    Object.keys(gameState.inventory).forEach(id => {
        const qty = gameState.inventory[id];
        if (qty > 0) {
            hasItem = true;
            invList.innerHTML += `
                <div class="data-row">
                    <div class="item-info-inline">
                        <span>${ITEM_DB[id].icon}</span>
                        <span class="main-text">${ITEM_DB[id].name} <span class="type-label">(${ITEM_DB[id].type})</span></span>
                    </div>
                    <div style="display: flex; align-items: center;">
                        <span class="item-qty">x${qty}</span>
                        <button class="btn-action" style="padding: 2px 6px; font-size: 0.7rem;" onclick="openModalMenu('${id}')">ใช้</button>
                    </div>
                </div>`;
        }
    });
    if(!hasItem) invList.innerHTML = '<div style="color:#ccc; text-align:center; padding:10px; font-size:0.8rem;">- ว่างเปล่า -</div>';

    const farmList = document.getElementById('farming-list');
    farmList.innerHTML = '';
    if (gameState.farms.length === 0) farmList.innerHTML = '<div style="color:#ccc; text-align:center; padding:20px;">- พื้นที่ว่าง -</div>';
    
    gameState.farms.forEach((p, idx) => {
        const s = GROWTH_STAGES[p.stage];
        const prog = s.hours ? (p.elapsed / s.hours) * 100 : 100;
        let lifeTag = (p.stage === 'big' || p.stage === 'ready') ? `<span class="lifespan-tag"> (${p.harvestCount || 0}/10)</span>` : '';
        let btns = p.stage === 'ready' ? `<button class="btn-harvest" onclick="openFarmAction('f_harvest', ${idx})">เก็บเกี่ยว</button>` : !p.isWatered ? `<button class="btn-action" onclick="openFarmAction('f_water', ${idx})">รดน้ำ</button>` : '';
        if (s.canDestroy) btns += ` <button class="btn-destroy" onclick="openFarmAction('f_destroy', ${idx})" style="margin-left:2px;">ทำลาย</button>`;

        farmList.innerHTML += `
            <div class="data-row" style="flex-direction:column; align-items:flex-start; padding: 6px 10px;">
                <div style="display:flex; justify-content:space-between; width:100%; align-items: center;">
                    <div class="item-info-inline">
                        <span>${s.icon}</span>
                        <span class="main-text">${s.name}${lifeTag}</span>
                    </div>
                    <div>${btns}</div>
                </div>
                <div style="display: flex; align-items: center; width: 100%; gap: 10px; margin-top: 5px;">
                    <div class="progress-container" style="flex: 1; margin-top: 0; height: 6px;">
                        <div class="progress-bar" style="width:${Math.min(prog, 100)}%"></div>
                    </div>
                    <div style="font-size:0.65rem; color:#666; white-space: nowrap; font-family: monospace;">
                        ${s.hours ? '<b>'+Math.floor(p.elapsed)+'</b>/'+s.hours+'h' : '✨ READY'}
                    </div>
                </div>
            </div>`;
    });
}

function openFarmAction(actionKey, idx) {
    currentAction = actionKey;
    currentFarmIdx = idx;
    currentItemId = ''; 
    const act = ACTIONS[actionKey];
    document.getElementById('itemModal').style.display = 'flex';
    document.getElementById('modal-header').innerText = `ยืนยัน${act.label}`;
    hideAllModalPanels();
    document.getElementById('action-panel').style.display = 'block';
    if (actionKey === 'f_harvest') {
        document.getElementById('amount-controller').style.display = 'block';
        document.getElementById('max-label').innerText = "เลือกใช้พลังงาน (1 หรือ 2)";
        document.getElementById('action-amount').value = 1;
    } else {
        document.getElementById('amount-controller').style.display = 'none';
    }
    document.getElementById('btn-back').style.display = 'inline-block';
    document.getElementById('btn-back').innerText = "ยกเลิก"; 
    updateActionPreview();
}

function openModalMenu(id) {
    currentItemId = id;
    currentFarmIdx = -1;
    document.getElementById('itemModal').style.display = 'flex';
    document.getElementById('modal-header').innerText = `${ITEM_DB[id].icon} จัดการ ${ITEM_DB[id].name}`;
    hideAllModalPanels(); backToMain();
    document.getElementById('opt-eat').style.display = (id === 'apple') ? 'block' : 'none';
    document.getElementById('opt-trade').style.display = (id === 'apple') ? 'block' : 'none';
}

function hideAllModalPanels() {
    ['function-selector','trade-selector','plant-selector','action-panel'].forEach(id => document.getElementById(id).style.display = 'none');
}

function showTradeSelector() { hideAllModalPanels(); document.getElementById('trade-selector').style.display = 'flex'; }
function showPlantSelector() { if (currentItemId === 'apple') { setupAction('plant_apple'); return; } hideAllModalPanels(); document.getElementById('plant-selector').style.display = 'flex'; }
function backToMain() { hideAllModalPanels(); document.getElementById('function-selector').style.display = 'flex'; }
function backToPrevious() { 
    if (currentFarmIdx !== -1) closeModal();
    else if (currentAction.startsWith('trade')) showTradeSelector(); 
    else backToMain(); 
}

function setupAction(key) {
    currentAction = key;
    currentFarmIdx = -1;
    hideAllModalPanels();
    document.getElementById('action-panel').style.display = 'block';
    document.getElementById('amount-controller').style.display = 'block';
    document.getElementById('max-label').innerText = "ระบุจำนวน";
    document.getElementById('btn-back').style.display = 'inline-block';
    document.getElementById('btn-back').innerText = "ย้อนกลับ";
    document.getElementById('action-amount').value = 1;
    updateActionPreview();
}

function validateInput() {
    let input = document.getElementById('action-amount');
    let val = parseInt(input.value);
    if (isNaN(val) || val < 1) input.value = 1;
    if (currentAction === 'f_harvest' && val > 2) input.value = 2;
    updateActionPreview();
}

function changeAmt(v) {
    let input = document.getElementById('action-amount');
    let current = parseInt(input.value) || 1;
    let next = current + v;
    if (currentAction === 'f_harvest') {
        if (next < 1) next = 1;
        if (next > 2) next = 2;
    } else {
        if (next < 1) next = 1;
    }
    input.value = next; 
    updateActionPreview();
}

function updateActionPreview() {
    const isFarmAction = currentAction.startsWith('f_');
    const amt = (currentAction === 'f_harvest' || !isFarmAction) ? (parseInt(document.getElementById('action-amount').value) || 1) : 1;
    const act = ACTIONS[currentAction];
    const costDiv = document.getElementById('cost-preview');
    const gainDiv = document.getElementById('gain-preview');
    const btnSubmit = document.getElementById('btn-submit');
    costDiv.innerHTML = ''; gainDiv.innerHTML = '';
    let canDo = true;

    if (act.input) {
        Object.keys(act.input).forEach(id => {
            const totalRequired = act.input[id] * amt;
            const isEnough = gameState.inventory[id] >= totalRequired;
            if (!isEnough) canDo = false;
            costDiv.innerHTML += `<div class="preview-item ${isEnough ? 'text-enough' : 'text-not-enough'}">${ITEM_DB[id].icon} x${totalRequired}</div>`;
        });
    }
    const energyRequired = act.costE * amt;
    const isEnergyEnough = gameState.energy >= energyRequired;
    if (!isEnergyEnough) canDo = false;
    costDiv.innerHTML += `<div class="preview-item ${isEnergyEnough ? 'text-enough' : 'text-not-enough'}">⚡ x${energyRequired}</div>`;

    let gainHtml = '';
    if (currentAction === 'eat') gainHtml = `<div class="preview-item">⚡ พลังงาน +${amt}</div>`;
    else if (currentAction === 'trade_soil') gainHtml = `<div class="preview-item">🟫 ดิน +${amt}</div>`;
    else if (currentAction === 'trade_water') gainHtml = `<div class="preview-item">💧 น้ำ +${amt}</div>`;
    else if (currentAction === 'trade_stone') gainHtml = `<div class="preview-item">🪨 หิน +${amt}</div>`;
    else if (currentAction === 'plant_apple') gainHtml = `<div class="preview-item">🌱 ปลูก x${amt} ต้น</div>`;
    else if (currentAction === 'f_harvest') {
        gainHtml = `<div class="preview-item">🍎 แอปเปิล +10</div>`;
        if (amt === 2) gainHtml += `<div class="preview-item">🥢 กิ่งไม้ +3</div>`;
    }
    else if (currentAction === 'f_destroy') {
        const s = GROWTH_STAGES[gameState.farms[currentFarmIdx].stage];
        if (s.gain) Object.keys(s.gain).forEach(id => { gainHtml += `<div class="preview-item">${ITEM_DB[id].icon} ${ITEM_DB[id].name} +${s.gain[id]}</div>`; });
        else gainHtml = '<div class="preview-item">คืนพื้นที่ปลูก</div>';
    }
    else if (currentAction === 'f_water') gainHtml = `<div class="preview-item">✅ รดน้ำสำเร็จ</div>`;
    
    gainDiv.innerHTML = gainHtml || '-';
    btnSubmit.disabled = !canDo;
    btnSubmit.innerText = canDo ? "ยืนยัน" : "ทรัพยากรไม่เพียงพอ";
}

function executeAction() {
    const isFarmAction = currentAction.startsWith('f_');
    const amt = (currentAction === 'f_harvest' || !isFarmAction) ? (parseInt(document.getElementById('action-amount').value) || 0) : 1;
    const act = ACTIONS[currentAction];
    let canDo = true;
    if (act.input) Object.keys(act.input).forEach(id => { if(gameState.inventory[id] < act.input[id]*amt) canDo = false; });
    if (gameState.energy < act.costE*amt) canDo = false;
    if (!canDo) return;

    gameState.energy -= act.costE * amt;
    if (act.input) Object.keys(act.input).forEach(id => gameState.inventory[id] -= act.input[id] * amt);
    
    if (currentAction === 'plant_apple') {
        for(let i=0; i<amt; i++) gameState.farms.push({ stage: 'seed', elapsed: 0, isWatered: true, harvestCount: 0 });
    } 
    else if (currentAction === 'eat') { gameState.energy += amt; }
    else if (currentAction.startsWith('trade_')) { 
        const itemId = currentAction.replace('trade_', '');
        gameState.inventory[itemId] += amt; 
    }
    else if (currentAction === 'f_water') { gameState.farms[currentFarmIdx].isWatered = true; }
    else if (currentAction === 'f_destroy') {
        const s = GROWTH_STAGES[gameState.farms[currentFarmIdx].stage];
        if(s.gain) Object.keys(s.gain).forEach(id => gameState.inventory[id] += s.gain[id]);
        gameState.farms.splice(currentFarmIdx, 1);
    }
    else if (currentAction === 'f_harvest') {
        gameState.inventory.apple += 10;
        if (amt === 2) gameState.inventory.stick += 3;
        gameState.farms[currentFarmIdx].harvestCount++;
        if (gameState.farms[currentFarmIdx].harvestCount >= 10) {
            alert('🌳 ต้นไม้แก่ตายแล้ว!');
            gameState.farms.splice(currentFarmIdx, 1);
            closeModal(); render(); return; 
        } else {
            gameState.farms[currentFarmIdx].stage = 'big';
            gameState.farms[currentFarmIdx].elapsed = 0;
            gameState.farms[currentFarmIdx].isWatered = false;
        }
    }
    closeModal(); render(); saveGame();
}

function closeModal() { document.getElementById('itemModal').style.display = 'none'; }

// เริ่มต้นโหลดเกม
loadGame();
updateTimeDisplay(); 
render();