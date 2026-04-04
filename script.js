/* ============================================
   SÍTIO DA MINEIRINHA
   Harvest Town + Stardew Valley - Edição BR
   ============================================ */

// ==========================================
// SUPABASE CONFIG
// ==========================================
const SUPABASE_URL = 'https://teoxhfhneuxfogejnjdo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlb3hoZmhuZXV4Zm9nZWpuamRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDQ5NzEsImV4cCI6MjA5MDM4MDk3MX0.L_IGpn73XNH2ydnNmfKBT7EMzMim0Igxj36p3_dZfEM';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// ASSETS
// ==========================================
const ASSETS = {
    crops: {
        stage2: 'assets/crops/corn_stage_2.png',
        stage4: 'assets/crops/corn_stage_4.png'
    },
    character: {
        south: 'assets/character/rotations/south.png',
        north: 'assets/character/rotations/north.png',
        east: 'assets/character/rotations/east.png',
        west: 'assets/character/rotations/west.png',
        walkSouth: 'assets/character/walking/south.gif',
        walkEast: 'assets/character/walking/east.gif',
        walkNorth: 'assets/character/walking/north.gif',
        walkWest: 'assets/character/walking/west.gif'
    }
};

// ==========================================
// GAME STATE
// ==========================================
const G = window.G = {
    user: null,
    displayName: '',
    coins: 0,
    inv: { corn: 0, flour: 0, farofa: 0 },
    plots: Array.from({ length: 12 }, () => ({ state: 'empty', growth: 0 })),
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
    welcome: ['Bem-vinda ao sítio!', 'Oi! Vamos fazer farofa!', 'Eita, chegou visita!'],
    plant: ['Plantou direitinho!', 'Milho na terra!', 'Agora espera crescer!'],
    water: ['Água fresquinha!', 'Cresce mais rápido!'],
    harvest: ['Colheita boa!', 'Milho bonito esse!'],
    grind: ['Farinha saindo!', 'Moeu bonito!'],
    cookPerfect: ['PERFEITO! Que cheiro bom!', 'Mão de ouro!'],
    cookGood: ['Ficou boa!', 'Dá pra vender!'],
    cookBad: ['Eita, queimou...', 'Cuidado com o fogo!'],
    sell: ['Vendeu!', 'Moeda no bolso!', 'O povo ama!'],
    noItem: ['Falta item!']
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
    $$('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            $$('.auth-form').forEach(f => f.classList.remove('active'));
            $(`#${tab.dataset.tab}-form`).classList.add('active');
            hideAuthMessages();
        });
    });

    $('#login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthMessages();
        const email = $('#login-email').value.trim();
        const password = $('#login-password').value;
        const btn = $('#login-form .auth-btn');
        btn.disabled = true;
        btn.textContent = 'Entrando...';

        const { data, error } = await sb.auth.signInWithPassword({ email, password });

        btn.disabled = false;
        btn.textContent = 'Jogar!';

        if (error) {
            showAuthError(traduzirErro(error.message));
            return;
        }

        G.user = data.user;
        await loadGameFromDB();
        enterGame();
    });

    $('#register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthMessages();
        const name = $('#reg-name').value.trim();
        const email = $('#reg-email').value.trim();
        const password = $('#reg-password').value;
        const btn = $('#register-form .auth-btn');
        btn.disabled = true;
        btn.textContent = 'Criando...';

        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: { data: { display_name: name } }
        });

        btn.disabled = false;
        btn.textContent = 'Criar Conta';

        if (error) {
            showAuthError(traduzirErro(error.message));
            return;
        }

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

    $('#btn-logout').addEventListener('click', async () => {
        await saveGameToDB();
        await sb.auth.signOut();
        G.user = null;
        exitGame();
    });

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
    $('#login-email').value = '';
    $('#login-password').value = '';
    hideAuthMessages();
}

