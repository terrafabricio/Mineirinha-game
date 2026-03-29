/* ============================================
   SÍTIO DA MINEIRINHA - GAME + AUTH
   ============================================ */

// ==========================================
// SUPABASE CONFIG
// ==========================================
const SUPABASE_URL = 'https://teoxhfhneuxfogejnjdo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlb3hoZmhuZXV4Zm9nZWpuamRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDQ5NzEsImV4cCI6MjA5MDM4MDk3MX0.L_IGpn73XNH2ydnNmfKBT7EMzMim0Igxj36p3_dZfEM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// GAME STATE
// ==========================================
const G = window.G = {
    user: null,
    displayName: '',
    coins: 0,
    inv: { corn: 0, flour: 0, farofa: 0 },
    plots: Array.from({ length: 9 }, () => ({ state: 'empty', growth: 0 })),
    upgrades: { growth: 0, value: 0, toast: 0, plots: 0 },
    selectedTool: 'plant',
    selectedIngredients: ['manteiga'],
    lastQuality: null,
    totalSold: 0,
    totalEarned: 0,
    scene: 'farm'
};

const MAX_GROWTH = 100;
const GROWTH_RATE = 1.5;
const WATER_BOOST = 20;
const CORN_PER_HARVEST = 2;
const BASE_PRICE = 10;

const FALAS = {
    welcome: ['Bem-vinda ao sítio! Bora plantar!', 'Oi! Vamos fazer farofa!', 'Eita, chegou visita!'],
    plant: ['Plantou direitinho!', 'Milho na terra!', 'Boa! Agora espera crescer!'],
    water: ['Água fresquinha! 💧', 'Cresce mais rápido agora!'],
    harvest: ['Colheita boa! 🌽', 'Milho bonito esse!'],
    grind: ['Farinha saindo! 🌾', 'Moeu bonito!'],
    cookPerfect: ['PERFEITO! Que cheiro bom! ⭐', 'Mão de ouro na cozinha!'],
    cookGood: ['Ficou boa! 👍', 'Dá pra vender!'],
    cookBad: ['Eita, queimou... 😅', 'Cuidado com o fogo!'],
    sell: ['Vendeu! 💰', 'Moeda no bolso!', 'O povo ama!'],
    noItem: ['Falta item! Volta na etapa anterior!']
};

// ==========================================
// DOM HELPERS
// ==========================================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ==========================================
// AUTH
// ==========================================
function initAuth() {
    // Tab switching
    $$('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            $$('.auth-form').forEach(f => f.classList.remove('active'));
            $(`#${tab.dataset.tab}-form`).classList.add('active');
            hideAuthMessages();
        });
    });

    // Login
    $('#login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthMessages();
        const email = $('#login-email').value.trim();
        const password = $('#login-password').value;
        const btn = $('#login-form .auth-btn');
        btn.disabled = true;
        btn.textContent = '⏳ Entrando...';

        const { data, error } = await sb.auth.signInWithPassword({ email, password });

        btn.disabled = false;
        btn.textContent = '🎮 Jogar!';

        if (error) {
            showAuthError(traduzirErro(error.message));
            return;
        }

        G.user = data.user;
        await loadGameFromDB();
        enterGame();
    });

    // Register
    $('#register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthMessages();
        const name = $('#reg-name').value.trim();
        const email = $('#reg-email').value.trim();
        const password = $('#reg-password').value;
        const btn = $('#register-form .auth-btn');
        btn.disabled = true;
        btn.textContent = '⏳ Criando...';

        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: { data: { display_name: name } }
        });

        btn.disabled = false;
        btn.textContent = '📝 Criar Conta';

        if (error) {
            showAuthError(traduzirErro(error.message));
            return;
        }

        // Check if email confirmation is needed
        if (data.user && !data.session) {
            showAuthSuccess('Conta criada! Verifique seu e-mail para confirmar.');
            return;
        }

        G.user = data.user;
        G.displayName = name;
        await createSaveInDB(name);
        await loadGameFromDB();
        enterGame();
    });

    // Logout
    $('#btn-logout').addEventListener('click', async () => {
        await saveGameToDB();
        await sb.auth.signOut();
        G.user = null;
        exitGame();
    });

    // Check existing session
    checkSession();
}

