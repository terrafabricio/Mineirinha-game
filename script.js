/* ============================================
   SÍTIO DA MINEIRINHA
   Stardew Valley + Harvest Town - Edição BR
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
// SOUND SYSTEM (Web Audio API)
// ==========================================
const SFX = {
    ctx: null,
    vol: 0.3,
    init: function() {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    },
    unlock: function() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    play: function(name) {
        if (!this.ctx) return;
        var fn = this['_' + name];
        if (fn) fn.call(this);
    },
    _tone: function(freq, dur, type, vol) {
        var o = this.ctx.createOscillator();
        var g = this.ctx.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq;
        g.gain.value = (vol || 1) * this.vol;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime + dur);
    },
    _click: function() { this._tone(800, 0.05, 'sine', 0.4); },
    _plant: function() {
        this._tone(400, 0.15, 'sine', 0.5);
        var self = this;
        setTimeout(function() { self._tone(550, 0.12, 'sine', 0.4); }, 60);
    },
    _water: function() {
        var ctx = this.ctx;
        var buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
        var s = ctx.createBufferSource(); s.buffer = buf;
        var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000;
        var g = ctx.createGain(); g.gain.value = this.vol * 0.5;
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        s.connect(f); f.connect(g); g.connect(ctx.destination);
        s.start(); s.stop(ctx.currentTime + 0.12);
    },
    _harvest: function() {
        this._tone(600, 0.12, 'sine', 0.5);
        var self = this;
        setTimeout(function() { self._tone(800, 0.15, 'sine', 0.5); }, 80);
    },
    _grind: function() {
        this._tone(150, 0.4, 'sawtooth', 0.3);
        this._tone(180, 0.35, 'square', 0.15);
    },
    _cook: function() { this._tone(500, 0.08, 'sine', 0.3); },
    _perfect: function() {
        var self = this;
        self._tone(523, 0.12, 'sine', 0.5);
        setTimeout(function() { self._tone(659, 0.12, 'sine', 0.5); }, 100);
        setTimeout(function() { self._tone(784, 0.2, 'sine', 0.5); }, 200);
    },
    _good: function() {
        this._tone(523, 0.12, 'sine', 0.4);
        var self = this;
        setTimeout(function() { self._tone(659, 0.15, 'sine', 0.4); }, 100);
    },
    _bad: function() { this._tone(200, 0.2, 'square', 0.3); },
    _sell: function() { this._tone(1200, 0.08, 'sine', 0.4); },
    _coins: function() {
        var self = this;
        for (var i = 0; i < 5; i++) {
            (function(idx) {
                setTimeout(function() { self._tone(1100 + idx * 100, 0.06, 'sine', 0.3); }, idx * 60);
            })(i);
        }
    },
    _error: function() { this._tone(200, 0.15, 'square', 0.3); },
    _upgrade: function() {
        var self = this;
        [523, 659, 784, 1047].forEach(function(f, i) {
            setTimeout(function() { self._tone(f, 0.15, 'sine', 0.5); }, i * 100);
        });
    },
    _navigate: function() { this._tone(600, 0.04, 'sine', 0.25); }
};

// ==========================================
// GAME STATE
// ==========================================
var PLOT_COUNT = 16;

var G = window.G = {
    user: null,
    displayName: '',
    coins: 0,
    inv: { corn: 0, flour: 0, farofa: 0 },
    plots: Array.from({ length: PLOT_COUNT }, function() { return { state: 'empty', growth: 0 }; }),
    upgrades: { growth: 0, value: 0, toast: 0, plots: 0, grinder: 0 },
    selectedTool: 'plant',
    selectedIngredients: ['manteiga'],
    lastQuality: null,
    totalSold: 0,
    totalEarned: 0,
    scene: 'farm',
    demand: 1.0,
    demandLabel: 'Normal'
};

var MAX_GROWTH = 100;
var GROWTH_RATE = 1.5;
var WATER_BOOST = 20;
var CORN_PER_HARVEST = 2;
var BASE_PRICE = 10;

// ==========================================
// UPGRADES CONFIG
// ==========================================
var UPGRADES = {
    growth: { name: 'Adubo Turbo', desc: 'Milho cresce mais rápido', icon: '🌱', maxLevel: 5, baseCost: 50, costScale: 1.8 },
    value: { name: 'Marca Premium', desc: 'Farofa vale mais', icon: '💎', maxLevel: 5, baseCost: 80, costScale: 2.0 },
    toast: { name: 'Forno Melhor', desc: 'Zona perfeita maior', icon: '🎯', maxLevel: 5, baseCost: 60, costScale: 1.8 },
    plots: { name: 'Mais Canteiros', desc: 'Expande a roça', icon: '🌾', maxLevel: 3, baseCost: 150, costScale: 2.5 },
    grinder: { name: 'Moinho Rápido', desc: 'Moe mais milho por vez', icon: '⚙️', maxLevel: 3, baseCost: 100, costScale: 2.0 }
};

var FALAS = {
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
var $ = function(s) { return document.querySelector(s); };
var $$ = function(s) { return document.querySelectorAll(s); };

// ==========================================
// AUTH
// ==========================================
function initAuth() {
    $$('.auth-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            $$('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            $$('.auth-form').forEach(function(f) { f.classList.remove('active'); });
            $('#' + tab.dataset.tab + '-form').classList.add('active');
            hideAuthMessages();
            SFX.play('click');
        });
    });

    $('#login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        hideAuthMessages();
        var email = $('#login-email').value.trim();
        var password = $('#login-password').value;
        var btn = $('#login-form .auth-btn');
        btn.disabled = true;
        btn.textContent = 'Entrando...';

        var { data, error } = await sb.auth.signInWithPassword({ email: email, password: password });

        btn.disabled = false;
        btn.textContent = 'Jogar!';

        if (error) {
            showAuthError(traduzirErro(error.message));
            SFX.play('error');
            return;
        }

        G.user = data.user;
        await loadGameFromDB();
        enterGame();
    });

    $('#register-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        hideAuthMessages();
        var name = $('#reg-name').value.trim();
        var email = $('#reg-email').value.trim();
        var password = $('#reg-password').value;
        var btn = $('#register-form .auth-btn');
        btn.disabled = true;
        btn.textContent = 'Criando...';

        var { data, error } = await sb.auth.signUp({
            email: email,
            password: password,
            options: { data: { display_name: name } }
        });

        btn.disabled = false;
        btn.textContent = 'Criar Conta';

        if (error) {
            showAuthError(traduzirErro(error.message));
            SFX.play('error');
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

    $('#btn-forgot').addEventListener('click', async function() {
        hideAuthMessages();
        var email = $('#login-email').value.trim();
        if (!email) { showAuthError('Digite seu e-mail primeiro.'); return; }
        var { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });
        if (error) { showAuthError(traduzirErro(error.message)); return; }
        showAuthSuccess('Link de recuperação enviado para ' + email);
    });

    $('#btn-logout').addEventListener('click', async function() {
        await saveGameToDB();
        await sb.auth.signOut();
        G.user = null;
        exitGame();
    });

    checkSession();
}

async function checkSession() {
    var { data: { session } } = await sb.auth.getSession();
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
    var el = $('#auth-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function showAuthSuccess(msg) {
    var el = $('#auth-success');
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
    charAction('farm', 'harvest');
    SFX.play('perfect');
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
    var { data, error } = await sb
        .from('game_saves')
        .select('*')
        .eq('user_id', G.user.id)
        .single();

    if (error || !data) {
        var name = G.user.user_metadata?.display_name || 'Jogador';
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
    G.upgrades.grinder = data.upgrade_grinder || 0;
    G.totalSold = data.total_farofa_sold || 0;
    G.totalEarned = data.total_coins_earned || 0;

    // Adjust plot count based on upgrades
    PLOT_COUNT = 16 + G.upgrades.plots * 4;
    while (G.plots.length < PLOT_COUNT) G.plots.push({ state: 'empty', growth: 0 });
}

async function saveGameToDB() {
    if (!G.user) return;
    var updateData = {
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
    };
    await sb.from('game_saves').update(updateData).eq('user_id', G.user.id);
}

setInterval(function() { if (G.user) saveGameToDB(); }, 30000);
window.addEventListener('beforeunload', function() { if (G.user) saveGameToDB(); });

// ==========================================
// CHARACTER ANIMATION
// ==========================================
function charAction(scene, action) {
    var el = $('#char-' + scene);
    if (!el) return;
    el.classList.remove('char-action-harvest', 'char-action-grind', 'char-action-stir', 'char-action-sell');
    void el.offsetWidth;
    el.classList.add('char-action-' + action);
    setTimeout(function() { el.classList.remove('char-action-' + action); }, 600);
}

// ==========================================
// SPEECH
// ==========================================
function speak(category) {
    var lines = FALAS[category];
    if (!lines) return;
    var msg = lines[Math.floor(Math.random() * lines.length)];
    var el = $('#speech');
    var txt = $('#speech-msg');
    txt.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(window._st);
    window._st = setTimeout(function() { el.classList.add('hidden'); }, 3000);
}

// ==========================================
// NOTIFICATIONS
// ==========================================
function notify(msg, type) {
    var el = document.createElement('div');
    el.className = 'notif notif-' + (type || 'ok');
    el.textContent = msg;
    $('#notifs').appendChild(el);
    setTimeout(function() { el.remove(); }, 2600);
}

function floatItem(emoji, x, y) {
    var el = document.createElement('div');
    el.className = 'float-item';
    el.textContent = emoji;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    $('#game-world').appendChild(el);
    setTimeout(function() { el.remove(); }, 1000);
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
    $('#stat-sold').textContent = G.totalSold;

    $('#btn-grind').disabled = G.inv.corn < 1;
    $('#btn-cook').disabled = G.inv.flour < 1;
    $('#btn-sell').disabled = G.inv.farofa < 1;
    $('#btn-sell-all').disabled = G.inv.farofa < 1;

    // Update demand display
    updateDemandDisplay();
}

function getSellPrice() {
    var p = BASE_PRICE + G.upgrades.value * 3;
    if (G.lastQuality === 'perfect') p += 5;
    else if (G.lastQuality === 'good') p += 2;
    var ingBonus = Math.max(0, G.selectedIngredients.length - 1) * 2;
    return Math.round((p + ingBonus) * G.demand);
}

// ==========================================
// DEMAND SYSTEM
// ==========================================
function updateDemand() {
    var roll = Math.random();
    if (roll < 0.2) { G.demand = 0.8; G.demandLabel = 'Baixa'; }
    else if (roll < 0.5) { G.demand = 1.0; G.demandLabel = 'Normal'; }
    else if (roll < 0.8) { G.demand = 1.2; G.demandLabel = 'Alta'; }
    else { G.demand = 1.5; G.demandLabel = 'Altíssima!'; }
    updateDemandDisplay();
    updateHUD();
}

function updateDemandDisplay() {
    var val = $('#demand-val');
    if (!val) return;
    val.textContent = G.demandLabel;
    val.className = 'demand-val';
    if (G.demand >= 1.2) val.classList.add('demand-high');
    else if (G.demand <= 0.8) val.classList.add('demand-low');
}

// ==========================================
// FARM
// ==========================================
function buildFarm() {
    var grid = $('#farm-grid');
    grid.innerHTML = '';

    PLOT_COUNT = 16 + (G.upgrades.plots || 0) * 4;
    while (G.plots.length < PLOT_COUNT) G.plots.push({ state: 'empty', growth: 0 });

    // Determine grid columns
    var cols = 4;
    if (PLOT_COUNT > 16) cols = 5;
    if (PLOT_COUNT > 25) cols = 6;
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', var(--tile))';
    grid.style.gridTemplateRows = '';

    for (var i = 0; i < PLOT_COUNT; i++) {
        var tile = document.createElement('div');
        tile.className = 'farm-tile';
        tile.dataset.idx = i;
        tile.innerHTML = '<div class="tile-plant"></div><div class="tile-bar"><div class="tile-bar-fill"></div></div>';
        (function(idx) {
            tile.addEventListener('click', function(e) { onTileClick(idx, e); });
        })(i);
        grid.appendChild(tile);
    }
    updateFarmVisuals();
}

function onTileClick(idx, event) {
    var plot = G.plots[idx];
    var tiles = $$('.farm-tile');
    var tile = tiles[idx];
    if (!tile) return;

    var rect = tile.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top;

    if (G.selectedTool === 'plant' && plot.state === 'empty') {
        plot.state = 'growing';
        plot.growth = 0;
        speak('plant');
        charAction('farm', 'harvest');
        floatItem('🌱', cx, cy);
        notify('+1 plantado!');
        SFX.play('plant');
    } else if (G.selectedTool === 'water' && plot.state === 'growing') {
        plot.growth = Math.min(MAX_GROWTH, plot.growth + WATER_BOOST);
        if (plot.growth >= MAX_GROWTH) plot.state = 'ready';
        speak('water');
        floatItem('💧', cx, cy);
        tile.classList.add('tile-water');
        setTimeout(function() { tile.classList.remove('tile-water'); }, 600);
        SFX.play('water');
    } else if (G.selectedTool === 'harvest' && plot.state === 'ready') {
        plot.state = 'empty';
        plot.growth = 0;
        G.inv.corn += CORN_PER_HARVEST;
        speak('harvest');
        charAction('farm', 'harvest');
        floatItem('🌽', cx, cy);
        notify('+' + CORN_PER_HARVEST + ' milho!');
        SFX.play('harvest');

        var plant = tile.querySelector('.tile-plant');
        if (plant) {
            plant.classList.add('harvest-shake');
            setTimeout(function() { plant.classList.remove('harvest-shake'); }, 500);
        }
    } else {
        return;
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
    if (G.inv.corn < 1) { speak('noItem'); SFX.play('error'); return; }
    var grindAmt = 5 + (G.upgrades.grinder || 0) * 3;
    var amt = Math.min(G.inv.corn, grindAmt);
    G.inv.corn -= amt;
    G.inv.flour += amt;

    var area = $('.machine-area');
    area.classList.add('grinding');

    charAction('process', 'grind');
    SFX.play('grind');

    var particles = $('#grinder-particles');
    for (var i = 0; i < 8; i++) {
        (function(idx) {
            setTimeout(function() {
                var p = document.createElement('div');
                p.className = 'grind-p';
                p.style.setProperty('--tx', (Math.random() * 50 - 25) + 'px');
                p.style.left = (Math.random() * 40 - 20) + 'px';
                particles.appendChild(p);
                setTimeout(function() { p.remove(); }, 800);
            }, idx * 80);
        })(i);
    }

    setTimeout(function() { area.classList.remove('grinding'); }, 1500);

    speak('grind');
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
    if (G.inv.flour < 1) { speak('noItem'); SFX.play('error'); return; }

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

    charAction('cooking', 'stir');
    SFX.play('cook');

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
        SFX.play('perfect');
    } else if ((cookPos >= rawEnd && cookPos < goodEnd) || (cookPos > perfectEnd && cookPos <= good2End)) {
        quality = 'good'; cls = 'good'; text = '👍 BOM!';
        speak('cookGood');
        SFX.play('good');
    } else {
        quality = 'bad'; cls = 'bad';
        text = cookPos < rawEnd ? '❄️ CRU...' : '🔥 QUEIMOU!';
        speak('cookBad');
        SFX.play('bad');
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

    charAction('cooking', 'stir');
    notify('Farofa pronta!');
    updateHUD();
    saveGameToDB();
}

// ==========================================
// SELL
// ==========================================
function sellFarofa(amount) {
    if (G.inv.farofa < 1) { speak('noItem'); SFX.play('error'); return; }
    var qty = amount === 'all' ? G.inv.farofa : Math.min(amount, G.inv.farofa);
    var price = getSellPrice();
    var total = qty * price;

    G.inv.farofa -= qty;
    G.coins += total;
    G.totalSold += qty;
    G.totalEarned += total;

    charAction('sell', 'sell');

    var product = $('#stall-product');
    product.classList.remove('sold');
    void product.offsetWidth;
    product.classList.add('sold');
    setTimeout(function() { product.classList.remove('sold'); }, 600);

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

    var coinEl = $('#hud-coins');
    coinEl.classList.remove('coin-pop');
    void coinEl.offsetWidth;
    coinEl.classList.add('coin-pop');

    if (qty > 1) SFX.play('coins');
    else SFX.play('sell');

    speak('sell');
    notify('+' + total + ' moedas!', 'coin');
    updateHUD();
    saveGameToDB();
}

// ==========================================
// SHOP / PROGRESSION
// ==========================================
function getUpgradeCost(key) {
    var u = UPGRADES[key];
    return Math.floor(u.baseCost * Math.pow(u.costScale, G.upgrades[key] || 0));
}

function renderShop() {
    var grid = $('#shop-grid');
    grid.innerHTML = '';

    var keys = Object.keys(UPGRADES);
    for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var u = UPGRADES[key];
        var level = G.upgrades[key] || 0;
        var maxed = level >= u.maxLevel;
        var cost = getUpgradeCost(key);
        var canBuy = G.coins >= cost && !maxed;

        var item = document.createElement('div');
        item.className = 'shop-item';

        var pips = '';
        for (var p = 0; p < u.maxLevel; p++) {
            pips += '<div class="shop-pip' + (p < level ? ' filled' : '') + '"></div>';
        }

        item.innerHTML =
            '<div class="shop-item-icon">' + u.icon + '</div>' +
            '<div class="shop-item-info">' +
                '<div class="shop-item-name">' + u.name + '</div>' +
                '<div class="shop-item-desc">' + u.desc + '</div>' +
                '<div class="shop-item-level">' + pips + '</div>' +
            '</div>' +
            '<button class="shop-item-buy' + (maxed ? ' maxed' : '') + '" data-key="' + key + '"' +
                (canBuy ? '' : ' disabled') + '>' +
                (maxed ? 'MAX' : '$' + cost) +
            '</button>';

        grid.appendChild(item);
    }

    // Wire buy buttons
    grid.querySelectorAll('.shop-item-buy:not(.maxed)').forEach(function(btn) {
        btn.addEventListener('click', function() {
            buyUpgrade(btn.dataset.key);
        });
    });
}

function buyUpgrade(key) {
    var cost = getUpgradeCost(key);
    var level = G.upgrades[key] || 0;
    if (level >= UPGRADES[key].maxLevel) { notify('Nível máximo!', 'warn'); return; }
    if (G.coins < cost) { notify('Moedas insuficientes!', 'warn'); SFX.play('error'); return; }

    G.coins -= cost;
    G.upgrades[key] = level + 1;

    if (key === 'plots') {
        PLOT_COUNT = 16 + G.upgrades.plots * 4;
        while (G.plots.length < PLOT_COUNT) G.plots.push({ state: 'empty', growth: 0 });
        buildFarm();
    }

    SFX.play('upgrade');
    notify('Melhoria: ' + UPGRADES[key].name + '!', 'coin');
    updateHUD();
    renderShop();
    saveGameToDB();
}

function openShop() {
    renderShop();
    $('#shop-overlay').classList.remove('hidden');
    SFX.play('click');
}

function closeShop() {
    $('#shop-overlay').classList.add('hidden');
    SFX.play('click');
}

// ==========================================
// SCENE NAVIGATION
// ==========================================
function switchScene(name) {
    if (G.scene === name) return;
    G.scene = name;

    SFX.play('navigate');

    var world = $('#game-world');
    world.classList.add('scene-transitioning');

    setTimeout(function() {
        $$('.scene').forEach(function(s) { s.classList.remove('active'); });
        $$('.scene-btn').forEach(function(b) { b.classList.remove('active'); });
        $('#scene-' + name).classList.add('active');
        $('.scene-btn[data-scene="' + name + '"]').classList.add('active');

        world.classList.remove('scene-transitioning');
        updateHUD();
    }, 150);
}

// ==========================================
// INIT
// ==========================================
function init() {
    SFX.init();

    // Unlock audio on first interaction
    document.addEventListener('click', function() { SFX.unlock(); }, { once: true });
    document.addEventListener('touchstart', function() { SFX.unlock(); }, { once: true });

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
            SFX.play('click');
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
            if (ing === 'manteiga') return;
            var idx = G.selectedIngredients.indexOf(ing);
            if (idx >= 0) G.selectedIngredients.splice(idx, 1);
            else G.selectedIngredients.push(ing);
            $$('.ing-btn').forEach(function(b) {
                b.classList.toggle('selected', G.selectedIngredients.includes(b.dataset.ing));
            });
            SFX.play('click');
        });
    });

    // Sell
    $('#btn-sell').addEventListener('click', function() { sellFarofa(1); });
    $('#btn-sell-all').addEventListener('click', function() { sellFarofa('all'); });

    // Shop
    $('#btn-shop').addEventListener('click', openShop);
    $('#shop-close').addEventListener('click', closeShop);
    $('#shop-overlay').addEventListener('click', function(e) {
        if (e.target === this) closeShop();
    });

    // Growth tick
    setInterval(growthTick, 500);

    // Demand changes every 5 minutes
    updateDemand();
    setInterval(updateDemand, 300000);

    // Auth
    initAuth();
}

document.addEventListener('DOMContentLoaded', init);
