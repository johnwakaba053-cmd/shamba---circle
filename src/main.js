
import { get, set } from './store.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const CHANNELS = [
    {id:'maize', name:'Maize', emoji:'🌽', group:'Crop Farmers'},
    {id:'coffee', name:'Coffee', emoji:'☕', group:'Crop Farmers'},
    {id:'tea', name:'Tea', emoji:'🍃', group:'Crop Farmers'},
    {id:'rice', name:'Rice', emoji:'🌾', group:'Crop Farmers'},
    {id:'roots', name:'Cassava & Roots', emoji:'🍠', group:'Crop Farmers'},
    {id:'beans', name:'Beans & Legumes', emoji:'🫘', group:'Crop Farmers'},
    {id:'bananas', name:'Bananas & Plantain', emoji:'🍌', group:'Crop Farmers'},
    {id:'horticulture', name:'Vegetables & Fruit', emoji:'🍅', group:'Crop Farmers'},
    {id:'sugarcane', name:'Sugarcane', emoji:'🎋', group:'Crop Farmers'},
    {id:'wheat', name:'Wheat', emoji:'🌿', group:'Crop Farmers'},
    {id:'sorghum_millet', name:'Sorghum & Millet', emoji:'🌾', group:'Crop Farmers'},
    {id:'pyrethrum', name:'Pyrethrum', emoji:'🌼', group:'Crop Farmers'},
    {id:'macadamia', name:'Macadamia & Nuts', emoji:'🌰', group:'Crop Farmers'},
    {id:'avocado', name:'Avocado', emoji:'🥑', group:'Crop Farmers'},
    {id:'flowers', name:'Flowers (Floriculture)', emoji:'🌷', group:'Crop Farmers'},
    {id:'cotton', name:'Cotton', emoji:'☁️', group:'Crop Farmers'},
    {id:'dairy_cattle', name:'Dairy Cattle', emoji:'🐄', group:'Animal Farmers'},
    {id:'beef_cattle', name:'Beef Cattle', emoji:'🐂', group:'Animal Farmers'},
    {id:'goats_sheep', name:'Goats & Sheep', emoji:'🐐', group:'Animal Farmers'},
    {id:'pigs', name:'Pigs', emoji:'🐖', group:'Animal Farmers'},
    {id:'chicken', name:'Chicken', emoji:'🐓', group:'Animal Farmers'},
    {id:'camels', name:'Camels', emoji:'🐫', group:'Animal Farmers'},
    {id:'rabbits', name:'Rabbits', emoji:'🐇', group:'Animal Farmers'},
    {id:'beekeeping', name:'Beekeeping', emoji:'🐝', group:'Animal Farmers'},
    {id:'fish', name:'Fish Farming', emoji:'🐟', group:'Animal Farmers'},
    {id:'problems', name:'General Problems', emoji:'🆘', group:'Other'},
  ];
  const GROUP_ORDER = ['Crop Farmers','Animal Farmers','Other'];

  const MARKET_PRICES = [
    {name:'Maize', unit:'per 90kg bag', base:3800},
    {name:'Beans', unit:'per 90kg bag', base:8500},
    {name:'Irish Potatoes', unit:'per 110kg bag', base:2200},
    {name:'Tomatoes', unit:'per crate', base:2800},
    {name:'Coffee (cherry)', unit:'per kg', base:65},
    {name:'Tea (green leaf)', unit:'per kg', base:22},
    {name:'Milk', unit:'per litre', base:52},
    {name:'Eggs', unit:'per tray (30)', base:420},
    {name:'Live Chicken (broiler)', unit:'per bird', base:650},
    {name:'Live Pig', unit:'per kg liveweight', base:230},
    {name:'Beef Cattle', unit:'per kg liveweight', base:310},
    {name:'Goat', unit:'per animal', base:6500},
    {name:'Avocado (Hass)', unit:'per kg export grade', base:45},
  ];

  const WEATHER_SEASONS = [
    {
      title:'Long Rains',
      months:'Mid-March – May',
      crops:'Main planting window for maize, beans, most vegetables, and the start of the coffee flowering cycle in many highland areas.'
    },
    {
      title:'Short Rains',
      months:'October – December',
      crops:'Second planting window for maize and beans in areas that get two seasons, plus good timing for sorghum, millet, and cover crops.'
    },
    {
      title:'Dry Season',
      months:'June – September, January – Mid-March',
      crops:'Best for land preparation, drought-tolerant crops under irrigation, and is when pasture and water planning matters most for livestock.'
    },
  ];

  const DISEASE_ALERTS = [
    {name:'Fall Armyworm', crop:'Maize, sorghum', text:'Watch for ragged holes in leaves and sawdust-like droppings in the whorl, especially early in the growing season.'},
    {name:'Coffee Berry Disease', crop:'Coffee', text:'Look for dark sunken lesions on green berries, worse in wet, humid weather — common during heavy long rains.'},
    {name:'Newcastle Disease', crop:'Chicken', text:'Sudden drop in egg production, breathing difficulty, and greenish diarrhoea can spread fast through a flock — vaccination is the main prevention.'},
    {name:'African Swine Fever', crop:'Pigs', text:'High fever, loss of appetite and skin discolouration; there is no vaccine, so it spreads through contact — report suspected cases to a vet immediately.'},
    {name:'East Coast Fever', crop:'Cattle', text:'Tick-borne disease causing fever and swollen lymph nodes; regular tick control is the main way to protect a herd.'},
    {name:'Banana Bacterial Wilt', crop:'Bananas', text:'Yellowing and wilting leaves with yellow ooze from cut stems — spreads through tools and planting material, so disinfect tools between plants.'},
  ];

  const INSURERS = [
    {name:'CIC Group', type:'Crop & livestock cover', text:'Largest agricultural insurer in Kenya, known for mobile-based micro-cover on inputs like seed and fertiliser, plus multi-peril crop and livestock policies.'},
    {name:'Madison Insurance', type:'Livestock & dairy specialist', text:'Offers specialised livestock and dairy policies, often used by commercial and cooperative dairy farmers.'},
    {name:'APA Insurance', type:'Horticulture & general agri', text:'Provides crop cover with a strong horticulture niche, alongside small-scale machinery cover.'},
    {name:'Old Mutual Kenya', type:'Index-based & multi-peril', text:'Offers both a traditional multi-peril crop policy and an index-based product (weather-station triggered) for smallholders.'},
    {name:'ACRE Africa', type:'Insurance intermediary', text:'A licensed intermediary (not an insurer itself) that partners with local insurers to bring index-based crop and livestock cover to smallholders, including drought-triggered payouts for pastoralists.'},
  ];

  const root = document.getElementById('sc-root');
  let state = {
    screen:'loading', // loading | name | channels | thread | market | weather | insurance
    username:null,
    activeChannel:null,
    previews:{},
    messages:[],
    draft:'',
    flagProblem:false,
    priceTick:0,
    priceSeed:Math.floor(Math.random()*100000),
  };
  let priceInterval = null;

  function seededPrice(base, seed, tick){
    // Deterministic small jitter so it feels alive without inventing real market data
    const x = Math.sin(seed + tick * 12.9898) * 43758.5453;
    const frac = x - Math.floor(x);
    const pct = (frac - 0.5) * 0.04; // +/-2%
    return Math.round(base * (1 + pct));
  }

  function navBar(active){
    const items = [
      {id:'channels', ic:'💬', lb:'Chat'},
      {id:'market', ic:'💰', lb:'Market'},
      {id:'weather', ic:'🌦️', lb:'Weather'},
      {id:'insurance', ic:'🛡️', lb:'Insurance'},
    ];
    return `<div class="sc-nav">
      ${items.map(i=>`
        <button class="sc-nav-btn ${active===i.id?'active':''}" data-nav="${i.id}">
          <span class="ic">${i.ic}</span><span class="lb">${i.lb}</span>
        </button>`).join('')}
    </div>`;
  }
  function wireNav(){
    root.querySelectorAll('[data-nav]').forEach(el=>{
      el.onclick = ()=> goTo(el.getAttribute('data-nav'));
    });
  }
  function goTo(screen){
    if(screen==='channels'){ loadPreviews().then(render); }
    state.screen = screen;
    render();
  }

  function render(){
    if(state.screen==='loading'){
      root.innerHTML = `<div class="sc-loading">Loading Shamba Circle…</div>`;
      return;
    }
    if(state.screen==='name'){
      root.innerHTML = `
        <div class="sc-header">
          <div>
            <div class="sc-title">🌍 Shamba Circle</div>
            <div class="sc-sub">EAST AFRICA FARMER NETWORK</div>
          </div>
        </div>
        <div class="sc-name-gate">
          <h2>What should we call you?</h2>
          <p>Your name shows next to your posts. Everyone in this Circle can see what's shared here — keep it to what you're comfortable posting publicly.</p>
          <input id="sc-name-input" type="text" placeholder="e.g. Amina, Nakuru" maxlength="30" />
          <button id="sc-name-go">Enter the Circle</button>
        </div>`;
      document.getElementById('sc-name-go').onclick = submitName;
      document.getElementById('sc-name-input').onkeydown = (e)=>{ if(e.key==='Enter') submitName(); };
      return;
    }
    if(state.screen==='channels'){
      root.innerHTML = `
        <div class="sc-header">
          <div>
            <div class="sc-title">🌍 Shamba Circle</div>
            <div class="sc-sub">HI ${escapeHtml(state.username).toUpperCase()} — PICK A TOPIC</div>
          </div>
        </div>
        <div class="sc-body">
          ${GROUP_ORDER.map(group=>{
            const chans = CHANNELS.filter(c=>c.group===group);
            return `
            <div class="sc-group-label">${group}</div>
            ${chans.map(c=>{
              const p = state.previews[c.id];
              return `
              <div class="sc-channel" data-id="${c.id}">
                <div class="sc-emoji">${c.emoji}</div>
                <div>
                  <div class="sc-channel-name">${c.name}</div>
                  <div class="sc-channel-preview">${p ? escapeHtml(p.text) : 'No posts yet — start the conversation'}</div>
                </div>
                <div class="sc-channel-count">${p ? p.count : 0}</div>
              </div>`;
            }).join('')}`;
          }).join('')}
        </div>
        ${navBar('channels')}`;
      root.querySelectorAll('.sc-channel').forEach(el=>{
        el.onclick = ()=> openChannel(el.getAttribute('data-id'));
      });
      wireNav();
      return;
    }
    if(state.screen==='thread'){
      const ch = CHANNELS.find(c=>c.id===state.activeChannel);
      root.innerHTML = `
        <div class="sc-header">
          <button class="sc-back" id="sc-back-btn">←</button>
          <div>
            <div class="sc-title">${ch.emoji} ${ch.name}</div>
            <div class="sc-sub">${state.messages.length} POST${state.messages.length===1?'':'S'}</div>
          </div>
        </div>
        <div class="sc-body" id="sc-thread-body">
          ${state.messages.length===0
            ? `<div class="sc-empty">No posts in ${ch.name} yet.<br/>Be the first to ask a question or share what you're seeing in your field.</div>`
            : state.messages.map(m=>`
              <div class="sc-msg ${m.problem?'problem':''}">
                <div class="sc-msg-top">
                  <span class="sc-msg-name">${escapeHtml(m.name)}</span>
                  <span class="sc-msg-time">${formatTime(m.ts)}</span>
                </div>
                ${m.problem?'<div class="sc-tag">PROBLEM</div><br/>':''}
                <div class="sc-msg-text">${escapeHtml(m.text)}</div>
              </div>`).join('')
          }
        </div>
        <div class="sc-composer">
          <div class="sc-flag-row">
            <input type="checkbox" id="sc-flag" ${state.flagProblem?'checked':''}/>
            <label for="sc-flag">Flag as a problem I need help with</label>
          </div>
          <div class="sc-composer-row">
            <textarea id="sc-draft" placeholder="Share what you're farming or ask for help…">${escapeHtml(state.draft)}</textarea>
            <button class="sc-send" id="sc-send-btn" ${state.draft.trim()?'':'disabled'}>Post</button>
          </div>
        </div>`;
      document.getElementById('sc-back-btn').onclick = backToChannels;
      const draftEl = document.getElementById('sc-draft');
      draftEl.oninput = ()=>{ state.draft = draftEl.value; document.getElementById('sc-send-btn').disabled = !draftEl.value.trim(); };
      document.getElementById('sc-flag').onchange = (e)=>{ state.flagProblem = e.target.checked; };
      document.getElementById('sc-send-btn').onclick = postMessage;
      const body = document.getElementById('sc-thread-body');
      body.scrollTop = body.scrollHeight;
      return;
    }
    if(state.screen==='market'){
      root.innerHTML = `
        <div class="sc-header">
          <div>
            <div class="sc-title">💰 Market Prices</div>
            <div class="sc-sub">KENYA — REFERENCE PRICES</div>
          </div>
        </div>
        <div class="sc-body">
          <div class="sc-demo-banner">These are sample prices for demo purposes, not a live market feed yet. Actual prices vary by region and market — real integration would connect to a live source like Kenya's NAFIS/AMIS system.</div>
          <div class="sc-ticker" id="sc-ticker-time"></div>
          ${MARKET_PRICES.map((p,idx)=>{
            const price = seededPrice(p.base, state.priceSeed + idx*7, state.priceTick);
            const prevPrice = seededPrice(p.base, state.priceSeed + idx*7, state.priceTick-1);
            const delta = price - prevPrice;
            return `
            <div class="sc-price-row">
              <div>
                <div class="sc-price-name">${p.name}</div>
                <div class="sc-price-unit">${p.unit}</div>
              </div>
              <div class="sc-price-val">
                <div class="sc-price-num">KES ${price.toLocaleString()}</div>
                <div class="sc-price-delta ${delta>=0?'up':'down'}">${delta>=0?'▲':'▼'} ${Math.abs(delta)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
        ${navBar('market')}`;
      updateTickerTime();
      wireNav();
      return;
    }
    if(state.screen==='weather'){
      root.innerHTML = `
        <div class="sc-header">
          <div>
            <div class="sc-title">🌦️ Weather & Planting</div>
            <div class="sc-sub">KENYA SEASONAL GUIDE</div>
          </div>
        </div>
        <div class="sc-body">
          <div class="sc-demo-banner">General seasonal guidance, not a live local forecast yet. Real dates shift year to year and by region — always check local conditions before planting.</div>
          <div class="sc-section-h">Planting Calendar</div>
          ${WEATHER_SEASONS.map(s=>`
            <div class="sc-season-card">
              <div class="sc-season-title">${s.title}</div>
              <div class="sc-season-months">${s.months}</div>
              <div class="sc-season-crops">${s.crops}</div>
            </div>`).join('')}
          <div class="sc-section-h" style="margin-top:18px;">Disease & Pest Watch</div>
          ${DISEASE_ALERTS.map(d=>`
            <div class="sc-disease-card">
              <div class="sc-disease-name">${d.name}</div>
              <div class="sc-disease-crop">${d.crop}</div>
              <div class="sc-disease-text">${d.text}</div>
            </div>`).join('')}
        </div>
        ${navBar('weather')}`;
      wireNav();
      return;
    }
    if(state.screen==='insurance'){
      root.innerHTML = `
        <div class="sc-header">
          <div>
            <div class="sc-title">🛡️ Farm Insurance</div>
            <div class="sc-sub">PROTECT AGAINST LOSSES</div>
          </div>
        </div>
        <div class="sc-body">
          <div class="sc-demo-banner">General information only, not financial advice. Verify any provider or agent through Kenya's Insurance Regulatory Authority before paying for a policy.</div>
          ${INSURERS.map(i=>`
            <div class="sc-insurer-card">
              <div class="sc-insurer-name">${i.name}</div>
              <div class="sc-insurer-type">${i.type}</div>
              <div class="sc-insurer-text">${i.text}</div>
            </div>`).join('')}
        </div>
        ${navBar('insurance')}`;
      wireNav();
      return;
    }
  }

  function updateTickerTime(){
    const el = document.getElementById('sc-ticker-time');
    if(el) el.textContent = 'updated ' + new Date().toLocaleTimeString();
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function formatTime(ts){
    const d = new Date(ts);
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) + ' ' + d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
  }

  async function init(){
    try{
      const u = await get('username');
      state.username = u ? u.value : null;
    }catch(e){ state.username = null; }
    await loadPreviews();
    state.screen = state.username ? 'channels' : 'name';
    render();
    priceInterval = setInterval(()=>{
      state.priceTick++;
      if(state.screen==='market') render();
    }, 60000);
  }

  async function loadPreviews(){
    const previews = {};
    for(const c of CHANNELS){
      try{
        const res = await get('messages:'+c.id);
        const arr = res && res.value ? JSON.parse(res.value) : [];
        if(arr.length){
          previews[c.id] = {text: arr[arr.length-1].name+': '+arr[arr.length-1].text, count: arr.length};
        }
      }catch(e){ /* no posts yet */ }
    }
    state.previews = previews;
  }

  async function submitName(){
    const val = document.getElementById('sc-name-input').value.trim();
    if(!val) return;
    state.username = val;
    try{ await set('username', val); }catch(e){}
    state.screen = 'channels';
    render();
  }

  async function openChannel(id){
    state.activeChannel = id;
    state.draft = '';
    state.flagProblem = false;
    state.screen = 'thread';
    render();
    try{
      const res = await get('messages:'+id);
      state.messages = res && res.value ? JSON.parse(res.value) : [];
    }catch(e){
      state.messages = [];
    }
    if(state.activeChannel===id) render();
  }

  function backToChannels(){
    state.screen = 'channels';
    loadPreviews().then(render);
    render();
  }

  async function postMessage(){
    const text = state.draft.trim();
    if(!text) return;
    const msg = { name: state.username, text, ts: Date.now(), problem: state.flagProblem };
    state.messages.push(msg);
    state.draft = '';
    state.flagProblem = false;
    render();
    try{
      await set('messages:'+state.activeChannel, JSON.stringify(state.messages));
    }catch(e){
      console.error('Could not save post', e);
    }
  }

  init();