// ==========================================
// DATABASE
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
    const { data, error } = await sb
        .from('game_saves')
        .select('*')
        .eq('user_id', G.user.id)
        .single();

    if (error || !data) {
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
    await sb
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

setInterval(() => { if (G.user) saveGameToDB(); }, 30000);
window.addEventListener('beforeunload', () => { if (G.user) saveGameToDB(); });

// ==========================================
// CHARACTER
// ==========================================
function celebrateChar() {
    const char = $('#character');
    char.classList.remove('celebrate');
    void char.offsetWidth;
    char.classList.add('celebrate');
    setTimeout(() => char.classList.remove('celebrate'), 600);
}

function walkChar(direction) {
    const sprite = $('#char-sprite');
    const dir = direction || ['east', 'west'][Math.round(Math.random())];
    const key = 'walk' + dir.charAt(0).toUpperCase() + dir.slice(1);
    if (ASSETS.character[key]) {
        sprite.src = ASSETS.character[key];
        setTimeout(() => {
            sprite.src = ASSETS.character.south;
        }, 700);
    }
}

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
    window._st = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ==========================================
// NOTIFICATIONS
// ==========================================
function notify(msg, type) {
    const el = document.createElement('div');
    el.className = 'notif notif-' + (type || 'ok');
    el.textContent = msg;
    $('#notifs').appendChild(el);
    setTimeout(() => el.remove(), 2600);
}

function floatItem(emoji, x, y) {
    const el = document.createElement('div');
    el.className = 'float-item';
    el.textContent = emoji;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    $('#game-world').appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// ==========================================
// HUD
// ==========================================
function updateHUD() {
    $('#hud-corn').textContent = G.inv.corn;
    $('#hud-flour').textContent = G.inv.flour;
    $('#hud-farofa').textContent = G.inv.farofa;
    $('#hud-coin-count').textContent = G.coins;

    $('#proc-corn').textContent = G.inv.corn;
    $('#cook-flour').textContent = G.inv.flour;
    $('#sell-farofa').textContent = G.inv.farofa;
    $('#sell-price-val').textContent = getSellPrice();

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
    const count = window.innerWidth >= 768 ? 12 : (window.innerHeight > window.innerWidth ? 9 : 12);
    // Ensure plots array matches
    while (G.plots.length < count) G.plots.push({ state: 'empty', growth: 0 });

    for (let i = 0; i < count; i++) {
        const tile = document.createElement('div');
        tile.className = 'farm-tile';
        tile.dataset.idx = i;
        tile.innerHTML = '<div class="tile-plant"></div><div class="tile-bar"><div class="tile-bar-fill"></div></div>';
        tile.addEventListener('click', function(e) { onTileClick(i, e); });
        grid.appendChild(tile);
    }
    updateFarmVisuals();
}

function onTileClick(idx, event) {
    const plot = G.plots[idx];
    const tiles = $$('.farm-tile');
    const tile = tiles[idx];
    if (!tile) return;

    const rect = tile.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top;

    if (G.selectedTool === 'plant' && plot.state === 'empty') {
        plot.state = 'growing';
        plot.growth = 0;
        speak('plant');
        celebrateChar();
        floatItem('🌱', cx, cy);
        notify('+1 plantado!');
    } else if (G.selectedTool === 'water' && plot.state === 'growing') {
        plot.growth = Math.min(MAX_GROWTH, plot.growth + WATER_BOOST);
        if (plot.growth >= MAX_GROWTH) plot.state = 'ready';
        speak('water');
        floatItem('💧', cx, cy);
        tile.classList.add('tile-water-flash');
        setTimeout(() => tile.classList.remove('tile-water-flash'), 600);
    } else if (G.selectedTool === 'harvest' && plot.state === 'ready') {
        plot.state = 'empty';
        plot.growth = 0;
        G.inv.corn += CORN_PER_HARVEST;
        speak('harvest');
        celebrateChar();
        floatItem('🌽', cx, cy);
        notify('+' + CORN_PER_HARVEST + ' milho!');

        const plant = tile.querySelector('.tile-plant');
        if (plant) {
            plant.classList.add('harvest-shake');
            setTimeout(() => plant.classList.remove('harvest-shake'), 500);
        }
    } else {
        return; // no action
    }

    updateFarmVisuals();
    updateHUD();
    saveGameToDB();
}

function getCropHTML(growth) {
    if (growth < 20) {
        return '<div class="seed-dots"><div class="seed-dot"></div><div class="seed-dot"></div><div class="seed-dot"></div></div>';
    } else if (growth < 55) {
        return '<img src="' + ASSETS.crops.stage2 + '" style="width:75%;height:75%;">';
    } else if (growth < 85) {
        return '<img src="' + ASSETS.crops.stage2 + '" style="width:95%;height:95%;">';
    } else {
        return '<img src="' + ASSETS.crops.stage4 + '" style="width:100%;height:100%;">';
    }
}

function updateFarmVisuals() {
    var tiles = $$('.farm-tile');
    for (var i = 0; i < tiles.length; i++) {
        var p = G.plots[i];
        if (!p) continue;
        var tile = tiles[i];
        var plant = tile.querySelector('.tile-plant');
        var bar = tile.querySelector('.tile-bar');
        var fill = tile.querySelector('.tile-bar-fill');

        tile.classList.remove('tile-ready');

        if (p.state === 'empty') {
            plant.innerHTML = '';
            bar.style.display = 'none';
        } else if (p.state === 'growing') {
            var pct = (p.growth / MAX_GROWTH) * 100;
            bar.style.display = 'block';
            fill.style.width = pct + '%';
            fill.style.background = '';
            plant.innerHTML = getCropHTML(p.growth);
        } else if (p.state === 'ready') {
            tile.classList.add('tile-ready');
            plant.innerHTML = '<img src="' + ASSETS.crops.stage4 + '" style="width:100%;height:100%;">';
            bar.style.display = 'block';
            fill.style.width = '100%';
            fill.style.background = 'linear-gradient(90deg, #FFD700, #FF8F00)';
        }
    }
}

function growthTick() {
    var rate = GROWTH_RATE + G.upgrades.growth * 0.5;
    var changed = false;
    for (var i = 0; i < G.plots.length; i++) {
        var p = G.plots[i];
        if (p.state === 'growing') {
            p.growth += rate;
            if (p.growth >= MAX_GROWTH) {
                p.growth = MAX_GROWTH;
                p.state = 'ready';
                notify('🌽 Milho pronto!');
            }
            changed = true;
        }
    }
    if (changed) updateFarmVisuals();
}

// ==========================================
// PROCESS (GRIND)
// ==========================================
function grindCorn() {
    if (G.inv.corn < 1) { speak('noItem'); return; }
    var amt = Math.min(G.inv.corn, 5);
    G.inv.corn -= amt;
    G.inv.flour += amt;

    var station = $('.grinder-station');
    station.classList.add('grinding');

    // Particles
    var particles = $('#grinder-particles');
    for (var i = 0; i < 8; i++) {
        (function(idx) {
            setTimeout(function() {
                var p = document.createElement('div');
                p.className = 'grinder-particle';
                p.style.setProperty('--tx', (Math.random() * 50 - 25) + 'px');
                p.style.left = (Math.random() * 40 - 20) + 'px';
                particles.appendChild(p);
                setTimeout(function() { p.remove(); }, 800);
            }, idx * 80);
        })(i);
    }

    setTimeout(function() { station.classList.remove('grinding'); }, 1500);

    speak('grind');
    celebrateChar();
    notify('+' + amt + ' farinha!');
    updateHUD();
    saveGameToDB();
}

// ==========================================
// COOKING
// ==========================================
var cookAnim = null;
var cookPos = 0;
var cookDir = 1;
var cookSpeed = 2.5;
var cookRunning = false;

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

    $('#stove').classList.add('cooking');
    $('#pan-contents').textContent = '🌾';

    animateCook();
}

function animateCook() {
    if (!cookRunning) return;
    cookPos += cookDir * cookSpeed;
    if (cookPos >= 100) { cookPos = 100; cookDir = -1; }
    else if (cookPos <= 0) { cookPos = 0; cookDir = 1; }

    $('#timing-needle').style.left = 'calc(' + cookPos + '% - 2px)';
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

    var perfectW = 1.2 + G.upgrades.toast * 0.3;
    var total = 1.5 + 2 + perfectW + 2 + 1.5;
    var rawEnd = (1.5 / total) * 100;
    var goodEnd = rawEnd + (2 / total) * 100;
    var perfectEnd = goodEnd + (perfectW / total) * 100;
    var good2End = perfectEnd + (2 / total) * 100;

    var quality, cls, text;
    if (cookPos >= goodEnd && cookPos <= perfectEnd) {
        quality = 'perfect'; cls = 'perfect'; text = '⭐ PERFEITO!';
        speak('cookPerfect');
    } else if ((cookPos >= rawEnd && cookPos < goodEnd) || (cookPos > perfectEnd && cookPos <= good2End)) {
        quality = 'good'; cls = 'good'; text = '👍 BOM!';
        speak('cookGood');
    } else {
        quality = 'bad'; cls = 'bad';
        text = cookPos < rawEnd ? '❄️ CRU...' : '🔥 QUEIMOU!';
        speak('cookBad');
    }

    G.lastQuality = quality;
    G.inv.flour -= 1;
    G.inv.farofa += 1;

    var result = $('#cook-result');
    result.textContent = text;
    result.className = 'cook-result ' + cls;
    result.classList.remove('hidden');
    setTimeout(function() { result.classList.add('hidden'); }, 2500);

    $('#pan-contents').textContent = '🥣';

    celebrateChar();
    notify('Farofa pronta!');
    updateHUD();
    saveGameToDB();
}

// ==========================================
// SELL
// ==========================================
function sellFarofa(amount) {
    if (G.inv.farofa < 1) { speak('noItem'); return; }
    var qty = amount === 'all' ? G.inv.farofa : Math.min(amount, G.inv.farofa);
    var price = getSellPrice();
    var total = qty * price;

    G.inv.farofa -= qty;
    G.coins += total;
    G.totalSold += qty;
    G.totalEarned += total;

    // Product animation
    var product = $('#stall-product');
    product.classList.remove('sold');
    void product.offsetWidth;
    product.classList.add('sold');
    setTimeout(function() { product.classList.remove('sold'); }, 600);

    // Sparkle effect
    var sparkleContainer = $('#stall-sparkle');
    for (var i = 0; i < 5; i++) {
        var s = document.createElement('div');
        s.className = 'sparkle';
        s.textContent = '✨';
        s.style.left = (20 + Math.random() * 60) + '%';
        s.style.top = (20 + Math.random() * 60) + '%';
        s.style.animationDelay = (i * 0.1) + 's';
        sparkleContainer.appendChild(s);
        setTimeout(function(el) { el.remove(); }, 800, s);
    }

    // Coin fly animations
    var container = $('#coin-anim-container');
    var coinCount = Math.min(qty * 2, 12);
    for (var j = 0; j < coinCount; j++) {
        (function(idx) {
            setTimeout(function() {
                var coin = document.createElement('div');
                coin.className = 'coin-fly';
                coin.textContent = '$';
                coin.style.left = (30 + Math.random() * 35) + '%';
                coin.style.top = '55%';
                coin.style.setProperty('--tx', (Math.random() * 70 - 35) + 'px');
                container.appendChild(coin);
                setTimeout(function() { coin.remove(); }, 1000);
            }, idx * 70);
        })(j);
    }

    // HUD coin pop
    var coinEl = $('#hud-coins');
    coinEl.classList.remove('coin-pop');
    void coinEl.offsetWidth;
    coinEl.classList.add('coin-pop');

    speak('sell');
    celebrateChar();
    notify('+' + total + ' moedas!', 'coin');
    updateHUD();
    saveGameToDB();
}

// ==========================================
// SCENE NAVIGATION
// ==========================================
function switchScene(name) {
    G.scene = name;

    $$('.scene').forEach(function(s) { s.classList.remove('active'); });
    $$('.scene-btn').forEach(function(b) { b.classList.remove('active'); });
    $('#scene-' + name).classList.add('active');
    $('.scene-btn[data-scene="' + name + '"]').classList.add('active');

    walkChar();

    var char = $('#character');
    switch (name) {
        case 'farm':
            char.style.left = '10px'; char.style.bottom = '35%'; break;
        case 'process':
            char.style.left = '8px'; char.style.bottom = '28%'; break;
        case 'cooking':
            char.style.left = '6px'; char.style.bottom = '30%'; break;
        case 'sell':
            char.style.left = '12px'; char.style.bottom = '28%'; break;
    }

    updateHUD();
}

// ==========================================
// INIT
// ==========================================
function init() {
    buildFarm();

    // Scene nav
    $$('.scene-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { switchScene(btn.dataset.scene); });
    });

    // Farm tools
    $$('.tool-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            G.selectedTool = btn.dataset.tool;
            $$('.tool-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
        });
    });

    // Process
    $('#btn-grind').addEventListener('click', grindCorn);

    // Cooking
    $('#btn-cook').addEventListener('click', startCook);
    $('#btn-cook-stop').addEventListener('click', stopCook);

    // Ingredients
    $$('.ing-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var ing = btn.dataset.ing;
            if (ing === 'manteiga') return; // always selected
            var idx = G.selectedIngredients.indexOf(ing);
            if (idx >= 0) G.selectedIngredients.splice(idx, 1);
            else G.selectedIngredients.push(ing);
            $$('.ing-btn').forEach(function(b) {
                b.classList.toggle('selected', G.selectedIngredients.includes(b.dataset.ing));
            });
        });
    });

    // Sell
    $('#btn-sell').addEventListener('click', function() { sellFarofa(1); });
    $('#btn-sell-all').addEventListener('click', function() { sellFarofa('all'); });

    // Growth tick
    setInterval(growthTick, 500);

    // Rebuild farm on resize (portrait/landscape switch)
    var resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(buildFarm, 300);
    });

    // Auth
    initAuth();
}

document.addEventListener('DOMContentLoaded', init);