async function checkSession() {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        G.user = session.user;
        await loadGameFromDB();
        enterGame();
    }
}

function traduzirErro(msg) {
    if (msg.includes('Invalid login')) return 'E-mail ou senha incorretos.';
    if (msg.includes('already registered')) return 'Este e-mail já está cadastrado.';
    if (msg.includes('valid email')) return 'Informe um e-mail válido.';
    if (msg.includes('least 6')) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde um momento.';
    return msg;
}

function showAuthError(msg) {
    const el = $('#auth-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function showAuthSuccess(msg) {
    const el = $('#auth-success');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function hideAuthMessages() {
    $('#auth-error').classList.add('hidden');
    $('#auth-success').classList.add('hidden');
}

function enterGame() {
    $('#auth-screen').classList.remove('active');
    $('#game-screen').classList.add('active');
    $('#hud-player-name').textContent = G.displayName || 'Jogador';
    updateHUD();
    speak('welcome');
    celebrateChar();
}

function exitGame() {
    $('#game-screen').classList.remove('active');
    $('#auth-screen').classList.add('active');
    // Reset forms
    $('#login-email').value = '';
    $('#login-password').value = '';
    hideAuthMessages();
}

// ==========================================
// DATABASE SAVE/LOAD
// ==========================================
async function createSaveInDB(name) {
    await sb.from('game_saves').insert({
        user_id: G.user.id,
        display_name: name,
        coins: 0, corn: 0, flour: 0, toasted_flour: 0, farofa: 0,
        upgrade_growth: 0, upgrade_value: 0, upgrade_toast: 0, upgrade_plots: 0,
        total_farofa_sold: 0, total_coins_earned: 0
    });
}

async function loadGameFromDB() {
    const { data, error } = await supabase
        .from('game_saves')
        .select('*')
        .eq('user_id', G.user.id)
        .single();

    if (error || !data) {
        // First time - create save
        const name = G.user.user_metadata?.display_name || 'Jogador';
        G.displayName = name;
        await createSaveInDB(name);
        return;
    }

    G.displayName = data.display_name || 'Jogador';
    G.coins = data.coins || 0;
    G.inv.corn = data.corn || 0;
    G.inv.flour = (data.flour || 0) + (data.toasted_flour || 0);
    G.inv.farofa = data.farofa || 0;
    G.upgrades.growth = data.upgrade_growth || 0;
    G.upgrades.value = data.upgrade_value || 0;
    G.upgrades.toast = data.upgrade_toast || 0;
    G.upgrades.plots = data.upgrade_plots || 0;
    G.totalSold = data.total_farofa_sold || 0;
    G.totalEarned = data.total_coins_earned || 0;
}

async function saveGameToDB() {
    if (!G.user) return;
    await supabase
        .from('game_saves')
        .update({
            coins: G.coins,
            corn: G.inv.corn,
            flour: G.inv.flour,
            toasted_flour: 0,
            farofa: G.inv.farofa,
            upgrade_growth: G.upgrades.growth,
            upgrade_value: G.upgrades.value,
            upgrade_toast: G.upgrades.toast,
            upgrade_plots: G.upgrades.plots,
            total_farofa_sold: G.totalSold,
            total_coins_earned: G.totalEarned,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', G.user.id);
}

// Auto-save every 30s
setInterval(() => { if (G.user) saveGameToDB(); }, 30000);

// Save on page close
window.addEventListener('beforeunload', () => { if (G.user) saveGameToDB(); });

// ==========================================
// SPEECH
// ==========================================
function speak(category) {
    const lines = FALAS[category];
    if (!lines) return;
    const msg = lines[Math.floor(Math.random() * lines.length)];
    const el = $('#speech');
    const txt = $('#speech-msg');
    txt.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(window._st);
    window._st = setTimeout(() => el.classList.add('hidden'), 3500);
}

function celebrateChar() {
    const m = $('#mineirinha');
    m.classList.remove('celebrate');
    void m.offsetWidth;
    m.classList.add('celebrate');
    setTimeout(() => m.classList.remove('celebrate'), 700);
}

// ==========================================
// NOTIFICATIONS
// ==========================================
function notify(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = `notif notif-${type}`;
    el.textContent = msg;
    $('#notifs').appendChild(el);
    setTimeout(() => el.remove(), 2600);
}

// ==========================================
// HUD
// ==========================================
function updateHUD() {
    $('#hud-corn').textContent = G.inv.corn;
    $('#hud-flour').textContent = G.inv.flour;
    $('#hud-farofa').textContent = G.inv.farofa;
    $('#hud-coin-count').textContent = G.coins;

    // Scene-specific
    $('#proc-corn').textContent = G.inv.corn;
    $('#cook-flour').textContent = G.inv.flour;
    $('#sell-farofa').textContent = G.inv.farofa;
    $('#sell-price-val').textContent = getSellPrice();

    // Button states
    $('#btn-grind').disabled = G.inv.corn < 1;
    $('#btn-cook').disabled = G.inv.flour < 1;
    $('#btn-sell').disabled = G.inv.farofa < 1;
    $('#btn-sell-all').disabled = G.inv.farofa < 1;
}

function getSellPrice() {
    let p = BASE_PRICE + G.upgrades.value * 3;
    if (G.lastQuality === 'perfect') p += 5;
    else if (G.lastQuality === 'good') p += 2;
    const ingBonus = Math.max(0, G.selectedIngredients.length - 1) * 2;
    return p + ingBonus;
}

// ==========================================
// FARM
// ==========================================
function buildFarm() {
    const grid = $('#farm-grid');
    grid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const tile = document.createElement('div');
        tile.className = 'farm-tile tile-empty';
        tile.dataset.idx = i;
        tile.innerHTML = `
            <div class="tile-plant"></div>
            <div class="tile-bar" style="display:none">
                <div class="tile-bar-fill"></div>
            </div>
        `;
        tile.addEventListener('click', () => onTileClick(i));
        grid.appendChild(tile);
    }
}

function onTileClick(idx) {
    const plot = G.plots[idx];

    if (G.selectedTool === 'plant' && plot.state === 'empty') {
        plot.state = 'growing';
        plot.growth = 0;
        speak('plant');
        celebrateChar();
        notify('🌱 Plantou!', 'ok');
    } else if (G.selectedTool === 'water' && plot.state === 'growing') {
        plot.growth = Math.min(MAX_GROWTH, plot.growth + WATER_BOOST);
        if (plot.growth >= MAX_GROWTH) plot.state = 'ready';
        speak('water');
        notify('💧 Regou!', 'ok');
    } else if (G.selectedTool === 'harvest' && plot.state === 'ready') {
        plot.state = 'empty';
        plot.growth = 0;
        G.inv.corn += CORN_PER_HARVEST;
        speak('harvest');
        celebrateChar();
        notify(`+${CORN_PER_HARVEST} milho!`, 'ok');

        // Harvest animation
        const tiles = $$('.farm-tile');
        const plant = tiles[idx]?.querySelector('.tile-plant');
        if (plant) {
            plant.classList.add('harvest-shake');
            setTimeout(() => plant.classList.remove('harvest-shake'), 400);
        }
    }

    updateFarmVisuals();
    updateHUD();
    saveGameToDB();
}

function updateFarmVisuals() {
    const tiles = $$('.farm-tile');
    G.plots.forEach((p, i) => {
        if (i >= tiles.length) return;
        const tile = tiles[i];
        const plant = tile.querySelector('.tile-plant');
        const bar = tile.querySelector('.tile-bar');
        const fill = tile.querySelector('.tile-bar-fill');

        tile.className = 'farm-tile';

        switch (p.state) {
            case 'empty':
                tile.classList.add('tile-empty');
                plant.textContent = '';
                bar.style.display = 'none';
                break;
            case 'growing':
                const pct = (p.growth / MAX_GROWTH) * 100;
                bar.style.display = 'block';
                fill.style.width = pct + '%';
                if (pct < 30) plant.textContent = '🌱';
                else if (pct < 60) plant.textContent = '🌿';
                else if (pct < 90) plant.textContent = '🪴';
                else plant.textContent = '🌽';
                break;
            case 'ready':
                tile.classList.add('tile-ready');
                plant.textContent = '🌽';
                bar.style.display = 'block';
                fill.style.width = '100%';
                fill.style.background = 'linear-gradient(90deg, #FFD700, #FF8F00)';
                break;
        }
    });
}

// Growth loop
function growthTick() {
    const rate = GROWTH_RATE + G.upgrades.growth * 0.5;
    let changed = false;
    G.plots.forEach(p => {
        if (p.state === 'growing') {
            p.growth += rate;
            if (p.growth >= MAX_GROWTH) {
                p.growth = MAX_GROWTH;
                p.state = 'ready';
                notify('🌽 Milho pronto!', 'ok');
            }
            changed = true;
        }
    });
    if (changed) updateFarmVisuals();
}

// ==========================================
// PROCESS (GRIND)
// ==========================================
function grindCorn() {
    if (G.inv.corn < 1) { speak('noItem'); return; }
    const amt = Math.min(G.inv.corn, 5);
    G.inv.corn -= amt;
    G.inv.flour += amt;

    // Machine animation
    const machine = $('#mill-machine');
    machine.classList.add('grinding');
    setTimeout(() => machine.classList.remove('grinding'), 1500);

    speak('grind');
    celebrateChar();
    notify(`+${amt} farinha!`, 'ok');
    updateHUD();
    saveGameToDB();
}

// ==========================================
// COOKING (TOAST + RECIPE)
// ==========================================
let cookAnim = null;
let cookPos = 0;
let cookDir = 1;
let cookSpeed = 2.5;
let cookRunning = false;

function startCook() {
    if (G.inv.flour < 1) { speak('noItem'); return; }

    cookRunning = true;
    cookPos = 0;
    cookDir = 1;
    cookSpeed = 2.5 + Math.random() * 1.5;

    $('#btn-cook').classList.add('hidden');
    $('#btn-cook-stop').classList.remove('hidden');
    $('#cook-timing').classList.add('active');
    $('#cook-result').classList.add('hidden');

    // Stove fire on
    $('#stove').classList.add('cooking');
    $('#pan-contents').textContent = '🌾';

    animateCook();
}

function animateCook() {
    if (!cookRunning) return;
    cookPos += cookDir * cookSpeed;
    if (cookPos >= 100) { cookPos = 100; cookDir = -1; }
    else if (cookPos <= 0) { cookPos = 0; cookDir = 1; }

    $('#timing-needle').style.left = `calc(${cookPos}% - 3px)`;
    cookAnim = requestAnimationFrame(animateCook);
}

function stopCook() {
    if (!cookRunning) return;
    cookRunning = false;
    cancelAnimationFrame(cookAnim);

    $('#btn-cook').classList.remove('hidden');
    $('#btn-cook-stop').classList.add('hidden');
    $('#cook-timing').classList.remove('active');
    $('#stove').classList.remove('cooking');

    // Calculate quality
    const perfectW = 1.2 + G.upgrades.toast * 0.3;
    const total = 1.5 + 2 + perfectW + 2 + 1.5;
    const rawEnd = (1.5 / total) * 100;
    const goodEnd = rawEnd + (2 / total) * 100;
    const perfectEnd = goodEnd + (perfectW / total) * 100;
    const good2End = perfectEnd + (2 / total) * 100;

    let quality, cls, text;
    if (cookPos >= goodEnd && cookPos <= perfectEnd) {
        quality = 'perfect'; cls = 'perfect'; text = '⭐ PERFEITO!';
        speak('cookPerfect');
    } else if ((cookPos >= rawEnd && cookPos < goodEnd) || (cookPos > perfectEnd && cookPos <= good2End)) {
        quality = 'good'; cls = 'good'; text = '👍 BOM!';
        speak('cookGood');
    } else {
        quality = 'bad'; cls = 'bad'; text = cookPos < rawEnd ? '❄️ CRU...' : '🔥 QUEIMOU!';
        speak('cookBad');
    }

    G.lastQuality = quality;
    G.inv.flour -= 1;
    G.inv.farofa += 1;

    // Show result
    const result = $('#cook-result');
    result.textContent = text;
    result.className = `cook-result ${cls}`;
    result.classList.remove('hidden');
    setTimeout(() => result.classList.add('hidden'), 2500);

    // Pan visual
    const ingEmojis = G.selectedIngredients.map(i =>
        ({ manteiga: '🧈', alho: '🧄', cebola: '🧅', bacon: '🥓' })[i] || ''
    ).join('');
    $('#pan-contents').textContent = '🥣';

    celebrateChar();
    notify('Farofa pronta!', 'ok');
    updateHUD();
    saveGameToDB();
}

// ==========================================
// SELL
// ==========================================
function sellFarofa(amount) {
    if (G.inv.farofa < 1) { speak('noItem'); return; }
    const qty = amount === 'all' ? G.inv.farofa : Math.min(amount, G.inv.farofa);
    const price = getSellPrice();
    const total = qty * price;

    G.inv.farofa -= qty;
    G.coins += total;
    G.totalSold += qty;
    G.totalEarned += total;

    // Coin animations
    const container = $('#coin-anim-container');
    for (let i = 0; i < Math.min(qty * 2, 10); i++) {
        setTimeout(() => {
            const coin = document.createElement('div');
            coin.className = 'coin-fly';
            coin.textContent = '🪙';
            coin.style.left = (40 + Math.random() * 40) + '%';
            coin.style.top = '50%';
            coin.style.setProperty('--tx', (Math.random() * 50 - 25) + 'px');
            container.appendChild(coin);
            setTimeout(() => coin.remove(), 900);
        }, i * 80);
    }

    // HUD coin pop
    const coinEl = $('#hud-coins');
    coinEl.classList.add('coin-pop');
    setTimeout(() => coinEl.classList.remove('coin-pop'), 500);

    speak('sell');
    celebrateChar();
    notify(`+${total} moedas!`, 'coin');
    updateHUD();
    saveGameToDB();
}

// ==========================================
// SCENE NAVIGATION
// ==========================================
function switchScene(name) {
    G.scene = name;
    $$('.game-scene').forEach(s => s.classList.remove('active'));
    $$('.scene-btn').forEach(b => b.classList.remove('active'));
    $(`#scene-${name}`).classList.add('active');
    $(`.scene-btn[data-scene="${name}"]`).classList.add('active');

    // Adjust Mineirinha position per scene
    const m = $('#mineirinha');
    switch (name) {
        case 'farm':
            m.style.left = '12px'; m.style.bottom = '40%'; break;
        case 'process':
            m.style.left = '10px'; m.style.bottom = '35%'; break;
        case 'cooking':
            m.style.left = '8px'; m.style.bottom = '35%'; break;
        case 'sell':
            m.style.left = '15px'; m.style.bottom = '35%'; break;
    }

    updateHUD();
}

// ==========================================
// INIT
// ==========================================
function init() {
    // Build farm grid
    buildFarm();

    // Scene nav
    $$('.scene-btn').forEach(btn => {
        btn.addEventListener('click', () => switchScene(btn.dataset.scene));
    });

    // Farm tools
    $$('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            G.selectedTool = btn.dataset.tool;
            $$('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Process
    $('#btn-grind').addEventListener('click', grindCorn);

    // Cooking
    $('#btn-cook').addEventListener('click', startCook);
    $('#btn-cook-stop').addEventListener('click', stopCook);

    // Ingredients
    $$('.ing-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ing = btn.dataset.ing;
            if (ing === 'manteiga') return; // always selected
            const idx = G.selectedIngredients.indexOf(ing);
            if (idx >= 0) G.selectedIngredients.splice(idx, 1);
            else G.selectedIngredients.push(ing);
            $$('.ing-btn').forEach(b => {
                b.classList.toggle('selected', G.selectedIngredients.includes(b.dataset.ing));
            });
        });
    });

    // Sell
    $('#btn-sell').addEventListener('click', () => sellFarofa(1));
    $('#btn-sell-all').addEventListener('click', () => sellFarofa('all'));

    // Growth tick
    setInterval(growthTick, 500);

    // Auth
    initAuth();
}

document.addEventListener('DOMContentLoaded', init);
