/* =========================================================
   CORPOTEX — application (routing, catalogue, demande de devis)
   ========================================================= */
(() => {
  const D = window.CORPOTEX, C = D.config;
  const P = window.CORPOTEX_PRODUCTS.map((p, i) => ({ ...p, _i: i }));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const icon = (id, cls = '') => `<svg class="i ${cls}"><use href="#${id}"/></svg>`;
  const catById = id => D.categories.find(c => c.id === id);
  const bySlug = s => P.find(p => p.slug === s);
  const sslug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const subUrl = (cat, sub) => `/catalogue/${cat}/${sslug(sub)}`;
  const subBySlug = (cat, slug) => [...new Set(P.filter(p => p.category === cat).map(p => p.subcategory))].find(x => sslug(x) === slug);
  const app = $('#app');
  const isTouch = () => matchMedia('(max-width: 1020px)').matches;
  const isPhone = () => matchMedia('(max-width: 720px)').matches;
  // coloris affiché par défaut : blanc, sinon noir, sinon le premier
  const defVar = p => { if (!p.variants || !p.variants.length) return -1; if (p.defColor) { const k = p.variants.findIndex(v => v.n === p.defColor); if (k >= 0) return k; } for (const n of ['Blanc', 'Noir']) { const i = p.variants.findIndex(v => v.n === n); if (i >= 0) return i; } return 0; };

  /* ---------- Logo ---------- */
  // Logo officiel (/assets/logo, découpé depuis corpotex-logo.png). Le slogan est calé sur la largeur exacte du mot.
  const LOGO = `<span class="lg-mark"><img class="lg-d" src="/assets/logo/mark.png" alt=""><img class="lg-w" src="/assets/logo/mark-white.png" alt=""></span><span class="lg-wm"><img class="lg-d" src="/assets/logo/word.png" alt="Corpotex"><img class="lg-w" src="/assets/logo/word-white.png" alt=""><svg class="lg-tag" viewBox="0 0 470 30" aria-hidden="true"><text x="0" y="24" textLength="470" lengthAdjust="spacing">CONSTRUIRE. INNOVER. PROPULSER.</text></svg></span>`;
  $$('[data-logo]').forEach(el => el.innerHTML = LOGO);

  /* ---------- Contact ---------- */
  $$('[data-tel]').forEach(a => a.href = 'tel:' + C.phoneRaw);
  $$('[data-phone-label]').forEach(s => s.textContent = C.phone);
  $$('[data-mail]').forEach(a => a.href = 'mailto:' + C.email);
  $$('[data-mail-label]').forEach(s => s.textContent = C.email);
  $$('[data-web]').forEach(a => a.href = 'https://' + C.web);
  $$('[data-web-label]').forEach(s => s.textContent = C.web);
  $$('[data-year]').forEach(s => s.textContent = new Date().getFullYear());

  /* ---------- WhatsApp ---------- */
  const WA_MSG = {
    home: 'Bonjour, je souhaite avoir des informations sur vos solutions professionnelles.',
    quote: 'Bonjour, je souhaite échanger concernant ma demande de devis.',
    advice: 'Bonjour, j’aimerais être conseillé sur la personnalisation de mon projet.',
  };
  let waContext = WA_MSG.home;
  const waUrl = msg => `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}`;
  const waProduct = p => `Bonjour, je souhaite avoir des informations sur le produit ${p.name}${p.reference ? ' – Réf. ' + p.reference : ''}.`;
  function refreshWa() {
    $$('[data-wa]').forEach(a => {
      const k = a.dataset.wa;
      a.href = waUrl(k === 'context' ? waContext : k.startsWith('p:') ? waProduct(bySlug(k.slice(2)) || {}) : (WA_MSG[k] || WA_MSG.home));
      a.target = '_blank'; a.rel = 'noopener';
    });
  }

  /* ---------- Store (demande de devis) ---------- */
  const KEY = 'corpotex.quote.v1';
  const store = (() => {
    let s = { items: [], message: '', date: '', custom: { tech: 'Je ne sais pas', zone: [] } };
    try { const raw = JSON.parse(localStorage.getItem(KEY)); if (raw && Array.isArray(raw.items)) s = { ...s, ...raw }; } catch (e) { }
    s.items = s.items.filter(i => bySlug(i.slug));
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } };
    return {
      get: () => s,
      has: slug => s.items.some(i => i.slug === slug),
      add(slug, qty = 50, color) { const it = s.items.find(i => i.slug === slug); if (it) { it.qty += qty; if (color) it.color = color; } else s.items.push(color ? { slug, qty, color } : { slug, qty }); save(); emit(); },
      setColor(slug, color) { const it = s.items.find(i => i.slug === slug); if (it && color) { it.color = color; save(); emit(true); } },
      set(slug, qty) { const it = s.items.find(i => i.slug === slug); if (it) { it.qty = Math.max(1, qty | 0 || 1); save(); emit(true); } },
      rm(slug) { s.items = s.items.filter(i => i.slug !== slug); save(); emit(); },
      patch(o) { Object.assign(s, o); save(); },
      clear() { s = { items: [], message: '', date: '', custom: { tech: 'Je ne sais pas', zone: [] } }; save(); emit(); },
    };
  })();
  const listeners = [];
  function emit(silent) { listeners.forEach(f => f(silent)); }
  let lastCount = store.get().items.length;
  listeners.push(silent => {
    const n = store.get().items.length;
    $$('[data-qcount]').forEach(e => e.textContent = n);
    if (n > lastCount) { ['#qtab', '.bnav__q'].forEach(s => { const el = $(s); if (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }); }
    lastCount = n;
    if (!silent && $('#quoteDrawer').classList.contains('is-open')) renderQuote();
    $$('.pc__add').forEach(b => { const on = store.has(b.dataset.add); b.classList.toggle('is-in', on); b.innerHTML = addLabel(on); });
  });

  /* ---------- UI helpers ---------- */
  let toastT;
  function toast(msg, action) {
    const t = $('#toast');
    t.innerHTML = `<span class="ok">${icon('i-check')}</span><span>${msg}</span>` + (action ? `<button type="button">${action.label}</button>` : '');
    if (action) t.querySelector('button').onclick = () => { action.fn(); t.classList.remove('is-on'); };
    t.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 3800);
  }
  function fly(fromImg) {
    const target = matchMedia('(max-width:720px)').matches ? $('.bnav__q') : $('#qtab');
    if (!fromImg || !target || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = fromImg.getBoundingClientRect(), b = target.getBoundingClientRect();
    const f = document.createElement('img'); f.src = fromImg.currentSrc || fromImg.src; f.className = 'fly';
    Object.assign(f.style, { left: a.left + a.width / 2 - 35 + 'px', top: a.top + a.height / 2 - 35 + 'px' });
    document.body.appendChild(f);
    requestAnimationFrame(() => requestAnimationFrame(() => Object.assign(f.style, { left: b.left + b.width / 2 - 20 + 'px', top: b.top + b.height / 2 - 20 + 'px', width: '40px', height: '40px', opacity: '.3', borderRadius: '50%' })));
    setTimeout(() => f.remove(), 800);
  }
  function addToQuote(slug, qty, imgEl, color) {
    const p = bySlug(slug); if (!p) return;
    const was = store.has(slug);
    store.add(slug, qty || 50, color);
    fly(imgEl);
    toast(was ? `Quantité mise à jour · ${esc(p.name)}` : `Ajouté à votre demande · ${esc(p.name)}`, { label: 'Voir ma demande', fn: () => openDrawer('quote') });
  }

  // overlays
  let lastFocus = null;
  function openDrawer(which) {
    const el = which === 'quote' ? $('#quoteDrawer') : $('#filterDrawer');
    if (which === 'quote') renderQuote(); else renderFilters();
    lastFocus = document.activeElement;
    el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('is-on'); document.body.classList.add('drawer-open'); document.body.style.overflow = 'hidden';
    setTimeout(() => (el.querySelector('.x') || el).focus(), 50);
  }
  function closeAll() {
    $$('.drawer.is-open').forEach(d => { d.classList.remove('is-open'); d.setAttribute('aria-hidden', 'true'); });
    $('#scrim').classList.remove('is-on'); document.body.classList.remove('drawer-open');
    closeSearch(); closeLb(); closeMenu();
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) { }
  }
  $('#scrim').onclick = closeAll;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  });

  // mobile menu
  const burger = $('[data-burger]');
  function closeMenu() { $('#mmenu').classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }
  burger.onclick = () => { const o = !$('#mmenu').classList.contains('is-open'); $('#mmenu').classList.toggle('is-open', o); burger.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; };
  $$('#mmenu a').forEach(a => a.addEventListener('click', () => { closeMenu(); document.body.style.overflow = ''; }));

  // global delegation
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-open-quote],[data-open-search],[data-close],[data-add],[data-open-filter],[data-lb]');
    if (!t) return;
    if (t.matches('[data-open-quote]')) { e.preventDefault(); openDrawer('quote'); }
    else if (t.matches('[data-open-search]')) { e.preventDefault(); openSearch(t.dataset.q || ''); }
    else if (t.matches('[data-close]')) { e.preventDefault(); closeAll(); }
    else if (t.matches('[data-open-filter]')) { e.preventDefault(); openDrawer('filter'); }
    else if (t.matches('[data-lb]')) { e.preventDefault(); openLb(+t.dataset.lb, t.dataset.set); }
    else if (t.matches('[data-add]')) {
      e.preventDefault(); e.stopPropagation();
      const card = t.closest('.pc, .sp, .sc'); const qtyEl = t.dataset.qtyFrom && $(t.dataset.qtyFrom);
      addToQuote(t.dataset.add, qtyEl ? +qtyEl.value : 50, card ? card.querySelector('.pc__media img, .sp__img img, .sc__img img') : $('.gal__main img'));
    }
  });

  /* ---------- Header ---------- */
  const hdr = $('#hdr');
  const onScroll = () => hdr.classList.toggle('is-scrolled', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- Reveal ---------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' }) : null;
  let revealT;
  const reveal = () => {
    $$('.rv:not(.in)').forEach(el => (io && !isTouch()) ? io.observe(el) : el.classList.add('in'));
    // Filet de sécurité : rien ne doit rester invisible si l'observateur ne se déclenche pas
    clearTimeout(revealT); revealT = setTimeout(() => $$('.rv:not(.in)').forEach(el => el.classList.add('in')), 1000);
  };

  /* ---------- Components ---------- */
  const hexAlias = {}; (window.CORPOTEX_PRODUCTS || []).forEach(p => (p.variants || []).forEach(v => { if (v.hex) hexAlias[v.n] = v.hex; }));
  const swatch = c => D.colorHex[c] || D.colorHex[hexAlias[c]] || '#c9ccd1';
  const specsOf = p => {
    const out = [];
    const mat = (p.specs || []).find(s => /coton|polyester|cuir|abs|nitrile|polyamide|pvc|rpet|polycarbonate|tige/i.test(s) && s.length < 60);
    if (mat) out.push(mat);
    if (p.weight) out.push(p.weight);
    if (p.colors && p.colors.length > 1) out.push(p.colors.length + ' coloris');
    (p.specs || []).forEach(s => { if (out.length < 3 && !out.includes(s) && s.length < 46 && !/:$/.test(s)) out.push(s); });
    return out.slice(0, 3);
  };
  const avail = p => `<span class="badge ${p.availability === 'Disponible' ? 'badge--ok' : 'badge--order'}">${esc(p.availability)}</span>`;
  const isFull = (p, k) => (p.full || []).includes(k);
  const addLabel = on => on ? `${icon('i-check')}<span>Dans mon devis</span>` : `${icon('i-plus')}<span>Ajouter au devis</span>`;
  function card(p, i = 0) {
    const imgs = p.images.slice(0, 2);
    const chips = [p.weight, p.colors && p.colors.length > 1 ? p.colors.length + ' coloris' : '', p.sizes && p.sizes.length ? p.sizes[0] + ' → ' + p.sizes[p.sizes.length - 1] : ''].filter(Boolean).slice(0, 2);
    const on = store.has(p.slug);
    return `<article class="pc">
      <a class="pc__media" href="/produit/${p.slug}" aria-label="Voir ${esc(p.name)}">
        ${imgs.map((s, k) => `<img class="${isFull(p, k) ? 'is-full' : ''}" src="${s}" alt="${k ? '' : esc(p.name)}" loading="lazy" decoding="async">`).join('')}
        <span class="pc__tag">${avail(p)}</span>
        ${p.badge ? `<span class="pc__flag">${esc(p.badge)}</span>` : ''}
        <span class="pc__peek">Voir la fiche ${icon('i-arrow')}</span>
      </a>
      <div class="pc__body">
        <div class="pc__meta"><span>${esc(p.brand || catById(p.category).short)}</span>${p.reference ? `<span>Réf. ${esc(p.reference)}</span>` : ''}</div>
        <h3 class="pc__name"><a href="/produit/${p.slug}">${esc(p.name)}</a></h3>
        <div class="pc__info">
          ${p.colors && p.colors.length > 1 ? `<span class="pc__dots">${p.colors.slice(0, 5).map(c => `<i style="background:${swatch(c)}" title="${esc(c)}"></i>`).join('')}</span>` : ''}
          ${chips.map(c => `<span class="pc__chip">${esc(c)}</span>`).join('')}
        </div>
        <div class="pc__actions">
          <a class="pc__btn pc__btn--ghost" href="/produit/${p.slug}">Voir la fiche</a>
          <button type="button" class="pc__btn pc__add ${on ? 'is-in' : ''}" data-add="${p.slug}" aria-label="Ajouter ${esc(p.name)} à ma demande de devis">${addLabel(on)}</button>
        </div>
      </div>
    </article>`;
  }
  const skel = n => Array.from({ length: n }, () => `<div class="pc pc--sk"><div class="pc__media"><div class="sk"></div></div><div class="pc__body"><div class="sk" style="height:10px;width:40%"></div><div class="sk" style="height:16px;width:85%;margin-top:10px"></div><div class="sk" style="height:10px;width:30%;margin-top:10px"></div><div class="sk" style="height:34px;margin-top:24px"></div></div></div>`).join('');
  const crumbs = arr => `<nav class="crumbs" aria-label="Fil d’Ariane">${arr.map((c, i) => (i ? icon('i-chev-r') : '') + (c[1] ? `<a href="${c[1]}">${esc(c[0])}</a>` : `<span aria-current="page">${esc(c[0])}</span>`)).join('')}</nav>`;
  const count = cat => P.filter(p => p.category === cat).length;
  const sbar = (cls = '') => `<button class="sbar ${cls}" data-open-search aria-label="Rechercher un produit">${icon('i-search')}<span class="sbar__ph" data-typer>Que recherchez-vous ?</span><span class="sbar__go">${icon('i-search')}<span>Rechercher</span></span></button>`;
  const fcta = () => `
    <section class="sec sec--tight"><div class="wrap"><div class="fcta rv">
      <div class="fcta__img"><img src="/assets/img/pro/ware.webp" alt="" loading="lazy"></div>
      <div>
        <span class="eyebrow">Parlons de votre projet</span>
        <h2 class="h2">Votre projet commence<br>par un <span class="y">besoin.</span></h2>
        <p class="lead">Décrivez-nous ce qu’il vous faut. Notre équipe vous accompagne dans le choix des produits, des quantités et des solutions de personnalisation.</p>
      </div>
      <div class="fcta__side">
        <a href="/devis" class="btn btn--primary btn--lg">Demander un devis ${icon('i-arrow')}</a>
        <a class="btn btn--wa btn--lg" data-wa="home">${icon('i-wa')} WhatsApp</a>
        <a class="fcta__tel" href="tel:${C.phoneRaw}">${icon('i-phone')} ${C.phone}</a>
      </div>
    </div></div></section>`;

  // search placeholder typer
  let typerT;
  function typer() {
    clearTimeout(typerT);
    const els = $$('[data-typer]'); if (!els.length) return;
    if (isTouch()) { els.forEach(e => e.textContent = 'Rechercher un produit, une référence…'); return; }
    const words = ['200 polos brodés', 'T-shirt 0614220', 'Gilets haute visibilité', '500 tote bags', 'Casques de chantier', 'Sweats à capuche', 'Gants anti-coupure'];
    let w = 0, c = 0, dir = 1;
    const tick = () => {
      if (!document.body.contains(els[0])) return;
      const word = words[w]; c += dir;
      els.forEach(e => e.innerHTML = `Que recherchez-vous ? <b>${esc(word.slice(0, c))}</b><span class="caret"></span>`);
      let d = dir > 0 ? 70 : 30;
      if (c >= word.length) { dir = -1; d = 1600; } else if (c <= 0) { dir = 1; w = (w + 1) % words.length; d = 300; }
      typerT = setTimeout(tick, d);
    };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) typerT = setTimeout(tick, 1400);
  }

  /* =========================================================
     VIEWS
     ========================================================= */
  function viewHome() {
    const hp = D.heroProducts.map(bySlug).filter(Boolean);
    const cats = D.categories.map((c, i) => `
      <a class="cat rv" style="--d:${i}" href="/catalogue/${c.id}">
        <img src="${c.img}" alt="" loading="lazy">
        <span class="cat__n">0${i + 1}</span><span class="cat__count">${count(c.id)} références</span>
        <h3>${c.name}</h3><p>${c.text}</p>
        <div class="cat__tags">${c.tags.map(t => `<span>${t}</span>`).join('')}</div>
        <span class="cat__go"><i>${icon('i-arrow')}</i>Explorer la gamme</span>
      </a>`).join('') + `
      <a class="cat cat--perso rv" style="--d:4" href="/personnalisation">
        <img src="/assets/img/pro/c_perso.webp" alt="" loading="lazy">
        <span class="cat__n">05</span>
        <h3>Solutions personnalisées</h3><p>Broderie, sérigraphie, DTF, transfert : votre marque sur chaque pièce, pour vos équipes, événements et campagnes.</p>
        <div class="cat__tags"><span>Pour vos équipes</span><span>Événements</span><span>Communication</span><span>Marquage</span></div>
        <span class="cat__go"><i>${icon('i-arrow')}</i>Découvrir</span>
      </a>`;
    const brands = [...new Set(P.map(p => p.brand).filter(Boolean))].map(b => [b, P.filter(p => p.brand === b).length]).sort((a, b) => b[1] - a[1]);
    app.innerHTML = `<div class="page page--flush">
      <section class="hero">
        <div class="hero__bg" aria-hidden="true"><img src="/assets/img/pro/hero.webp" alt="" fetchpriority="high"></div>
        <div class="wrap hero__grid">
          <div>
            <span class="hero__kicker"><b>B2B</b> Fournisseur textile & EPI pour les entreprises au Maroc</span>
            <p class="h1 hero__title"><span class="ln"><span style="--i:0">Des solutions durables</span></span><span class="ln"><span style="--i:1">pour construire</span></span><span class="ln"><span style="--i:2" class="y">demain.</span></span></p>
            <h1 class="hero__sub">Textile publicitaire, vêtements de travail, EPI et solutions personnalisées pour les entreprises au Maroc.</h1>
            <div class="hero__search">${sbar()}</div>
            <div class="hero__cta">
              <a href="/catalogue" class="btn btn--primary btn--lg">Explorer le catalogue ${icon('i-arrow')}</a>
              <a href="/devis" class="btn btn--ghost-inv btn--lg">Demander un devis</a>
              <a class="btn btn--wa btn--lg" data-wa="home">${icon('i-wa')} WhatsApp</a>
            </div>
            <div class="hero__trust"><span>${icon('i-check')}Prix sur devis, sans engagement</span><span>${icon('i-check')}Conseil personnalisé</span><span>${icon('i-check')}10 à 10 000 pièces</span></div>
          </div>
          <div class="showcase">
            <div class="showcase__hd"><span>Références phares</span><a href="/catalogue">Tout voir ${icon('i-arrow')}</a></div>
            <div class="showcase__grid">${hp.map((p, k) => `<a class="sc" style="--k:${k}" href="/produit/${p.slug}"><span class="sc__img"><img src="${p.images[0]}" alt="${esc(p.name)}"></span><span class="sc__txt"><small>${esc(p.brand || catById(p.category).short)}</small><b>${esc(p.name)}</b>${p.reference ? `<em>Réf. ${esc(p.reference)}</em>` : ''}</span></a>`).join('')}</div>
            <div class="showcase__ft"><span class="dot">${icon('i-clock')}</span><span><b>Réponse sous 24H</b><small>Devis personnalisé, jours ouvrés</small></span></div>
          </div>
        </div>
        <div class="reas"><div class="wrap reas__in">
          ${D.reassurance.map(r => `<div class="reas__it"><span class="reas__ic">${icon(r.icon)}</span><span><b>${r.title.replace('{count}', P.length)}</b><small>${r.text}</small></span></div>`).join('')}
        </div></div>
      </section>

      <div class="band" aria-hidden="true"><div class="band__track">${Array(2).fill(['Textile publicitaire', 'Vêtements professionnels', 'EPI', 'Goodies & sacs', 'Broderie', 'Sérigraphie', 'DTF', 'Transfert', 'Haute visibilité'].map(t => `<span>${t}</span>`).join('')).join('')}</div></div>

      <section class="sec hprod"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Nos produits</span><h2 class="h2">Ce que nous fournissons<br><span class="y">à vos équipes.</span></h2></div>
          <a href="/catalogue" class="btn btn--ghost">Tout le catalogue ${icon('i-arrow')}</a></div>
        <div class="hprod__tabs" role="tablist" aria-label="Familles de produits">
          <button class="chip is-on" data-hp="" role="tab">Best-sellers</button>
          ${D.categories.map(c => `<button class="chip" data-hp="${c.id}" role="tab">${c.short}</button>`).join('')}
        </div>
        <div class="grid hprod__grid" id="hpGrid"></div>
        <div class="hprod__more"><a href="/catalogue" class="btn btn--primary btn--lg">Voir les ${P.length} références ${icon('i-arrow')}</a></div>
      </div></section>

      <section class="sec"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Nos solutions</span><h2 class="h2 rv">Tout ce dont vos équipes<br>ont besoin. <span class="y">Au même endroit.</span></h2></div>
          <a href="/catalogue" class="btn btn--ghost">Voir tout le catalogue ${icon('i-arrow')}</a></div>
        <div class="bento">${cats}</div>
      </div></section>

      <section class="sec sec--tight"><div class="wrap">
        <div class="refbox rv">
          <span class="corner"></span>
          <div>
            <span class="eyebrow">Accès direct</span>
            <h2 class="h2">Vous avez déjà<br>votre <span class="y">référence&nbsp;?</span></h2>
            <p class="lead" style="color:rgba(255,255,255,.7);margin-top:14px">Saisissez une référence, un produit ou une marque. Résultat instantané.</p>
          </div>
          <div>
            <div class="refbox__field">${icon('i-search')}<input class="refbox__in" id="refIn" placeholder="Rechercher une référence, un produit, une marque…" aria-label="Rechercher une référence" autocomplete="off"></div>
            <div class="refchips">${['0614220', '0634020', 'Polo', 'Casque', 'Tote bag'].map(t => `<button type="button" data-ref="${t}">${t}</button>`).join('')}</div>
            <div class="refbox__res" id="refRes" aria-live="polite"></div>
          </div>
        </div>
      </div></section>

      <section class="sec sec--gray"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Besoin d’aide pour choisir ?</span><h2 class="h2 rv">Vous avez le besoin.<br><span class="y">Nous avons la solution.</span></h2>
          <p class="lead">Pas besoin de connaître le vocabulaire technique. Choisissez votre situation, on s’occupe du reste.</p></div></div>
        <div class="needs">
          <div class="needs__list" role="tablist">${D.needs.map((n, i) => `<button class="need ${i ? '' : 'is-on'}" role="tab" aria-selected="${!i}" data-need="${i}"><span class="need__n">0${i + 1}</span><span class="need__q">${n.q}<span class="need__a">→ ${n.a}</span></span>${icon('i-arrow')}</button>`).join('')}</div>
          <div class="needs__panel" id="needPanel"></div>
        </div>
      </div></section>

      <section class="sec"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Comment ça marche</span><h2 class="h2 rv">Du besoin au devis,<br>en <span class="y">4 étapes simples.</span></h2></div>
          <a href="/devis" class="btn btn--primary">Démarrer ma demande ${icon('i-arrow')}</a></div>
        <div class="proc">${D.process.map((s, i) => `<div class="step rv" style="--d:${i}"><div class="step__n">${s.n}</div><h3>${s.t}</h3><p>${s.d}</p></div>`).join('')}</div>
      </div></section>

      <section class="sec sec--navy" style="overflow:hidden"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Personnalisation</span><h2 class="h2 rv">Personnalisez<br>votre <span class="y">projet.</span></h2>
          <p class="lead">Nous adaptons la technique de marquage à votre produit, votre quantité et votre besoin. Aucune obligation de choisir.</p></div></div>
        <div class="techs">${D.techniques.map((t, i) => `<a class="tech rv" style="--d:${i}" href="/personnalisation/${t.id}"><span class="tech__n">0${i + 1}</span><div class="tech__ic">${icon(t.icon)}</div><h3>${t.name}</h3><p>${t.text}</p><small>${t.best}</small><span class="tech__more">En savoir plus ${icon('i-arrow')}</span></a>`).join('')}</div>
        <div class="advbar rv"><div><b>Vous ne savez pas quelle technique utiliser ?</b><p>Nous vous recommandons la solution adaptée après analyse de votre projet.</p></div>
          <div class="row"><a href="/devis" class="btn btn--primary">Être conseillé</a><a class="btn btn--wa" data-wa="advice">${icon('i-wa')} WhatsApp</a></div></div>
      </div></section>

      <section class="sec"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Solutions par métier</span><h2 class="h2 rv">Une réponse pour<br><span class="y">chaque secteur.</span></h2></div>
          <div class="scroll-nav"><button aria-label="Précédent" data-hs="-1">${icon('i-chev-l')}</button><button aria-label="Suivant" data-hs="1">${icon('i-chev-r')}</button></div></div>
        <div class="hscroll" id="sectors">${D.sectors.map((s, i) => `<a class="sector" href="/solutions/${s.slug}"><img src="${s.img}" alt="" loading="lazy"><span class="sector__n">0${i + 1}</span><h3>${s.name}</h3><p>${s.intro}</p><span class="cat__go"><i>${icon('i-arrow')}</i>Voir la sélection</span></a>`).join('')}</div>
      </div></section>

      <section class="sec sec--gray"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Réalisations</span><h2 class="h2 rv">Des projets concrets.<br><span class="y">Des solutions adaptées.</span></h2></div>
          <a href="/projets" class="btn btn--ghost">Toutes les réalisations ${icon('i-arrow')}</a></div>
        <div class="pstrip">${D.projects.slice(0, 7).map((p, i) => projTile(p, i, 'home')).join('')}</div>
      </div></section>

      <section class="sec"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Notre approche</span><h2 class="h2 rv">Pas simplement des produits.<br><span class="y">Des solutions pour vos projets.</span></h2></div></div>
        <div class="values">${D.values.map((v, i) => `<div class="val rv" style="--d:${i}">${icon(v.icon)}<h3>${v.name}</h3><p>${v.text}</p></div>`).join('')}</div>
      </div></section>

      <section class="sec sec--tight sec--cream"><div class="wrap">
        <div class="sec-hd" style="margin-bottom:28px"><div><span class="eyebrow">Ils nous font confiance</span><h2 class="h3">Entreprises, institutions et marques qui nous ont confié leurs projets</h2></div></div>
        <div class="clients"><div class="clients__track">${[...D.clients, ...D.clients].map(c => `<div class="clients__it"><img src="/assets/img/clients/${c}.webp" alt="Logo client" loading="lazy"></div>`).join('')}</div></div>
        <div class="sec-hd" style="margin:56px 0 20px"><div><span class="eyebrow">Marques distribuées</span><h2 class="h3">Des marques reconnues, sélectionnées pour leur qualité</h2></div></div>
        <div class="brands">${brands.map(([b, n]) => `<a class="brand" href="/catalogue?brand=${encodeURIComponent(b)}">${esc(b)}<small>${n} réf.</small></a>`).join('')}</div>
      </div></section>

      <section class="sec sec--gray"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Guides & conseils</span><h2 class="h2">Bien choisir,<br><span class="y">bien équiper.</span></h2></div><a href="/guides" class="btn btn--ghost btn--sm">Tous les guides ${icon('i-arrow')}</a></div>
        <div class="gcards">${D.guides.map(guideCard).join('')}</div>
      </div></section>

      <section class="sec" id="faq"><div class="wrap faq">
        <div class="sec-hd"><div><span class="eyebrow">Questions fréquentes</span><h2 class="h2">Textile publicitaire & EPI au Maroc :<br><span class="y">vos questions.</span></h2></div></div>
        <div class="faq__list">${D.faq.map((f, i) => `<details class="faq__it"${i ? '' : ' open'}><summary><h3>${esc(f.q)}</h3>${icon('i-plus')}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
      </div></section>
      ${fcta()}
    </div>`;
    // needs
    const renderNeed = i => {
      const n = D.needs[i];
      const prods = n.picks.map(bySlug).filter(Boolean).slice(0, 3);
      $('#needPanel').innerHTML = `<div class="needs__photo"><img src="${n.img}" alt=""><div class="needs__cap"><span class="eyebrow">Notre recommandation</span><h3>${n.a}</h3></div></div>
        <div class="needs__body">
          <div class="needs__prods">${prods.map((p, k) => `<a class="mini" style="--d:${k}" href="/produit/${p.slug}"><span class="mini__img"><img src="${p.images[0]}" alt="${esc(p.name)}" loading="lazy"></span><b>${esc(p.name)}</b><small>${p.reference ? 'Réf. ' + esc(p.reference) : esc(p.brand || p.subcategory)}</small></a>`).join('')}</div>
          <div class="row"><a href="${n.to}" class="btn btn--primary">Voir la sélection ${icon('i-arrow')}</a><a href="/devis" class="btn btn--ghost-inv">Décrire mon besoin</a></div>
        </div>`;
    };
    renderNeed(0);
    // Produits de l'accueil : best-sellers, puis une sélection par famille
    const BEST = ['iconic-195-ringspun-premium-0614220', 'polo-pique-65-35-0634020', 'ensemble-veste-pantalon-travail-ar-vp', 'casque-de-chantier-en397',
      'classic-hooded-sweat-sweat-a-capuche-0622080', 'gilet-de-travail-ar-gil', 'tote-bag-coton-240g-1172', 'chaussure-de-securite-faucon-s3-src'];
    const renderHP = cat => {
      const list = cat ? P.filter(p => p.category === cat).sort((a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0)).slice(0, 8) : BEST.map(bySlug).filter(Boolean);
      $('#hpGrid').innerHTML = list.map(card).join('');
      $('.hprod__more a').href = cat ? '/catalogue/' + cat : '/catalogue';
    };
    renderHP('');
    $$('[data-hp]').forEach(b => b.onclick = () => { $$('[data-hp]').forEach(x => x.classList.toggle('is-on', x === b)); renderHP(b.dataset.hp); });
    $$('[data-need]').forEach(b => b.addEventListener('click', () => { if (isPhone()) { nav(D.needs[+b.dataset.need].to); return; } $$('[data-need]').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b); }); renderNeed(+b.dataset.need); }));
    // ref box
    const refIn = $('#refIn'), refRes = $('#refRes');
    const doRef = () => {
      const q = refIn.value.trim();
      if (!q) { refRes.innerHTML = ''; return; }
      const r = searchProducts(q).slice(0, 3);
      refRes.innerHTML = r.length ? r.map(p => `<a class="refhit" href="/produit/${p.slug}"><img src="${p.images[0]}" alt=""><span><b>${esc(p.name)}</b><small>${p.reference ? 'Réf. ' + esc(p.reference) + ' · ' : ''}${esc(p.brand || catById(p.category).name)}</small></span><span class="link">Voir le produit ${icon('i-arrow')}</span></a>`).join('')
        : `<div class="refhit" style="cursor:default"><span><b>Aucune référence trouvée</b><small>Décrivez-nous votre besoin, nous trouverons le bon produit.</small></span><a href="/devis" class="link">Demander ${icon('i-arrow')}</a></div>`;
    };
    refIn.addEventListener('input', doRef);
    $$('[data-ref]').forEach(b => b.onclick = () => { refIn.value = b.dataset.ref; doRef(); refIn.focus(); });
    // sectors scroll
    $$('[data-hs]').forEach(b => b.onclick = () => $('#sectors').scrollBy({ left: +b.dataset.hs * 320, behavior: 'smooth' }));
    typer();
  }

  function projTile(p, i, set) {
    return `<button class="proj rv" style="--d:${i % 6}" data-lb="${D.projects.indexOf(p)}" data-set="${set}" aria-label="${esc(p.product)} — agrandir"><img src="${p.img}" alt="${esc(p.product)}" loading="lazy"><span class="proj__tag">${esc(p.solution)}</span><span class="proj__cap"><b>${esc(p.product)}</b><small>${esc(p.sector)}</small></span></button>`;
  }

  /* ---------- Catalogue ---------- */
  const F = { brand: [], sub: [], avail: [], tech: [], weight: [], q: '' };
  const WEIGHTS = [['Léger · < 160 g/m²', 0, 159], ['Standard · 160–199 g/m²', 160, 199], ['Épais · 200 g/m² et +', 200, 999]];
  const wOf = p => parseInt(p.weight) || 0;
  let sortBy = 'pert', curCat = '';
  function filtered(cat) {
    let r = P.filter(p => !cat || p.category === cat);
    if (F.q) { const ids = new Set(searchProducts(F.q).map(p => p.slug)); r = r.filter(p => ids.has(p.slug)); }
    if (F.brand.length) r = r.filter(p => F.brand.includes(p.brand));
    if (F.sub.length) r = r.filter(p => F.sub.includes(p.subcategory));
    if (F.avail.length) r = r.filter(p => F.avail.includes(p.availability));
    if (F.tech.length) r = r.filter(p => F.tech.every(t => (p.techniques || []).includes(t)));
    if (F.weight.length) r = r.filter(p => F.weight.some(k => { const w = wOf(p), [, a, b] = WEIGHTS[k]; return w >= a && w <= b; }));
    if (sortBy === 'az') r = [...r].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'ref') r = [...r].sort((a, b) => (a.reference || 'zz').localeCompare(b.reference || 'zz'));
    if (sortBy === 'brand') r = [...r].sort((a, b) => (a.brand || 'zz').localeCompare(b.brand || 'zz'));
    return r;
  }
  const nFilters = () => F.brand.length + F.sub.length + F.avail.length + F.tech.length + F.weight.length;

  function viewCatalogue(cat, params, subSlug) {
    if (cat && !catById(cat)) return view404();
    const subName = subSlug ? subBySlug(cat, subSlug) : '';
    if (subSlug && !subName) return view404();
    // ancienne forme ?sub=… : redirigée vers l'adresse propre de la sous-catégorie
    if (!subSlug && cat && params.get('sub') && subBySlug(cat, sslug(params.get('sub')))) { history.replaceState(null, '', subUrl(cat, params.get('sub'))); return route(); }
    const ss = subName ? (D.seoSubs[cat + '/' + subSlug] || { h1: subName, intro: catById(cat).text }) : null;
    if (cat !== curCat) { F.sub = []; curCat = cat; }
    if (cat) F.sub = subName ? [subName] : [];
    if (params.get('brand')) F.brand = [params.get('brand')];
    if (!cat && params.get('sub')) F.sub = [params.get('sub')];
    if (params.get('q') !== null) F.q = params.get('q') || '';
    const c = catById(cat);
    const subs = [...new Set(P.filter(p => !cat || p.category === cat).map(p => p.subcategory))];
    app.innerHTML = `<div class="page page--flush">
      <header class="chead"><div class="chead__bg" aria-hidden="true"><img src="${cat ? c.img : '/assets/img/pro/tex.webp'}" alt=""></div><span class="corner"></span><div class="wrap chead__in">
        ${crumbs(cat ? [['Accueil', '/'], ['Catalogue', '/catalogue'], subName ? [c.name, '/catalogue/' + cat] : [c.name], ...(subName ? [[subName]] : [])] : [['Accueil', '/'], ['Catalogue']])}
        <h1 class="h2">${ss ? esc(ss.h1) : cat ? c.name : 'Catalogue'}</h1>
        <p class="lead">${ss ? esc(ss.intro) : cat ? c.text : 'Des références sélectionnées pour les besoins professionnels.'}</p>
        <div class="chead__search">${sbar()}</div>
        <nav class="fams" aria-label="Familles">
          <a class="fam ${!cat ? 'is-on' : ''}" href="/catalogue">Toutes <small>${P.length}</small></a>
          ${D.categories.map(k => `<a class="fam ${cat === k.id ? 'is-on' : ''}" href="/catalogue/${k.id}">${k.name} <small>${count(k.id)}</small></a>`).join('')}
        </nav>
      </div></header>
      <div class="ctool"><div class="wrap">
        <div class="ctool__in">
          <div class="subs" role="group" aria-label="Sous-catégories">${subs.length > 1 ? (cat ? `<a class="chip ${subName ? '' : 'is-on'}" href="/catalogue/${cat}">Tout</a>` + subs.map(s => `<a class="chip ${subName === s ? 'is-on' : ''}" href="${subUrl(cat, s)}">${esc(s)}</a>`).join('') : `<button class="chip ${F.sub.length ? '' : 'is-on'}" data-sub="">Tout</button>` + subs.map(s => `<button class="chip ${F.sub.includes(s) ? 'is-on' : ''}" data-sub="${esc(s)}">${esc(s)}</button>`).join('')) : ''}</div>
          <div class="ctool__r">
            <span class="ctool__count" id="cCount"></span>
            <select class="sel" id="sortSel" aria-label="Trier"><option value="pert">Pertinence</option><option value="az">Nom A → Z</option><option value="brand">Marque</option><option value="ref">Référence</option></select>
            <button class="btn btn--navy btn--sm fbtn" data-open-filter>${icon('i-filter')} Filtrer <span class="n" id="fN" hidden></span></button>
          </div>
        </div>
        <div class="activef" id="activeF"></div>
      </div></div>
      <section class="cbody"><div class="wrap">
        <div id="spot"></div>
        <div class="grid" id="cGrid">${skel(8)}</div>
        <div class="help rv"><div><b>Vous ne trouvez pas exactement ce qu’il vous faut ?</b><p>Notre catalogue en ligne n’est qu’une sélection. Décrivez votre besoin : nous sourçons pour vous.</p></div>
          <div class="row"><a href="/devis" class="btn btn--navy">Décrire mon besoin</a><a class="btn btn--wa" data-wa="home">${icon('i-wa')} WhatsApp</a></div></div>
        ${ss && ss.faq ? `<section class="faq subfaq"><h2 class="h3">Questions fréquentes</h2><div class="faq__list">${ss.faq.map(([q, a], i) => `<details class="faq__it"${i ? '' : ' open'}><summary><h3>${esc(q)}</h3>${icon('i-plus')}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>` : ''}
        ${cat ? `<nav class="seelinks" aria-label="Voir aussi"><b>Voir aussi</b>${D.categories.flatMap(k => [...new Set(P.filter(p => p.category === k.id).map(p => p.subcategory))].filter(x => !(k.id === cat && x === subName)).map(x => `<a href="${subUrl(k.id, x)}">${esc((D.seoSubs[k.id + '/' + sslug(x)] || {}).h1 || x)}</a>`)).join('')}${Object.entries(D.techPages).map(([k, t]) => `<a href="/personnalisation/${k}">${esc(t.h1)}</a>`).join('')}${guideLink(GUIDE_FOR[cat])}</nav>` : ''}
      </div></section>
    </div>`;
    $('#sortSel').value = sortBy;
    $('#sortSel').onchange = e => { sortBy = e.target.value; renderGrid(); };
    $$('[data-sub]').forEach(b => b.onclick = () => { const s = b.dataset.sub; F.sub = s ? (F.sub.includes(s) ? F.sub.filter(x => x !== s) : [s]) : []; $$('[data-sub]').forEach(x => x.classList.toggle('is-on', x.dataset.sub ? F.sub.includes(x.dataset.sub) : !F.sub.length)); renderGrid(); });
    setTimeout(renderGrid, 260); // skeleton, puis rendu
    typer();
  }
  function renderGrid() {
    const g = $('#cGrid'); if (!g) return;
    const r = filtered(curCat);
    // Vitrine « Références phares » (masquée dès qu'un filtre est actif)
    const spot = $('#spot'), cc = catById(curCat);
    const feats = (cc ? cc.feature : D.heroProducts).map(bySlug).filter(Boolean).slice(0, 3);
    if (spot) spot.innerHTML = (nFilters() || F.q || !feats.length) ? '' : `
      <div class="spot">
        <div class="spot__hd"><span class="eyebrow">Références phares</span><h2 class="h3">${cc ? 'Le meilleur de la gamme ' + esc(cc.name.toLowerCase()) : 'Nos best-sellers, prêts à personnaliser'}</h2></div>
        <div class="spot__grid">${feats.map((p, k) => `
          <article class="sp ${k ? '' : 'sp--main'}">
            ${k ? '' : `<div class="sp__bg"><img src="${cc ? (cc.spotImg || cc.img) : '/assets/img/pro/hero.webp'}" alt="" loading="lazy"></div>`}
            <a class="sp__img ${!k && p.cutout ? 'is-cut' : ''}" href="/produit/${p.slug}"><img src="${!k && p.cutout ? p.cutout : p.images[0]}" alt="${esc(p.name)}" loading="lazy"></a>
            <div class="sp__txt">
              <div class="row">${avail(p)}${p.badge ? `<span class="badge badge--y">${esc(p.badge)}</span>` : ''}</div>
              <small>${esc(p.brand || catById(p.category).short)}${p.reference ? ' · Réf. ' + esc(p.reference) : ''}</small>
              <h3><a href="/produit/${p.slug}">${esc(p.name)}</a></h3>
              ${k ? '' : `<ul class="pc__specs">${specsOf(p).map(s => `<li>${esc(s)}</li>`).join('')}</ul>`}
              <div class="row"><a class="btn ${k ? 'btn--light btn--xs' : 'btn--primary btn--sm'}" href="/produit/${p.slug}">Voir la référence ${icon('i-arrow')}</a><button class="btn ${k ? 'btn--navy btn--xs' : 'btn--ghost-inv btn--sm'}" data-add="${p.slug}">${icon('i-plus')} Ma demande</button></div>
            </div>
          </article>`).join('')}</div>
      </div>`;
    // regroupement par sous-catégorie seulement s'il reste assez de références par groupe
    const nSubs = new Set(r.map(p => p.category + '|' + p.subcategory)).size;
    const grouped = r.length && !nFilters() && !F.q && sortBy === 'pert' && r.length / nSubs >= 2.5;
    g.className = grouped ? 'cgroups' : 'grid';
    if (grouped) {
      const subs = [...new Set(r.map(p => p.category + '|' + p.subcategory))];
      g.innerHTML = subs.map(k => {
        const [c, s] = k.split('|'), items = r.filter(p => p.category === c && p.subcategory === s);
        return `<section class="cgroup"><header class="cgroup__hd"><h2><a href="${subUrl(c, s)}">${esc(s)}</a></h2><span>${items.length} référence${items.length > 1 ? 's' : ''}</span>${curCat ? '' : `<a href="/catalogue/${c}">${esc(catById(c).name)} ${icon('i-arrow')}</a>`}</header><div class="grid">${items.map(card).join('')}</div></section>`;
      }).join('');
    } else
    g.innerHTML = r.length ? r.map(card).join('') : `<div class="empty" style="grid-column:1/-1"><h3>Aucune référence ne correspond</h3><p>Modifiez vos filtres, ou décrivez-nous votre besoin : nous trouverons le produit adapté.</p><div class="row"><button class="btn btn--ghost" data-reset>Réinitialiser les filtres</button><a class="btn btn--primary" href="/devis">Décrire mon besoin</a></div></div>`;
    $('#cCount').innerHTML = `<b>${r.length}</b> référence${r.length > 1 ? 's' : ''}`;
    const n = nFilters(); const fn = $('#fN'); fn.hidden = !n; fn.textContent = n;
    const chips = [
      ...(F.q ? [['q', F.q, `« ${F.q} »`]] : []),
      ...F.brand.map(v => ['brand', v, v]), ...F.avail.map(v => ['avail', v, v]), ...F.tech.map(v => ['tech', v, v]),
      ...F.weight.map(v => ['weight', v, WEIGHTS[v][0]]), ...(F.sub.length && !$('[data-sub]') ? F.sub.map(v => ['sub', v, v]) : []),
    ];
    $('#activeF').innerHTML = chips.length ? chips.map(([k, v, l]) => `<button class="chip chip--rm" data-rmf="${k}" data-v="${esc(v)}">${esc(l)} ${icon('i-x')}</button>`).join('') + `<button class="chip" data-reset>Tout effacer</button>` : '';
    $$('[data-rmf]').forEach(b => b.onclick = () => { const k = b.dataset.rmf, v = b.dataset.v; if (k === 'q') F.q = ''; else F[k] = F[k].filter(x => String(x) !== v); renderGrid(); });
    $$('[data-reset]').forEach(b => b.onclick = resetFilters);
    reveal(); refreshWa();
  }
  function resetFilters() { Object.assign(F, { brand: [], sub: [], avail: [], tech: [], weight: [], q: '' }); $$('[data-sub]').forEach(x => x.classList.toggle('is-on', !x.dataset.sub)); renderGrid(); if ($('#filterDrawer').classList.contains('is-open')) renderFilters(); }
  function renderFilters() {
    const base = P.filter(p => !curCat || p.category === curCat);
    const cnt = (fn) => base.filter(fn).length;
    const grp = (title, key, opts, open = true) => `<div class="fgroup ${open ? '' : 'is-closed'}"><button type="button" aria-expanded="${open}">${title}${icon('i-chev-d')}</button><div class="fopts">${opts.map(([v, l, n]) => `<label class="chk"><input type="checkbox" data-f="${key}" value="${esc(v)}" ${F[key].map(String).includes(String(v)) ? 'checked' : ''}>${esc(l)}<small>${n}</small></label>`).join('')}</div></div>`;
    const brands = [...new Set(base.map(p => p.brand).filter(Boolean))].sort();
    const subs = [...new Set(base.map(p => p.subcategory))];
    $('#filterBody').innerHTML =
      (!curCat ? `<div class="fgroup"><button type="button">Famille${icon('i-chev-d')}</button><div class="fopts">${D.categories.map(c => `<a class="chk" href="/catalogue/${c.id}">${c.name}<small>${count(c.id)}</small></a>`).join('')}</div></div>` : '') +
      grp('Sous-catégorie', 'sub', subs.map(s => [s, s, cnt(p => p.subcategory === s)])) +
      grp('Marque', 'brand', brands.map(b => [b, b, cnt(p => p.brand === b)])) +
      grp('Disponibilité', 'avail', ['Disponible', 'Sur commande'].map(a => [a, a, cnt(p => p.availability === a)]).filter(x => x[2])) +
      `<small class="lbl" style="margin-top:22px">Filtres avancés</small>` +
      grp('Personnalisation possible', 'tech', ['Broderie', 'Sérigraphie', 'DTF', 'Transfert'].map(t => [t, t, cnt(p => (p.techniques || []).includes(t))]), false) +
      grp('Grammage', 'weight', WEIGHTS.map((w, i) => [i, w[0], cnt(p => { const x = wOf(p); return x >= w[1] && x <= w[2]; })]).filter(x => x[2]), false);
    const upd = () => { const n = filtered(curCat).length; $('#filterFoot').innerHTML = `<button class="btn btn--primary btn--block" data-close>Afficher ${n} résultat${n > 1 ? 's' : ''}</button><button class="btn btn--light btn--block btn--sm" id="fReset">Réinitialiser</button>`; $('#fReset').onclick = resetFilters; };
    $$('#filterBody .fgroup > button').forEach(b => b.onclick = () => { const g = b.parentElement; g.classList.toggle('is-closed'); b.setAttribute('aria-expanded', !g.classList.contains('is-closed')); });
    $$('#filterBody [data-f]').forEach(i => i.onchange = () => {
      const k = i.dataset.f, v = k === 'weight' ? +i.value : i.value;
      F[k] = i.checked ? [...F[k], v] : F[k].filter(x => x !== v);
      if (k === 'sub') $$('[data-sub]').forEach(x => x.classList.toggle('is-on', x.dataset.sub ? F.sub.includes(x.dataset.sub) : !F.sub.length));
      renderGrid(); upd();
    });
    $$('#filterBody a.chk').forEach(a => a.addEventListener('click', closeAll));
    upd();
  }

  /* ---------- Product ---------- */
  let nudgeT;
  function viewProduct(slug) {
    const p = bySlug(slug); if (!p) return view404();
    const c = catById(p.category);
    const usages = D.usages[p.subcategory] || [];
    const techAll = D.techniques;
    const similar = P.filter(x => x.slug !== p.slug && x.subcategory === p.subcategory).concat(P.filter(x => x.slug !== p.slug && x.category === p.category && x.subcategory !== p.subcategory)).slice(0, 4);
    const inQ = store.get().items.find(i => i.slug === p.slug);
    const specRows = [
      ['Référence', p.reference], ['Marque', p.brand], ['Famille', c.name], ['Catégorie', p.subcategory], ['Grammage', p.weight],
      ['Coloris', p.colors && p.colors.length ? p.colors.length + ' coloris disponibles' : ''], ['Tailles', p.sizes && p.sizes.length ? p.sizes.join(' · ') : ''],
      ['Genre', p.gender && p.gender.length ? p.gender.join(' · ') : ''], ['Zones de marquage', (p.zones || []).join(' · ')], ['Disponibilité', p.availability],
    ].filter(r => r[1]);
    const keyspecs = specsOf(p).concat(p.specs || []).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
    waContext = waProduct(p);
    app.innerHTML = `<div class="page"><section class="pp"><div class="wrap">
      ${crumbs([['Catalogue', '/catalogue'], [c.name, '/catalogue/' + c.id], [p.subcategory, subUrl(c.id, p.subcategory)], [p.name]])}
      <div class="pp__grid">
        <div class="gal">
          <div class="gal__thumbs" id="galThumbs"></div>
          <div class="gal__main" id="galMain"><span class="corner"></span><div class="gal__track" id="galTrack"></div>
            <button class="gal__nav gal__prev" type="button" aria-label="Photo précédente">${icon('i-chev-l')}</button><button class="gal__nav gal__next" type="button" aria-label="Photo suivante">${icon('i-chev-r')}</button>
            <div class="gal__dots" id="galDots"></div></div>
        </div>
        <div class="pinfo">
          <div class="row">${avail(p)}${p.badge ? `<span class="badge badge--y">${esc(p.badge)}</span>` : ''}</div>
          <h1>${esc(p.name)}</h1>
          <div class="pinfo__meta">${p.reference ? `<span>Réf. <b>${esc(p.reference)}</b></span><i class="sep"></i>` : ''}${p.brand ? `<span><b>${esc(p.brand)}</b></span><i class="sep"></i>` : ''}<span>${esc(p.subcategory)}</span></div>
          ${p.description ? `<p class="pinfo__desc">${esc(p.description)}</p>` : ''}
          ${keyspecs.length ? `<div class="keyspecs">${keyspecs.map((s, i) => `<div>${icon(['i-layers', 'i-box', 'i-shield', 'i-check'][i])}<span>${esc(s)}</span></div>`).join('')}</div>` : ''}
          ${p.variants && p.variants.length ? `<div class="blk"><div class="blk__hd">Coloris : <b id="swName">${esc(p.variants[defVar(p)].n)}</b> <small>${p.variants.length} coloris · cliquez pour voir les photos</small></div><div class="sws sws--img">${p.variants.map((v, i) => `<button type="button" class="sw sw--img${i === defVar(p) ? ' is-on' : ''}" style="background-image:url('${v.sw}');background-color:${swatch(v.hex || v.n)}" title="${esc(v.n)}" aria-label="Coloris ${esc(v.n)}" aria-pressed="${i === defVar(p)}" data-var="${i}"></button>`).join('')}</div></div>`
            : p.colors && p.colors.length ? `<div class="blk"><div class="blk__hd">Coloris disponibles <small id="swName">${p.colors.length} coloris</small></div><div class="sws">${p.colors.slice(0, 24).map(col => `<button class="sw" style="background:${swatch(col)}" title="${esc(col)}" aria-label="${esc(col)}" data-sw="${esc(col)}"></button>`).join('')}${p.colors.length > 24 ? `<span class="sw__more">+${p.colors.length - 24}</span>` : ''}</div></div>` : ''}
          ${p.sizes && p.sizes.length ? `<div class="blk"><div class="blk__hd">Tailles <small>à préciser dans votre demande</small></div><div class="sizes">${p.sizes.map(s => `<span>${esc(s)}</span>`).join('')}</div></div>` : ''}
          <div class="addbox">
            <div class="addbox__price"><span><b>Prix sur devis</b><br><small>Tarif dégressif selon quantité et marquage</small></span></div>
            <div class="addbox__row">
              <div class="qty qty--lg"><button type="button" data-step="-1" aria-label="Moins">${icon('i-minus')}</button><input id="pQty" type="number" min="1" value="${inQ ? inQ.qty : 50}" aria-label="Quantité souhaitée"><button type="button" data-step="1" aria-label="Plus">${icon('i-plus')}</button></div>
              <button class="btn btn--primary btn--lg" id="pAdd">${icon(inQ ? 'i-check' : 'i-plus')} ${inQ ? 'Mettre à jour ma demande' : 'Ajouter à ma demande'}</button>
            </div>
            <div class="presets"><small>Quantité souhaitée :</small>${[25, 50, 100, 250, 500, 1000].map(n => `<button type="button" data-preset="${n}">${n}</button>`).join('')}</div>
          </div>
          <div class="advice"><span class="advice__ic">${icon('i-wa')}</span><div><b>Vous ne savez pas quelle personnalisation choisir ?</b><p>Pas de problème, notre équipe vous conseille.</p></div><a class="btn btn--wa btn--sm" data-wa="p:${p.slug}">Parler à un conseiller</a></div>
        </div>
      </div>

      <div class="ptabs">
        <div class="ptabs__nav" role="tablist">${['Caractéristiques techniques', 'Personnalisation possible', 'Utilisations', 'Documents'].map((t, i) => `<button role="tab" class="${i ? '' : 'is-on'}" data-tab="${i}">${t}</button>`).join('')}</div>
        <div class="ptabs__pane is-on" data-pane="0"><div class="two">
          <table class="spec"><tbody>${specRows.map(r => `<tr><th>${r[0]}</th><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>
          <div>${(p.specs || []).length ? `<h3 class="h3" style="font-size:18px;margin-bottom:14px">Détails produit</h3><ul class="list">${p.specs.map(s => `<li>${icon('i-check')}<span>${esc(s)}</span></li>`).join('')}</ul>` : ''}</div>
        </div></div>
        <div class="ptabs__pane" data-pane="1">
          <p class="lead" style="margin-bottom:22px">Techniques compatibles avec ce produit. Vous n’avez rien à choisir maintenant : nous vous recommandons la meilleure option.</p>
          <div class="tcards">${techAll.map(t => { const ok = (p.techniques || []).includes(t.name); return `<div class="tcard ${ok ? '' : 'is-na'}"><div class="ic">${icon(t.icon)}</div><b>${t.name}</b><p>${ok ? t.text : 'Non recommandé pour ce produit'}</p></div>`; }).join('')}</div>
          ${(p.zones || []).length ? `<p style="margin-top:20px"><b>Zones de marquage :</b> ${p.zones.join(' · ')}</p>` : ''}
        </div>
        <div class="ptabs__pane" data-pane="2">${usages.length ? `<div class="tcards">${usages.map(u => `<div class="tcard"><div class="ic">${icon('i-target')}</div><b>${u}</b></div>`).join('')}</div>` : '<p class="muted">Contactez-nous pour valider l’usage adapté à votre activité.</p>'}</div>
        <div class="ptabs__pane" data-pane="3"><div class="advice" style="max-width:640px"><span class="advice__ic" style="background:var(--cream);color:var(--navy)">${icon('i-doc')}</span><div><b>Fiche technique</b><p>Disponible sur simple demande, envoyée avec votre devis.</p></div><a class="btn btn--navy btn--sm" data-wa="p:${p.slug}">Recevoir la fiche</a></div></div>
      </div>

      ${similar.length ? `<div style="margin-top:80px"><div class="sec-hd"><div><span class="eyebrow">Dans la même gamme</span><h2 class="h2" style="font-size:clamp(26px,3vw,38px)">Produits similaires</h2></div><a class="btn btn--ghost btn--sm" href="/catalogue/${c.id}">Voir la gamme ${icon('i-arrow')}</a></div><div class="grid">${similar.map(card).join('')}</div></div>` : ''}
    </div></section>
    <div class="mstick" id="mstick"><button class="btn btn--primary" id="mAdd">${icon('i-plus')} Ajouter à ma demande</button><a class="btn btn--wa" data-wa="p:${p.slug}" aria-label="WhatsApp">${icon('i-wa')}</a></div>
    ${fcta()}</div>`;
    // Galerie : bande défilante (glisser au doigt sur mobile, vignettes et flèches sur PC)
    const main = $('#galMain'), track = $('#galTrack'), thumbs = $('#galThumbs'), dots = $('#galDots');
    const dv = defVar(p);
    let gal = dv >= 0 ? { imgs: p.variants[dv].imgs, full: p.variants[dv].full || [] } : { imgs: p.images, full: p.full || [] }, cur = 0, selColor = dv >= 0 ? p.variants[dv].n : '';
    const renderGal = () => {
      track.innerHTML = gal.imgs.map((s, i) => `<img class="${gal.full.includes(i) ? 'is-full' : ''}" src="${s}" alt="${esc(p.name)}${selColor ? ' — ' + esc(selColor) : ''}" ${i ? 'loading="lazy"' : ''} draggable="false">`).join('');
      thumbs.innerHTML = gal.imgs.map((s, i) => `<button type="button" class="${i ? '' : 'is-on'}" data-img="${i}" aria-label="Photo ${i + 1}"><img src="${s}" alt="" loading="lazy"></button>`).join('');
      dots.innerHTML = gal.imgs.length > 1 ? gal.imgs.map((_, i) => `<i class="${i ? '' : 'is-on'}"></i>`).join('') : '';
      main.classList.toggle('is-single', gal.imgs.length < 2);
      track.scrollLeft = 0; cur = 0;
      $$('[data-img]', thumbs).forEach(b => b.onclick = () => go(+b.dataset.img));
    };
    const mark = i => { cur = i; $$('[data-img]', thumbs).forEach((b, k) => b.classList.toggle('is-on', k === i)); $$('i', dots).forEach((d, k) => d.classList.toggle('is-on', k === i)); };
    const go = i => { i = Math.max(0, Math.min(gal.imgs.length - 1, i)); track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }); mark(i); };
    let st; const sync = d => { clearTimeout(st); st = setTimeout(() => mark(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))), d); };
    track.addEventListener('scroll', () => sync(60), { passive: true });
    track.addEventListener('scrollend', () => sync(0), { passive: true });
    track.addEventListener('touchend', () => sync(380), { passive: true });
    main.querySelector('.gal__prev').onclick = () => go(cur - 1);
    main.querySelector('.gal__next').onclick = () => go(cur + 1);
    renderGal();
    // Coloris : un clic affiche les photos de la couleur choisie
    $$('[data-var]').forEach(b => b.onclick = () => {
      const v = p.variants[+b.dataset.var];
      $$('[data-var]').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', x === b); });
      selColor = v.n; $('#swName').textContent = v.n;
      gal = { imgs: v.imgs, full: v.full || [] }; renderGal();
    });
    $$('[data-sw]').forEach(b => b.onclick = () => { $$('[data-sw]').forEach(x => x.classList.toggle('is-on', x === b)); selColor = b.dataset.sw; $('#swName').textContent = b.dataset.sw; });
    // qty
    const q = $('#pQty');
    $$('[data-step]').forEach(b => b.onclick = () => { q.value = Math.max(1, (+q.value || 0) + (+b.dataset.step) * (+q.value >= 100 ? 10 : 5)); syncPreset(); });
    const syncPreset = () => $$('[data-preset]').forEach(b => b.classList.toggle('is-on', +b.dataset.preset === +q.value));
    $$('[data-preset]').forEach(b => b.onclick = () => { q.value = b.dataset.preset; syncPreset(); }); q.oninput = syncPreset; syncPreset();
    const doAdd = () => {
      const qty = Math.max(1, +q.value || 1);
      if (store.has(p.slug)) { store.set(p.slug, qty); store.setColor(p.slug, selColor); toast(`Quantité mise à jour : ${qty}${selColor ? ' · ' + esc(selColor) : ''}`, { label: 'Voir ma demande', fn: () => openDrawer('quote') }); }
      else addToQuote(p.slug, qty, track.children[cur], selColor);
      $('#pAdd').innerHTML = `${icon('i-check')} Mettre à jour ma demande`;
    };
    $('#pAdd').onclick = doAdd; $('#mAdd').onclick = doAdd;
    // tabs
    $$('[data-tab]').forEach(b => b.onclick = () => { $$('[data-tab]').forEach(x => x.classList.toggle('is-on', x === b)); $$('[data-pane]').forEach(x => x.classList.toggle('is-on', x.dataset.pane === b.dataset.tab)); });
    // mobile sticky
    const ms = $('#mstick'); document.body.classList.add('has-mstick');
    const addBtn = $('#pAdd');
    const mio = new IntersectionObserver(([en]) => ms.classList.toggle('is-on', !en.isIntersecting && en.boundingClientRect.top < 0)); mio.observe(addBtn);
    // WhatsApp nudge once
    clearTimeout(nudgeT);
    if (!sessionStorage.getItem('waNudged')) nudgeT = setTimeout(() => { if (location.pathname.includes(slug)) { const w = $('#waf'); w.classList.add('nudge'); try { sessionStorage.setItem('waNudged', 1); } catch (e) { } setTimeout(() => w.classList.remove('nudge'), 3500); } }, 12000);
  }

  /* ---------- Solutions ---------- */
  function viewSolutions() {
    app.innerHTML = `<div class="page page--flush">
      <header class="phero"><span class="corner"></span><div class="phero__img"><img src="/assets/img/pro/scaffold.webp" alt=""></div><div class="wrap">
        ${crumbs([['Accueil', '/'], ['Solutions']])}
        <h1 class="h1" style="margin-top:20px;font-size:clamp(40px,5.5vw,76px)">Solutions<br>par <span class="y">métier.</span></h1>
        <p class="lead">Chaque secteur a ses contraintes. Nous avons sélectionné les produits qui y répondent.</p>
      </div></header>
      <section class="sec"><div class="wrap"><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
        ${D.sectors.map((s, i) => `<a class="sector rv" style="--d:${i % 4}" href="/solutions/${s.slug}"><img src="${s.img}" alt="" loading="lazy"><span class="sector__n">0${i + 1}</span><h3>${s.name}</h3><p>${s.intro}</p><span class="cat__go"><i>${icon('i-arrow')}</i>Voir la sélection</span></a>`).join('')}
      </div></div></section>
      <section class="sec sec--gray"><div class="wrap"><div class="sec-hd"><div><span class="eyebrow">Besoin d’aide pour choisir ?</span><h2 class="h2">Décrivez votre situation,<br><span class="y">on s’occupe du reste.</span></h2></div></div>
        <div class="needs__list" style="max-width:760px">${D.needs.map((n, i) => `<a class="need rv" style="--d:${i}" href="${n.to}"><span class="need__n">0${i + 1}</span><span class="need__q">${n.q}<span class="need__a">→ ${n.a}</span></span>${icon('i-arrow')}</a>`).join('')}</div>
      </div></section>${fcta()}</div>`;
  }
  function viewSolution(slug) {
    const s = D.sectors.find(x => x.slug === slug); if (!s) return view404();
    const prods = s.filter.flatMap(f => { const [c, sub] = f.split(':'); return P.filter(p => p.category === c && (!sub || p.subcategory === sub)); }).filter((p, i, a) => a.indexOf(p) === i).slice(0, 8);
    app.innerHTML = `<div class="page page--flush">
      <header class="phero"><span class="corner"></span><div class="phero__img"><img src="${s.img}" alt=""></div><div class="wrap">
        ${crumbs([['Accueil', '/'], ['Solutions', '/solutions'], [s.name]])}
        <h1 class="h1" style="margin-top:20px;font-size:clamp(38px,5vw,70px)">${s.name}</h1>
        <p class="lead">${s.intro}</p>
        <div class="row" style="margin-top:28px"><a href="/devis" class="btn btn--primary btn--lg">Demander un devis ${icon('i-arrow')}</a><a class="btn btn--ghost-inv btn--lg" data-wa="home">${icon('i-wa')} WhatsApp</a></div>
      </div></header>
      <section class="sec sec--tight"><div class="wrap"><div class="two">
        <div><span class="eyebrow">Vos besoins typiques</span><h2 class="h2" style="font-size:clamp(26px,3vw,38px)">Ce que nous fournissons<br>à ce secteur</h2></div>
        <ul class="list">${s.needs.map(n => `<li class="rv">${icon('i-check')}<span style="font-size:17px;font-weight:600">${n}</span></li>`).join('')}</ul>
      </div></div></section>
      <section class="sec sec--gray"><div class="wrap"><div class="sec-hd"><div><span class="eyebrow">Sélection recommandée</span><h2 class="h2" style="font-size:clamp(26px,3vw,38px)">Produits adaptés</h2></div><a href="/catalogue" class="btn btn--ghost btn--sm">Tout le catalogue ${icon('i-arrow')}</a></div>
        <div class="grid">${prods.map(card).join('')}</div></div></section>
      ${fcta()}</div>`;
  }

  /* ---------- Personnalisation ---------- */
  function viewPerso() {
    app.innerHTML = `<div class="page page--flush">
      <header class="phero"><span class="corner"></span><div class="phero__img"><img src="/assets/img/pro/print.webp" alt=""></div><div class="wrap">
        ${crumbs([['Accueil', '/'], ['Personnalisation']])}
        <h1 class="h1" style="margin-top:20px;font-size:clamp(40px,5.5vw,76px)">Personnalisez<br>votre <span class="y">projet.</span></h1>
        <p class="lead">Nous adaptons la technique de marquage à votre produit, votre quantité et votre besoin. Vous n’avez rien à choisir : c’est notre métier.</p>
      </div></header>
      <section class="sec sec--navy"><div class="wrap">
        <div class="techs">${D.techniques.map((t, i) => `<a class="tech rv" style="--d:${i}" href="/personnalisation/${t.id}"><span class="tech__n">0${i + 1}</span><div class="tech__ic">${icon(t.icon)}</div><h3>${t.name}</h3><p>${t.text}</p><small>${t.best}</small><span class="tech__more">En savoir plus ${icon('i-arrow')}</span></a>`).join('')}</div>
        <div class="advbar rv"><div><b>Vous ne savez pas quelle technique utiliser ?</b><p>Nous vous recommandons la solution adaptée après analyse de votre projet.</p></div>
          <div class="row"><a href="/devis" class="btn btn--primary">Être conseillé</a><a class="btn btn--wa" data-wa="advice">${icon('i-wa')} WhatsApp</a></div></div>
      </div></section>
      <section class="sec"><div class="wrap"><div class="sec-hd"><div><span class="eyebrow">Exemples</span><h2 class="h2">Marquages réalisés</h2></div></div>
        <div class="masonry">${D.projects.filter(p => /Broderie|Sérigraphie|Impression|Haute/.test(p.solution)).map((p, i) => projTile(p, i, 'all')).join('')}</div></div></section>
      ${fcta()}</div>`;
  }

  function viewTech(slug) {
    const tp = D.techPages[slug]; if (!tp) return view404();
    const t = D.techniques.find(x => x.id === tp.id) || { name: tp.h1 };
    const prods = D.categories.flatMap(k => P.filter(p => p.category === k.id && (p.techniques || []).includes(t.name))).slice(0, 8);
    app.innerHTML = `<div class="page page--flush">
      <header class="phero"><span class="corner"></span><div class="phero__img"><img src="/assets/img/pro/print.webp" alt=""></div><div class="wrap">
        ${crumbs([['Accueil', '/'], ['Personnalisation', '/personnalisation'], [tp.h1]])}
        <h1 class="h1" style="margin-top:20px;font-size:clamp(38px,5vw,70px)">${esc(tp.h1)}</h1>
        <p class="lead">${esc(tp.intro)}</p>
        <div class="row" style="margin-top:26px"><a href="/devis" class="btn btn--primary btn--lg">Demander un devis ${icon('i-arrow')}</a><a class="btn btn--wa btn--lg" data-wa="advice">${icon('i-wa')} WhatsApp</a></div>
      </div></header>
      <section class="sec"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Les avantages</span><h2 class="h2">${esc(t.name)} : les points forts</h2></div></div>
        <ul class="tp-points">${tp.points.map(x => `<li>${icon('i-check')}<span>${esc(x)}</span></li>`).join('')}</ul>
        <div class="tp-links">${tp.links.map(([l, u]) => `<a class="chip" href="${u}">${esc(l)} ${icon('i-arrow')}</a>`).join('')}</div>
      </div></section>
      ${prods.length ? `<section class="sec sec--gray"><div class="wrap"><div class="sec-hd"><div><span class="eyebrow">Produits compatibles</span><h2 class="h2">Produits à personnaliser</h2></div><a href="/catalogue" class="btn btn--ghost btn--sm">Tout le catalogue ${icon('i-arrow')}</a></div><div class="grid">${prods.map(card).join('')}</div></div></section>` : ''}
      <section class="sec"><div class="wrap faq">
        <div class="sec-hd"><div><span class="eyebrow">Questions fréquentes</span><h2 class="h2">${esc(t.name)} : vos questions</h2></div></div>
        <div class="faq__list">${tp.faq.map(([q, a], i) => `<details class="faq__it"${i ? '' : ' open'}><summary><h3>${esc(q)}</h3>${icon('i-plus')}</summary><p>${esc(a)}</p></details>`).join('')}</div>
        <nav class="seelinks" aria-label="Autres techniques"><b>Autres techniques</b>${Object.entries(D.techPages).filter(([k]) => k !== slug).map(([k, x]) => `<a href="/personnalisation/${k}">${esc(x.h1)}</a>`).join('')}<a href="/personnalisation">Toutes les solutions de personnalisation</a>${guideLink('broderie-serigraphie-dtf-transfert-quelle-technique')}</nav>
      </div></section>
      ${fcta()}</div>`;
  }

  /* ---------- Guides & conseils ---------- */
  const GUIDE_FOR = { textile: 'choisir-t-shirt-personnalise-entreprise', goodies: 'goodies-cadeaux-entreprise-evenements', epi: 'equiper-equipes-vetements-travail-epi', workwear: 'equiper-equipes-vetements-travail-epi' };
  const guideLink = slug => { const g = D.guides.find(x => x.slug === slug); return g ? `<a href="/guides/${g.slug}">Guide : ${esc(g.h1)}</a>` : ''; };
  const guideCard = (g, i) => `<a class="gcard rv" style="--d:${i}" href="/guides/${g.slug}"><span class="gcard__img"><img src="${g.img}" alt="" loading="lazy"></span><span class="gcard__body"><small>Guide pratique</small><b>${esc(g.h1)}</b><span class="tech__more">Lire le guide ${icon('i-arrow')}</span></span></a>`;
  function viewGuides() {
    app.innerHTML = `<div class="page page--flush">
      <header class="phero"><span class="corner"></span><div class="phero__img"><img src="/assets/img/pro/tex.webp" alt=""></div><div class="wrap">
        ${crumbs([['Accueil', '/'], ['Guides & conseils']])}
        <h1 class="h1" style="margin-top:20px;font-size:clamp(38px,5vw,70px)">Guides & conseils</h1>
        <p class="lead">Nos conseils pour bien choisir vos textiles personnalisés, votre technique de marquage, vos vêtements de travail, vos EPI et vos goodies d’entreprise.</p>
      </div></header>
      <section class="sec"><div class="wrap"><div class="gcards">${D.guides.map(guideCard).join('')}</div></div></section>
      ${fcta()}</div>`;
  }
  function viewGuide(slug) {
    const g = D.guides.find(x => x.slug === slug); if (!g) return view404();
    app.innerHTML = `<div class="page page--flush">
      <header class="phero"><span class="corner"></span><div class="phero__img"><img src="${g.img}" alt=""></div><div class="wrap">
        ${crumbs([['Accueil', '/'], ['Guides & conseils', '/guides'], [g.h1]])}
        <h1 class="h1" style="margin-top:20px;font-size:clamp(32px,4.4vw,60px)">${esc(g.h1)}</h1>
        <p class="lead">${esc(g.intro)}</p>
      </div></header>
      <section class="sec"><div class="wrap"><article class="guide">
        <p class="guide__meta">Par l’équipe Corpotex · mis à jour le ${g.date.split('-').reverse().join('/')}</p>
        ${g.table ? `<div class="guide__tbl"><table><thead><tr>${g.table.head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${g.table.rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
        ${g.sections.map(s => `<section><h2 class="h3">${esc(s.h)}</h2>${(s.p || []).map(x => `<p>${esc(x)}</p>`).join('')}${s.list ? `<ul>${s.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section>`).join('')}
        <div class="advbar"><div><b>Besoin d’un conseil pour votre projet ?</b><p>Envoyez votre logo et vos quantités : devis gratuit sous 24H ouvrées.</p></div>
          <div class="row"><a href="/devis" class="btn btn--primary">Demander un devis</a><a class="btn btn--wa" data-wa="advice">${icon('i-wa')} WhatsApp</a></div></div>
        <nav class="seelinks" aria-label="Pour aller plus loin"><b>Pour aller plus loin</b>${g.links.map(([l, u]) => `<a href="${u}">${esc(l)}</a>`).join('')}</nav>
      </article></div></section>
      <section class="sec sec--gray"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Guides & conseils</span><h2 class="h2">À lire aussi</h2></div><a href="/guides" class="btn btn--ghost btn--sm">Tous les guides ${icon('i-arrow')}</a></div>
        <div class="gcards">${D.guides.filter(x => x !== g).map(guideCard).join('')}</div>
      </div></section>
      ${fcta()}</div>`;
  }

  /* ---------- Projets ---------- */
  function viewProjects(params) {
    const f = params.get('f') || '';
    const sols = [...new Set(D.projects.map(p => p.solution))];
    const list = D.projects.filter(p => !f || p.solution === f);
    app.innerHTML = `<div class="page page--flush">
      <header class="phero"><span class="corner"></span><div class="phero__img"><img src="/assets/img/proj/l59.webp" alt=""></div><div class="wrap">
        ${crumbs([['Accueil', '/'], ['Réalisations']])}
        <h1 class="h1" style="margin-top:20px;font-size:clamp(40px,5.5vw,76px)">Des projets concrets.<br><span class="y">Des solutions adaptées.</span></h1>
        <p class="lead">Quelques réalisations livrées à nos clients : workwear, haute visibilité, EPI, textile et goodies personnalisés.</p>
      </div></header>
      <section class="sec sec--tight"><div class="wrap">
        <div class="subs" style="margin-bottom:28px"><a class="chip ${f ? '' : 'is-on'}" href="/projets">Tout</a>${sols.map(s => `<a class="chip ${f === s ? 'is-on' : ''}" href="/projets?f=${encodeURIComponent(s)}">${s}</a>`).join('')}</div>
        <div class="masonry">${list.map((p, i) => projTile(p, i, 'all')).join('')}</div>
      </div></section>${fcta()}</div>`;
  }

  /* ---------- À propos / engagements ---------- */
  function viewAbout() {
    app.innerHTML = `<div class="page page--flush">
      <header class="phero"><span class="corner"></span><div class="phero__img"><img src="/assets/img/pro/weld.webp" alt=""></div><div class="wrap">
        ${crumbs([['Accueil', '/'], ['Nos engagements']])}
        <h1 class="h1" style="margin-top:20px;font-size:clamp(40px,5.5vw,76px)">Construire.<br>Innover. <span class="y">Propulser.</span></h1>
        <p class="lead">Corpotex accompagne les entreprises, institutions et organisations dans l’équipement et l’image de leurs équipes : du textile publicitaire aux EPI, de 10 à 10 000 pièces.</p>
      </div></header>
      <section class="sec"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">Nos valeurs</span><h2 class="h2">Pas simplement des produits.<br><span class="y">Des solutions pour vos projets.</span></h2></div></div>
        <div class="values">${D.values.map((v, i) => `<div class="val rv" style="--d:${i}">${icon(v.icon)}<h3>${v.name}</h3><p>${v.text}</p></div>`).join('')}</div>
      </div></section>
      <section class="sec sec--gray"><div class="wrap">
        <div class="sec-hd"><div><span class="eyebrow">En chiffres</span><h2 class="h2">Un catalogue qui grandit avec vous</h2></div></div>
        <div class="stats">
          <div class="rv"><span class="stat">${P.length}</span><small>références en ligne</small></div>
          <div class="rv" style="--d:1"><span class="stat">${new Set(P.map(p => p.brand).filter(Boolean)).size}</span><small>marques distribuées</small></div>
          <div class="rv" style="--d:2"><span class="stat">4</span><small>techniques de marquage</small></div>
          <div class="rv" style="--d:3"><span class="stat">24H</span><small>pour recevoir votre devis</small></div>
        </div>
      </div></section>
      <section class="sec"><div class="wrap"><div class="sec-hd"><div><span class="eyebrow">Notre méthode</span><h2 class="h2">Simple pour vous.<br><span class="y">Rigoureux chez nous.</span></h2></div></div>
        <div class="proc">${D.process.map((s, i) => `<div class="step rv" style="--d:${i}"><div class="step__n">${s.n}</div><h3>${s.t}</h3><p>${s.d}</p></div>`).join('')}</div></div></section>
      ${fcta()}</div>`;
  }

  /* ---------- Contact ---------- */
  function viewContact() {
    app.innerHTML = `<div class="page"><section class="sec"><div class="wrap">
      ${crumbs([['Accueil', '/'], ['Contact']])}
      <div class="contact-grid" style="margin-top:28px">
        <div>
          <span class="eyebrow">Contact</span><h1 class="h2">Parlons de<br>votre <span class="y">projet.</span></h1>
          <p class="lead" style="margin:16px 0 30px">Un conseiller vous répond et vous oriente vers la solution la plus adaptée.</p>
          <div style="display:grid;gap:12px">
            <a class="cway" data-wa="home"><span class="cway__ic" style="background:#e8f7ee;color:var(--wa-2)">${icon('i-wa')}</span><span><b>WhatsApp</b><small>La réponse la plus rapide</small></span>${icon('i-arrow', 'go')}</a>
            <a class="cway" href="tel:${C.phoneRaw}"><span class="cway__ic">${icon('i-phone')}</span><span><b>${C.phone}</b><small>Appelez un conseiller</small></span></a>
            <a class="cway" href="mailto:${C.email}"><span class="cway__ic">${icon('i-mail')}</span><span><b>${C.email}</b><small>Écrivez-nous</small></span></a>
            <a class="cway" href="${C.instagram}" target="_blank" rel="noopener"><span class="cway__ic">${icon('i-insta')}</span><span><b>@corpotexmaroc</b><small>Nos réalisations sur Instagram</small></span>${icon('i-arrow', 'go')}</a>
            <a class="cway" href="${C.review}" target="_blank" rel="noopener"><span class="cway__ic" style="background:#fff6d6;color:#9a7400">${icon('i-star')}</span><span><b>Laissez-nous un avis Google</b><small>Déjà client ? Votre retour aide d’autres entreprises à nous choisir</small></span>${icon('i-arrow', 'go')}</a>
          </div>
        </div>
        <form class="card" id="contactForm" novalidate>
          <h2>Envoyer un message</h2><p class="muted">Pour une demande de prix, préférez le <a href="/devis" class="link">formulaire de devis</a>.</p>
          <div class="fgrid">
            <label class="field"><span>Entreprise *</span><input class="inp" name="company" required autocomplete="organization"></label>
            <label class="field"><span>Nom & prénom *</span><input class="inp" name="contactName" required autocomplete="name"></label>
            <label class="field"><span>Téléphone *</span><input class="inp" name="phone" type="tel" required autocomplete="tel"></label>
            <label class="field"><span>Email *</span><input class="inp" name="email" type="email" required autocomplete="email"></label>
            <label class="field full"><span>Message *</span><textarea class="inp" name="message" required placeholder="Comment pouvons-nous vous aider ?"></textarea></label>
          </div>
          <div class="formnav"><span class="note">${icon('i-check')}${C.responseTime}</span><button class="btn btn--primary" type="submit">Envoyer ${icon('i-arrow')}</button></div>
        </form>
      </div></div></section></div>`;
    $('#contactForm').onsubmit = async e => {
      e.preventDefault(); const f = e.target; if (!validate(f)) return;
      const data = Object.fromEntries(new FormData(f)); data.type = 'contact'; data.source = location.href;
      await send(data, [], f.querySelector('[type=submit]'));
    };
  }

  /* ---------- Devis (3 étapes) ---------- */
  const QF = { step: 1, company: '', contactName: '', phone: '', email: '', city: '', files: [], consent: false };
  function viewQuote(params) {
    if (params.get('step')) QF.step = +params.get('step');
    const s = store.get();
    const steps = ['Votre besoin', 'Vos coordonnées', 'Récapitulatif'];
    app.innerHTML = `<div class="page page--flush"><section class="qp"><div class="wrap">
      ${crumbs([['Accueil', '/'], ['Demande de devis']])}
      <h1 class="h2" style="margin-top:18px">Demande de devis</h1>
      <p class="lead" style="margin-top:8px">Moins d’une minute. Aucune donnée technique obligatoire : nous vous conseillons.</p>
      <div class="stepper">${steps.map((t, i) => `<div class="${QF.step === i + 1 ? 'is-on' : QF.step > i + 1 ? 'is-done' : ''}"><i></i><span>${i + 1}. ${t}</span></div>`).join('')}</div>
      <div class="qp__grid">
        <form class="card" id="qForm" novalidate></form>
        <aside class="aside">
          <div class="card"><h3>Pourquoi passer par Corpotex ?</h3><div class="rassure">
            <div>${icon('i-clock')}<span><b>Réponse sous 24H ouvrées</b><small>Un devis clair et personnalisé.</small></span></div>
            <div>${icon('i-users')}<span><b>Un conseiller dédié</b><small>Produits, quantités, marquage : on vous guide.</small></span></div>
            <div>${icon('i-shield')}<span><b>Sans engagement</b><small>BAT validé par vous avant toute production.</small></span></div>
          </div></div>
          <div class="card" style="background:var(--navy);color:#fff"><h3>Besoin d’une réponse rapide ?</h3><p style="color:rgba(255,255,255,.7);font-size:14px;margin:6px 0 16px">Échangez directement avec un conseiller.</p><a class="btn btn--wa btn--block" data-wa="quote">${icon('i-wa')} WhatsApp</a><a class="btn btn--ghost-inv btn--block btn--sm" style="margin-top:8px" href="tel:${C.phoneRaw}">${icon('i-phone')} ${C.phone}</a></div>
        </aside>
      </div></div></section></div>`;
    renderQStep();
  }
  const lineName = p => esc(p.name) + (p.reference ? ` <small>· Réf. ${esc(p.reference)}</small>` : '');
  function renderQStep() {
    const f = $('#qForm'); if (!f) return;
    const s = store.get();
    $$('.stepper > div').forEach((d, i) => { d.className = QF.step === i + 1 ? 'is-on' : QF.step > i + 1 ? 'is-done' : ''; });
    if (QF.step === 1) {
      f.innerHTML = `<h2>1. Votre besoin</h2><p class="muted">${s.items.length ? 'Vérifiez les références et quantités souhaitées.' : 'Pas encore de référence ? Décrivez simplement votre besoin.'}</p>
        ${s.items.length ? `<div class="qlines">${s.items.map(it => { const p = bySlug(it.slug); return `<div class="qline"><img src="${p.images[0]}" alt=""><span><b>${esc(p.name)}</b><small>${p.reference ? 'Réf. ' + esc(p.reference) + ' · ' : ''}${esc(p.brand || p.subcategory)}${it.color ? ' · <span class="qcol">' + esc(it.color) + '</span>' : ''}</small></span>${qtyCtl(it)}<button type="button" class="rm" data-rm="${it.slug}" aria-label="Retirer">${icon('i-trash')}</button></div>`; }).join('')}<a class="qadd" href="/catalogue">${icon('i-plus')} Ajouter une référence</a></div>`
          : `<div class="quick" style="margin-top:18px">${['Polos', 'T-shirts', 'Sweats', 'Vêtements de travail', 'Haute visibilité', 'EPI', 'Tote bags', 'Casquettes'].map(t => `<label class="opt opt--y"><input type="checkbox" name="quick" value="${t}" ${(s.quick || []).includes(t) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
             <div class="fgrid"><label class="field"><span>Quantité estimée <em>(facultatif)</em></span><input class="inp" name="estQty" inputmode="numeric" placeholder="ex. 200" value="${esc(s.estQty || '')}"></label>
             <div class="field"><span>&nbsp;</span><a class="btn btn--ghost" href="/catalogue">${icon('i-grid')} Parcourir le catalogue</a></div></div>`}
        <div class="fgrid">
          <label class="field full"><span>Décrivez votre projet ${s.items.length ? '<em>(facultatif)</em>' : '*'}</span><textarea class="inp" name="message" ${s.items.length ? '' : 'required'} placeholder="ex. Besoin de 150 polos brodés pour notre équipe commerciale, logo poitrine.">${esc(s.message)}</textarea></label>
        </div>
        ${customBlock(s)}
        <div class="formnav"><span class="note">${icon('i-check')}Aucun engagement</span><button class="btn btn--primary" type="submit">Continuer ${icon('i-arrow')}</button></div>`;
      bindQtys(f, () => renderQStep());
      bindCustom(f);
      f.onsubmit = e => {
        e.preventDefault();
        const fd = new FormData(f);
        store.patch({ message: fd.get('message') || '', quick: fd.getAll('quick'), estQty: fd.get('estQty') || '' });
        if (!s.items.length && !store.get().message.trim() && !store.get().quick.length) { const t = f.querySelector('[name=message]'); t.classList.add('is-err'); t.focus(); toast('Décrivez votre besoin ou choisissez un type de produit'); return; }
        QF.step = 2; renderQStep(); scrollTo({ top: 0, behavior: 'smooth' });
      };
    } else if (QF.step === 2) {
      f.innerHTML = `<h2>2. Vos coordonnées</h2><p class="muted">Pour vous envoyer votre devis personnalisé.</p>
        <div class="fgrid">
          <label class="field"><span>Entreprise *</span><input class="inp" name="company" required autocomplete="organization" value="${esc(QF.company)}"></label>
          <label class="field"><span>Nom & prénom *</span><input class="inp" name="contactName" required autocomplete="name" value="${esc(QF.contactName)}"></label>
          <label class="field"><span>Téléphone *</span><input class="inp" name="phone" type="tel" required autocomplete="tel" placeholder="06 XX XX XX XX" value="${esc(QF.phone)}"></label>
          <label class="field"><span>Email *</span><input class="inp" name="email" type="email" required autocomplete="email" value="${esc(QF.email)}"></label>
          <label class="field"><span>Ville <em>(facultatif)</em></span><input class="inp" name="city" autocomplete="address-level2" value="${esc(QF.city)}"></label>
          <label class="field"><span>Date souhaitée <em>(facultatif)</em></span><input class="inp" name="date" type="date" value="${esc(store.get().date)}"></label>
        </div>
        <div class="formnav"><button type="button" class="btn btn--light" data-back>${icon('i-chev-l')} Retour</button><button class="btn btn--primary" type="submit">Voir le récapitulatif ${icon('i-arrow')}</button></div>`;
      f.querySelector('[data-back]').onclick = () => { saveContact(f); QF.step = 1; renderQStep(); };
      f.onsubmit = e => { e.preventDefault(); if (!validate(f)) return; saveContact(f); QF.step = 3; renderQStep(); scrollTo({ top: 0, behavior: 'smooth' }); };
    } else {
      const c = s.custom || {};
      f.innerHTML = `<h2>3. Récapitulatif</h2><p class="muted">Vérifiez votre demande avant l’envoi.</p>
        <div class="recap">
          <div class="recap__row"><span>Produits</span><div>${s.items.length ? `<ul>${s.items.map(it => { const p = bySlug(it.slug); return `<li><b>${it.qty} ×</b> ${lineName(p)}${it.color ? ' <small>· coloris ' + esc(it.color) + '</small>' : ''}</li>`; }).join('')}</ul>` : (s.quick || []).length ? esc(s.quick.join(', ')) + (s.estQty ? ` · ~${esc(s.estQty)} pièces` : '') : '<em class="muted">À définir avec un conseiller</em>'} <button type="button" class="recap__edit" data-go="1">Modifier</button></div></div>
          <div class="recap__row"><span>Votre projet</span><div>${s.message ? esc(s.message) : '<em class="muted">—</em>'}</div></div>
          <div class="recap__row"><span>Personnalisation</span><div>${esc(c.tech || 'Je ne sais pas')}${(c.zone || []).length ? ' · ' + esc(c.zone.join(', ')) : ''}${QF.files.length ? ` · ${QF.files.length} fichier(s)` : ''}</div></div>
          <div class="recap__row"><span>Coordonnées</span><div>${esc(QF.company)} · ${esc(QF.contactName)}<br>${esc(QF.phone)} · ${esc(QF.email)}${QF.city ? ' · ' + esc(QF.city) : ''} <button type="button" class="recap__edit" data-go="2">Modifier</button></div></div>
          ${s.date ? `<div class="recap__row"><span>Date souhaitée</span><div>${new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>` : ''}
        </div>
        <label class="consent"><input type="checkbox" name="consent" required ${QF.consent ? 'checked' : ''}> J’accepte d’être recontacté(e) par Corpotex au sujet de ma demande.</label>
        <div class="formnav"><button type="button" class="btn btn--light" data-go="2">${icon('i-chev-l')} Retour</button>
          <div style="text-align:right"><button class="btn btn--primary btn--lg" type="submit">Envoyer ma demande ${icon('i-arrow')}</button><p class="muted" style="font-size:13px;margin-top:8px">${C.responseTime}</p></div></div>`;
      $$('[data-go]', f).forEach(b => b.onclick = () => { QF.step = +b.dataset.go; renderQStep(); });
      f.onsubmit = async e => {
        e.preventDefault();
        const cons = f.querySelector('[name=consent]'); if (!cons.checked) { toast('Merci de cocher la case de consentement'); cons.focus(); return; }
        QF.consent = true;
        const payload = buildQuote();
        await send(payload, QF.files, f.querySelector('[type=submit]'), true);
      };
    }
    refreshWa();
  }
  function saveContact(f) { const d = Object.fromEntries(new FormData(f)); ['company', 'contactName', 'phone', 'email', 'city'].forEach(k => QF[k] = (d[k] || '').trim()); store.patch({ date: d.date || '' }); }
  function buildQuote() {
    const s = store.get();
    return {
      type: 'quote', company: QF.company, contactName: QF.contactName, phone: QF.phone, email: QF.email, city: QF.city,
      products: s.items.map(it => { const p = bySlug(it.slug); return { reference: p.reference, name: p.name + (it.color ? ' — coloris ' + it.color : ''), color: it.color || '', brand: p.brand, quantity: it.qty, url: location.origin + '/produit/' + p.slug }; }),
      quickNeeds: s.quick || [], estimatedQuantity: s.estQty || '', message: s.message, desiredDate: s.date,
      optionalCustomization: s.custom, attachments: QF.files.map(f => f.name), source: location.href, sentAt: new Date().toISOString(),
    };
  }
  const qtyCtl = it => `<div class="qty"><button type="button" data-qs="${it.slug}" data-d="-1" aria-label="Moins">${icon('i-minus')}</button><input type="number" min="1" value="${it.qty}" data-qi="${it.slug}" aria-label="Quantité"><button type="button" data-qs="${it.slug}" data-d="1" aria-label="Plus">${icon('i-plus')}</button></div>`;
  function bindQtys(root, onRm) {
    $$('[data-qs]', root).forEach(b => b.onclick = () => { const inp = root.querySelector(`[data-qi="${b.dataset.qs}"]`); const v = +inp.value || 0; const step = v >= 100 ? 10 : 5; inp.value = Math.max(1, v + step * +b.dataset.d); store.set(b.dataset.qs, +inp.value); updSummary(); });
    $$('[data-qi]', root).forEach(i => i.onchange = () => { store.set(i.dataset.qi, +i.value); i.value = Math.max(1, +i.value || 1); updSummary(); });
    $$('[data-rm]', root).forEach(b => b.onclick = () => { const p = bySlug(b.dataset.rm); store.rm(b.dataset.rm); toast(`Retiré · ${esc(p.name)}`, { label: 'Annuler', fn: () => store.add(p.slug, 50) }); onRm && onRm(); });
  }
  function customBlock(s) {
    const c = s.custom || { tech: 'Je ne sais pas', zone: [] };
    return `<details class="disc" ${c.tech !== 'Je ne sais pas' || (c.zone || []).length || QF.files.length ? 'open' : ''}>
      <summary><span>Vous avez déjà les détails de personnalisation ?<small>Facultatif — « Je ne sais pas » est parfaitement acceptable</small></span>${icon('i-chev-d')}</summary>
      <div class="disc__bd">
        <div class="field"><span>Technique souhaitée</span><div class="opts">${['Je ne sais pas', 'Broderie', 'Sérigraphie', 'DTF', 'Transfert', 'Autre'].map(t => `<label class="opt ${t === 'Je ne sais pas' ? 'opt--y' : ''}"><input type="radio" name="tech" value="${t}" ${c.tech === t ? 'checked' : ''}><span>${t === 'Je ne sais pas' ? 'Je ne sais pas / Conseillez-moi' : t}</span></label>`).join('')}</div></div>
        <div class="field"><span>Emplacement</span><div class="opts">${['Poitrine', 'Dos', 'Manche', 'Autre'].map(t => `<label class="opt"><input type="checkbox" name="zone" value="${t}" ${(c.zone || []).includes(t) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
        <div class="field"><span>Votre logo <em>(PNG, JPG, PDF, AI, EPS — 10 Mo max)</em></span>
          <label class="drop" id="drop"><input type="file" id="fileIn" multiple accept=".png,.jpg,.jpeg,.pdf,.ai,.eps,.svg"><span class="drop__ic">${icon('i-upload')}</span><span><b>Glissez votre fichier ici</b><small>ou cliquez pour parcourir</small></span></label>
          <div class="files" id="fileList"></div></div>
      </div></details>`;
  }
  function bindCustom(root) {
    const sync = () => { const fd = new FormData(root); store.patch({ custom: { tech: fd.get('tech') || 'Je ne sais pas', zone: fd.getAll('zone') } }); };
    $$('[name=tech],[name=zone]', root).forEach(i => i.onchange = sync);
    const fi = root.querySelector('#fileIn'), drop = root.querySelector('#drop');
    const list = () => { const l = root.querySelector('#fileList'); if (l) l.innerHTML = QF.files.map((f, i) => `<div class="file">${icon('i-doc')}<span>${esc(f.name)} <small class="muted">${(f.size / 1024 / 1024).toFixed(1)} Mo</small></span><button type="button" data-fx="${i}" aria-label="Retirer">${icon('i-x')}</button></div>`).join(''); $$('[data-fx]', root).forEach(b => b.onclick = () => { QF.files.splice(+b.dataset.fx, 1); list(); }); };
    if (fi) {
      fi.onchange = () => { [...fi.files].forEach(f => { if (f.size > 10 * 1024 * 1024) toast(`${esc(f.name)} dépasse 10 Mo`); else QF.files.push(f); }); fi.value = ''; list(); };
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, () => drop.classList.add('is-over')));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
    }
    list();
  }
  function validate(f) {
    let ok = true;
    $$('[required]', f).forEach(i => {
      const v = i.value.trim();
      let bad = !v;
      if (!bad && i.type === 'email') bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      if (!bad && i.type === 'tel') bad = v.replace(/\D/g, '').length < 9;
      i.classList.toggle('is-err', bad);
      const next = i.nextElementSibling; if (next && next.classList.contains('err')) next.remove();
      if (bad) { ok = false; i.insertAdjacentHTML('afterend', `<span class="err">${!v ? 'Champ obligatoire' : i.type === 'email' ? 'Email invalide' : 'Numéro invalide'}</span>`); }
    });
    const first = f.querySelector('.is-err'); if (first) first.focus();
    return ok;
  }
  async function send(data, files, btn, isQuote) {
    const label = btn.innerHTML; btn.disabled = true; btn.innerHTML = 'Envoi en cours…';
    let ok = false;
    try {
      const fd = new FormData(); fd.append('payload', JSON.stringify(data)); (files || []).forEach(f => fd.append('attachments[]', f));
      const r = await fetch(C.quoteEndpoint, { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      ok = r.ok && j.ok;
    } catch (e) { ok = false; }
    btn.disabled = false; btn.innerHTML = label;
    if (isQuote && ok) { store.clear(); QF.files = []; QF.step = 1; QF.consent = false; }
    viewDone(ok, data);
  }
  function mailBody(d) {
    const L = [];
    if (d.type === 'quote') {
      L.push('DEMANDE DE DEVIS — Corpotex', '');
      (d.products || []).forEach(p => L.push(`- ${p.quantity} x ${p.name}${p.reference ? ' (Réf. ' + p.reference + ')' : ''}`));
      if (d.quickNeeds && d.quickNeeds.length) L.push('Besoin : ' + d.quickNeeds.join(', ') + (d.estimatedQuantity ? ' — ~' + d.estimatedQuantity + ' pièces' : ''));
      L.push('', 'Projet : ' + (d.message || '—'), 'Personnalisation : ' + ((d.optionalCustomization || {}).tech || 'Je ne sais pas') + ' ' + (((d.optionalCustomization || {}).zone || []).join(', ')));
      if (d.desiredDate) L.push('Date souhaitée : ' + d.desiredDate);
    } else L.push('MESSAGE — Corpotex', '', d.message || '');
    L.push('', `${d.company} — ${d.contactName}`, `${d.phone} — ${d.email}${d.city ? ' — ' + d.city : ''}`);
    return L.join('\n');
  }
  function viewDone(ok, data) {
    const mail = `mailto:${C.email}?subject=${encodeURIComponent((data.type === 'quote' ? 'Demande de devis — ' : 'Contact — ') + (data.company || ''))}&body=${encodeURIComponent(mailBody(data))}`;
    app.innerHTML = ok ? `<div class="page page--flush"><div class="done">
        <div class="done__ic">${icon('i-check')}</div>
        <h1>Votre demande a bien été envoyée.</h1>
        <p>Notre équipe va l’étudier et vous recontactera. ${C.responseTime}</p>
        <div class="row"><a href="/catalogue" class="btn btn--primary btn--lg">Retourner au catalogue</a><a class="btn btn--wa btn--lg" data-wa="quote">${icon('i-wa')} Nous contacter sur WhatsApp</a></div>
        <div class="done__box"><b>Et maintenant ?</b>Un conseiller analyse vos produits, quantités et besoins de marquage, puis vous adresse un devis personnalisé par email.</div>
      </div></div>`
      : `<div class="page page--flush"><div class="done">
        <div class="done__ic" style="background:var(--yellow);color:var(--navy)">${icon('i-mail')}</div>
        <h1>Dernière étape : envoyez votre demande</h1>
        <p>L’envoi automatique n’est pas disponible pour le moment. Votre demande est prête : un clic suffit pour l’envoyer par email ou WhatsApp. Votre sélection est conservée.</p>
        <div class="row"><a href="${mail}" class="btn btn--primary btn--lg">${icon('i-mail')} Envoyer par email</a><a class="btn btn--wa btn--lg" href="${waUrl(mailBody(data))}" target="_blank" rel="noopener">${icon('i-wa')} Envoyer sur WhatsApp</a></div>
        <div class="done__box"><b>Destinataire</b>${C.email} · ${C.phone}</div>
      </div></div>`;
    refreshWa(); scrollTo(0, 0);
  }

  /* ---------- Quote drawer ---------- */
  function updSummary() {
    const s = store.get(), n = s.items.length, tot = s.items.reduce((a, i) => a + i.qty, 0);
    $('[data-qsummary]').textContent = n ? `${n} référence${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''} · ${tot.toLocaleString('fr-FR')} pièces` : 'Aucune référence sélectionnée';
  }
  function renderQuote() {
    const s = store.get(), body = $('#quoteBody'), foot = $('#quoteFoot');
    updSummary();
    if (!s.items.length) {
      body.innerHTML = `<div class="qempty"><div class="qempty__ic">${icon('i-list')}</div><h3>Votre demande est vide.</h3><p>Ajoutez les références qui vous intéressent. Vous pourrez ensuite nous préciser votre besoin.</p>
        <a href="/catalogue" class="btn btn--navy btn--block" data-close-nav>Explorer le catalogue</a><hr>
        <p style="margin:0 0 12px"><b style="color:var(--navy)">Vous savez déjà ce qu’il vous faut ?</b></p><a href="/devis" class="btn btn--primary btn--block" data-close-nav>Demander un devis</a></div>`;
      foot.innerHTML = `<div class="qhelp"><span>Besoin d’une réponse rapide ?</span><a class="btn btn--wa btn--sm" data-wa="quote">${icon('i-wa')} WhatsApp</a></div>`;
    } else {
      body.innerHTML = s.items.map(it => { const p = bySlug(it.slug); return `<div class="qi"><a class="qi__img" href="/produit/${p.slug}" data-close-nav><img src="${p.images[0]}" alt=""></a><div><b>${esc(p.name)}</b><small>${p.reference ? 'Réf. ' + esc(p.reference) : esc(p.brand || p.subcategory)}${it.color ? ' · <span class="qcol">' + esc(it.color) + '</span>' : ''}</small><div class="qi__q"><label>Quantité souhaitée</label>${qtyCtl(it)}</div></div><button class="rm" data-rm="${it.slug}" aria-label="Retirer ${esc(p.name)}">${icon('i-trash')}</button></div>`; }).join('') + `
        <label class="field"><span>Informations complémentaires <em>(facultatif)</em></span><textarea class="inp" id="qMsg" rows="3" placeholder="Décrivez votre besoin… (couleurs, tailles, logo, délai)">${esc(s.message)}</textarea></label>
        <label class="field"><span>Date souhaitée <em>(facultatif)</em></span><input class="inp" type="date" id="qDate" value="${esc(s.date)}"></label>`;
      foot.innerHTML = `<a href="/devis" class="btn btn--primary btn--block btn--lg" data-close-nav>Continuer la demande ${icon('i-arrow')}</a><div class="qhelp"><span>Besoin d’une réponse rapide ?</span><a class="btn btn--wa btn--sm" data-wa="quote">${icon('i-wa')} WhatsApp</a></div>`;
      bindQtys(body, () => renderQuote());
      $('#qMsg').oninput = e => store.patch({ message: e.target.value });
      $('#qDate').onchange = e => store.patch({ date: e.target.value });
    }
    $$('[data-close-nav]', $('#quoteDrawer')).forEach(a => a.addEventListener('click', () => { QF.step = 1; closeAll(); }));
    refreshWa();
  }

  /* ---------- Search ---------- */
  function searchProducts(q) {
    const nq = norm(q).trim(); if (!nq) return [];
    const terms = nq.split(/\s+/);
    const exp = terms.flatMap(t => [t, ...(D.synonyms[t] || [])].map(norm));
    return P.map(p => {
      const hay = norm([p.name, p.reference, p.brand, p.subcategory, catById(p.category).name, (p.specs || []).join(' '), p.description].join(' '));
      let sc = 0;
      if (p.reference && norm(p.reference) === nq) sc += 100;
      else if (p.reference && norm(p.reference).startsWith(nq) && nq.length > 2) sc += 60;
      terms.forEach(t => { if (norm(p.name).includes(t)) sc += 12; else if (hay.includes(t)) sc += 5; });
      exp.forEach(t => { if (norm(p.name + ' ' + p.subcategory + ' ' + p.category).includes(t)) sc += 3; });
      if (p.brand && norm(p.brand).includes(nq)) sc += 20;
      return [p, sc];
    }).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  }
  const hl = (s, q) => { const t = norm(q).trim(); if (!t) return esc(s); const i = norm(s).indexOf(t); return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + t.length)) + '</mark>' + esc(s.slice(i + t.length)); };
  function openSearch(q = '') {
    const s = $('#search'); s.classList.add('is-open'); s.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
    const i = $('#searchInput'); i.value = q; renderSearch(); setTimeout(() => i.focus(), 60);
  }
  function closeSearch() { const s = $('#search'); if (!s.classList.contains('is-open')) return; s.classList.remove('is-open'); s.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
  $('#search').addEventListener('click', e => { if (e.target.id === 'search') closeAll(); });
  let sel = -1;
  function renderSearch() {
    const q = $('#searchInput').value.trim(), R = $('#searchRes'); sel = -1;
    if (!q) {
      R.innerHTML = `<div class="sgrp">Recherches fréquentes</div><div class="sugg">${['polo', 'T-shirt', 'chantier', 'tote', 'gants', 'sweat', '0614220', 'Casque'].map(t => `<button class="chip" data-sq="${t}">${t}</button>`).join('')}</div>
        <div class="sgrp">Familles</div>${D.categories.map(c => `<a class="shit" href="/catalogue/${c.id}"><span class="shit__ic">${icon('i-grid')}</span><span><b>${c.name}</b><small>${count(c.id)} références</small></span>${icon('i-chev-r', 'go')}</a>`).join('')}`;
    } else {
      const res = searchProducts(q);
      const nq = norm(q);
      const exact = res.find(p => p.reference && norm(p.reference) === nq);
      const subs = [...new Set(res.map(p => p.category + '|' + p.subcategory))].slice(0, 4);
      const syn = D.synonyms[nq];
      let html = '';
      if (exact) html += `<div class="sgrp">Référence exacte</div><a class="shit shit--exact" href="/produit/${exact.slug}"><img src="${exact.images[0]}" alt=""><span><b>${esc(exact.name)}</b><small>Réf. ${esc(exact.reference)} · ${esc(exact.brand)}</small></span><span class="tag">VOIR LE PRODUIT</span></a>`;
      if (subs.length) html += `<div class="sgrp">${syn ? 'Pour ce besoin, nous proposons' : 'Catégories'}</div>` + subs.map(k => { const [c, s] = k.split('|'); const n = P.filter(p => p.subcategory === s && p.category === c).length; return `<a class="shit" href="${subUrl(c, s)}"><span class="shit__ic">${icon('i-grid')}</span><span><b>${esc(s)}</b><small>${catById(c).name} · ${n} référence${n > 1 ? 's' : ''}</small></span>${icon('i-chev-r', 'go')}</a>`; }).join('');
      const list = res.filter(p => p !== exact).slice(0, 7);
      if (list.length) html += `<div class="sgrp"><span>Produits</span><span>${res.length} résultat${res.length > 1 ? 's' : ''}</span></div>` + list.map(p => `<a class="shit" href="/produit/${p.slug}"><img src="${p.images[0]}" alt="" loading="lazy"><span><b>${hl(p.name, q)}</b><small>${p.reference ? 'Réf. ' + hl(p.reference, q) + ' · ' : ''}${esc(p.brand || p.subcategory)}</small></span>${icon('i-chev-r', 'go')}</a>`).join('');
      if (res.length > 8) html += `<a class="shit" href="/catalogue?q=${encodeURIComponent(q)}"><span class="shit__ic">${icon('i-search')}</span><span><b>Voir les ${res.length} résultats</b><small>dans le catalogue</small></span>${icon('i-chev-r', 'go')}</a>`;
      if (!res.length) html = `<div class="sempty"><b>Aucun résultat pour « ${esc(q)} »</b>Décrivez-nous votre besoin : nous trouverons le produit adapté.<div class="row" style="justify-content:center;margin-top:16px"><a href="/devis" class="btn btn--primary btn--sm">Décrire mon besoin</a><a class="btn btn--wa btn--sm" data-wa="home">${icon('i-wa')} WhatsApp</a></div></div>`;
      R.innerHTML = html;
    }
    $$('[data-sq]', R).forEach(b => b.onclick = () => { $('#searchInput').value = b.dataset.sq; renderSearch(); $('#searchInput').focus(); });
    $$('a', R).forEach(a => a.addEventListener('click', () => closeAll()));
    refreshWa();
  }
  $('#searchInput').addEventListener('input', renderSearch);
  $('#searchInput').addEventListener('keydown', e => {
    const hits = $$('#searchRes a.shit');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length; hits.forEach((h, i) => h.classList.toggle('is-sel', i === sel)); hits[sel] && hits[sel].scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') { e.preventDefault(); const h = hits[sel] || hits.find(h => h.classList.contains('shit--exact')) || hits[0]; const q = e.target.value.trim(); if (sel < 0 && q && !hits.some(h => h.classList.contains('shit--exact'))) nav('/catalogue?q=' + encodeURIComponent(q)); else if (h) nav(h.getAttribute('href')); closeAll(); }
  });

  /* ---------- Lightbox ---------- */
  let lbI = 0, lbSet = [];
  function openLb(i, set) {
    lbSet = set === 'home' ? D.projects.slice(0, 7) : D.projects; lbI = lbSet.indexOf(D.projects[i]); if (lbI < 0) lbI = 0;
    showLb(); $('#lb').classList.add('is-open'); $('#lb').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  }
  function showLb() { const p = lbSet[lbI]; $('#lb img').src = p.img; $('#lb img').alt = p.product; $('#lb figcaption').innerHTML = `<b>${esc(p.solution)}</b> · ${esc(p.product)} · ${esc(p.sector)}`; }
  function closeLb() { $('#lb').classList.remove('is-open'); $('#lb').setAttribute('aria-hidden', 'true'); }
  $('.lb__prev').onclick = () => { lbI = (lbI - 1 + lbSet.length) % lbSet.length; showLb(); };
  $('.lb__next').onclick = () => { lbI = (lbI + 1) % lbSet.length; showLb(); };
  $('#lb').addEventListener('click', e => { if (e.target.id === 'lb') closeAll(); });
  document.addEventListener('keydown', e => { if (!$('#lb').classList.contains('is-open')) return; if (e.key === 'ArrowRight') $('.lb__next').click(); if (e.key === 'ArrowLeft') $('.lb__prev').click(); });

  /* ---------- Légal / 404 ---------- */
  function viewLegal(kind) {
    const t = kind === 'ml' ? 'Mentions légales' : 'Politique de confidentialité';
    const body = kind === 'ml'
      ? `<h2>Éditeur du site</h2><p><b>Corpotex</b>, société au capital de ${D.legal.capital}</p><p>Adresse : ${D.legal.address}</p>
        <ul class="legal-ids">${D.legal.ids.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('')}</ul>
        <p>Téléphone : ${D.legal.tel} · Mobile / WhatsApp : ${C.phone}<br>Email : <a href="mailto:${C.email}">${C.email}</a> · Site : <a href="/">${C.web}</a></p>
        <h2>Hébergement</h2><p>Hetzner Online GmbH — Industriestr. 25, 91710 Gunzenhausen, Allemagne — <a href="https://www.hetzner.com" rel="noopener" target="_blank">hetzner.com</a></p>
        <h2>Propriété intellectuelle</h2><p>Les contenus du site (textes, logo, photos de réalisations) appartiennent à Corpotex, sauf mention contraire. Les marques et visuels produits appartiennent à leurs titulaires respectifs. Toute reproduction sans autorisation est interdite.</p>
        <h2>Données personnelles</h2><p>Le traitement des données transmises via le site est décrit dans notre <a href="/confidentialite">politique de confidentialité</a>, conformément à la loi 09-08.</p>`
      : `<h2>Responsable du traitement</h2><p>Corpotex, ${D.legal.address} — ICE ${D.legal.ice} — <a href="mailto:${C.email}">${C.email}</a></p>
        <h2>Données collectées</h2><p>Les informations saisies dans les formulaires (entreprise, nom, téléphone, email, ville, message, fichiers joints) sont utilisées uniquement pour traiter votre demande et vous adresser un devis.</p>
        <h2>Utilisation et conservation</h2><p>Votre sélection de produits est conservée dans votre navigateur jusqu’à l’envoi de votre demande. Une fois envoyée, la demande est transmise par email à l’équipe Corpotex et enregistrée sur notre serveur (hébergé par Hetzner Online GmbH) afin d’être traitée et suivie. Elle n’est ni revendue ni cédée à des tiers.</p>
        <h2>Cookies</h2><p>Le site n’utilise aucun cookie publicitaire ni outil de suivi.</p>
        <h2>Vos droits</h2><p>Conformément à la loi 09-08, vous pouvez demander l’accès, la rectification ou la suppression de vos données à <a href="mailto:${C.email}">${C.email}</a>.</p>`;
    app.innerHTML = `<div class="page"><section class="sec"><div class="wrap">${crumbs([['Accueil', '/'], [t]])}<h1 class="h2" style="margin:20px 0 10px">${t}</h1><div class="prose">${body}</div></div></section></div>`;
  }
  function view404() {
    app.innerHTML = `<div class="page"><div class="done"><div class="done__ic" style="background:var(--light);color:var(--navy)">${icon('i-search')}</div><h1>Page introuvable</h1><p>Cette page n’existe pas ou a été déplacée.</p><div class="row"><a href="/" class="btn btn--primary">Accueil</a><a href="/catalogue" class="btn btn--ghost">Catalogue</a></div></div></div>`;
  }

  /* ---------- SEO : titre, description, canonique et données structurées par page ---------- */
  const SITE = 'https://corpotex.ma';
  const CAT_SEO = {
    textile: ['T-shirts, polos & sweats personnalisés au Maroc — Textile publicitaire', 'T-shirts, polos et sweats personnalisés à votre logo pour vos équipes, événements et campagnes au Maroc'],
    workwear: ['Vêtements de travail au Maroc : veste & pantalon, combinaison, gilet & anti-acide', 'Ensembles veste et pantalon, combinaisons et gilets de travail, veste haute visibilité et tenues anti-acide, marqués à vos couleurs'],
    epi: ['EPI au Maroc : casques, gants, chaussures & lunettes de sécurité', 'Équipements de protection individuelle pour chantiers et industrie : casques, gants, chaussures de sécurité, lunettes et protection auditive'],
    goodies: ['Goodies & objets publicitaires au Maroc : tote bags, sacs & casquettes', 'Tote bags, sacs à dos RPET et casquettes personnalisés pour vos salons, événements et cadeaux d’entreprise'],
  };
  const TAIL = ' Devis gratuit sous 24H ouvrées, livraison partout au Maroc.';
  const cut = (s, n = 158) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, '') + '…' : s; };
  const absU = u => /^https?:/.test(u) ? u : SITE + (u.startsWith('/') ? '' : '/') + u;
  const bc = arr => ({ '@type': 'BreadcrumbList', itemListElement: arr.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE + c[1] })) });
  function seoFor(key, seg) {
    const home = ['Accueil', '/'];
    switch (key) {
      case 'home': return { t: 'Corpotex | Textile publicitaire, vêtements de travail & EPI au Maroc', d: 'Corpotex (Témara, Rabat) habille et équipe les entreprises partout au Maroc : t-shirts, polos et sweats personnalisés, vêtements de travail, haute visibilité et EPI. Broderie, sérigraphie, DTF. Devis gratuit sous 24H.', p: '/', ld: [{ '@type': 'FAQPage', mainEntity: D.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] };
      case 'catalogue': {
        const c = seg[1] && catById(seg[1]);
        if (seg[1] && !c) return null;
        if (c && seg[2]) {
          const sn = subBySlug(c.id, seg[2]); if (!sn) return null;
          const ss = D.seoSubs[c.id + '/' + seg[2]] || { h1: sn, t: sn + ' personnalisés au Maroc', d: c.text };
          const url = '/catalogue/' + c.id + '/' + seg[2], items = P.filter(p => p.category === c.id && p.subcategory === sn);
          return { t: ss.t + ' | Corpotex', d: cut(ss.d), p: url, img: items[0] && items[0].images[0], ld: [bc([home, ['Catalogue', '/catalogue'], [c.name, '/catalogue/' + c.id], [ss.h1, url]]),
            { '@type': 'CollectionPage', name: ss.h1, url: SITE + url, hasPart: items.map(p => ({ '@type': 'WebPage', name: p.name, url: SITE + '/produit/' + p.slug })) },
            ...(ss.faq ? [{ '@type': 'FAQPage', mainEntity: ss.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : [])] };
        }
        if (!c) return { t: 'Catalogue textile publicitaire, vêtements de travail & EPI | Corpotex Maroc', d: cut(`${P.length} références prêtes à personnaliser : t-shirts, polos, sweats, vestes de travail, gilets haute visibilité, casques, gants, chaussures de sécurité, tote bags.` + TAIL), p: '/catalogue', ld: [bc([home, ['Catalogue', '/catalogue']])] };
        const [t, d] = CAT_SEO[c.id] || [c.name + ' au Maroc', c.text];
        return { t: t + ' | Corpotex', d: cut(d + '.' + TAIL), p: '/catalogue/' + c.id, img: c.img, ld: [bc([home, ['Catalogue', '/catalogue'], [c.name, '/catalogue/' + c.id]]), { '@type': 'CollectionPage', name: c.name, url: SITE + '/catalogue/' + c.id, hasPart: P.filter(p => p.category === c.id).map(p => ({ '@type': 'WebPage', name: p.name, url: SITE + '/produit/' + p.slug })) }] };
      }
      case 'produit': {
        const p = bySlug(seg[1]); if (!p) return null; const c = catById(p.category);
        const nm = p.name + (p.brand && !p.name.includes(p.brand) ? ' ' + p.brand : '');
        return { t: `${nm}${p.reference ? ' — Réf. ' + p.reference : ''} | Corpotex Maroc`, d: cut(p.description || nm, 92) + ' Personnalisable à votre logo. Devis gratuit sous 24H, livraison partout au Maroc.', p: '/produit/' + p.slug, img: p.images[0], ld: [bc([home, ['Catalogue', '/catalogue'], [c.name, '/catalogue/' + c.id], [p.name, '/produit/' + p.slug]])] };
      }
      case 'solutions': {
        if (!seg[1]) return { t: 'Textile & EPI par métier : BTP, industrie, hôtellerie, événementiel | Corpotex Maroc', d: cut('Des tenues et équipements adaptés à chaque secteur : BTP, industrie, hôtellerie-restauration, retail, banques, événementiel, associations et équipes commerciales.' + TAIL), p: '/solutions', ld: [bc([home, ['Solutions', '/solutions']])] };
        const s = D.sectors.find(x => x.slug === seg[1]); if (!s) return null;
        return { t: `${s.name} : tenues de travail & textile personnalisé au Maroc | Corpotex`, d: cut(s.intro + TAIL), p: '/solutions/' + s.slug, img: s.img, ld: [bc([home, ['Solutions', '/solutions'], [s.name, '/solutions/' + s.slug]])] };
      }
      case 'projets': return { t: 'Réalisations : textile, vêtements de travail & EPI personnalisés | Corpotex Maroc', d: cut('Gilets haute visibilité, vestes de travail, polos brodés, t-shirts sérigraphiés, casques logotés : découvrez des projets réalisés pour des entreprises au Maroc.' + TAIL), p: '/projets', ld: [bc([home, ['Réalisations', '/projets']])] };
      case 'personnalisation': if (seg[1]) {
        const tp = D.techPages[seg[1]]; if (!tp) return null;
        return { t: tp.t + ' | Corpotex', d: cut(tp.d), p: '/personnalisation/' + seg[1], ld: [bc([home, ['Personnalisation', '/personnalisation'], [tp.h1, '/personnalisation/' + seg[1]]]),
          { '@type': 'Service', name: tp.h1, serviceType: tp.h1, description: tp.intro, areaServed: { '@type': 'Country', name: 'Maroc' }, provider: { '@id': SITE + '/#entreprise' } },
          { '@type': 'FAQPage', mainEntity: tp.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] };
      }
      return { t: 'Personnalisation textile au Maroc : broderie, sérigraphie, DTF & transfert | Corpotex', d: cut('Votre logo sur vos t-shirts, polos, vestes, casquettes et EPI : broderie, sérigraphie, impression DTF et transfert, avec BAT avant production.' + TAIL), p: '/personnalisation', ld: [bc([home, ['Personnalisation', '/personnalisation']])] };
      case 'guides': {
        if (!seg[1]) return { t: 'Guides & conseils : textile personnalisé, marquage, vêtements de travail & EPI | Corpotex Maroc', d: cut('Nos guides pratiques pour bien choisir vos t-shirts personnalisés, votre technique de marquage, vos vêtements de travail, vos EPI et vos goodies d’entreprise au Maroc.'), p: '/guides',
          ld: [bc([home, ['Guides & conseils', '/guides']]), { '@type': 'CollectionPage', name: 'Guides & conseils', url: SITE + '/guides', hasPart: D.guides.map(g => ({ '@type': 'Article', headline: g.h1, url: SITE + '/guides/' + g.slug })) }] };
        const g = D.guides.find(x => x.slug === seg[1]); if (!g || seg[2]) return null;
        const url = '/guides/' + g.slug;
        return { t: g.t + ' | Corpotex', d: cut(g.d), p: url, img: g.img, ld: [bc([home, ['Guides & conseils', '/guides'], [g.h1, url]]),
          { '@type': 'Article', headline: g.h1, description: g.d, image: absU(g.img), datePublished: g.date, dateModified: g.date, inLanguage: 'fr-MA', mainEntityOfPage: SITE + url,
            author: { '@type': 'Organization', name: 'Corpotex', url: SITE + '/' }, publisher: { '@id': SITE + '/#entreprise' } }] };
      }
      case 'a-propos': return { t: 'Corpotex, fournisseur textile & EPI des entreprises au Maroc | Nos engagements', d: cut('Corpotex (Yates Group) accompagne les entreprises marocaines en textile publicitaire, vêtements professionnels et EPI : durabilité, performance, innovation et conseil humain.' + TAIL), p: '/a-propos', ld: [bc([home, ['Nos engagements', '/a-propos']])] };
      case 'contact': return { t: 'Contact Corpotex Témara – Rabat : devis textile, vêtements de travail & EPI', d: cut(`Appelez le ${C.phone}, écrivez-nous sur WhatsApp ou par email : un conseiller Corpotex vous répond et vous adresse un devis gratuit sous 24H ouvrées.`), p: '/contact', ld: [bc([home, ['Contact', '/contact']])] };
      case 'devis': return { t: 'Demande de devis gratuit — textile publicitaire, workwear & EPI | Corpotex Maroc', d: cut('Décrivez votre besoin ou envoyez votre sélection de références : devis personnalisé et gratuit sous 24H ouvrées, de 10 à 10 000 pièces, livraison partout au Maroc.'), p: '/devis', ld: [bc([home, ['Demande de devis', '/devis']])] };
      case 'mentions-legales': return { t: 'Mentions légales | Corpotex Maroc', d: 'Mentions légales du site corpotex.ma.', p: '/mentions-legales', ld: [] };
      case 'confidentialite': return { t: 'Politique de confidentialité | Corpotex Maroc', d: 'Politique de confidentialité et protection des données (loi 09-08) du site corpotex.ma.', p: '/confidentialite', ld: [] };
    }
    return null;
  }
  const setAttr = (id, a, v) => { const el = document.getElementById(id); if (el) el.setAttribute(a, v); };
  function applySeo(s) {
    const nf = !s; s = s || { t: 'Page introuvable | Corpotex Maroc', d: 'Cette page n’existe pas ou a été déplacée.', p: location.pathname, ld: [] };
    document.title = s.t;
    setAttr('m-desc', 'content', s.d); setAttr('m-ogt', 'content', s.t); setAttr('m-ogd', 'content', s.d);
    setAttr('m-canon', 'href', SITE + s.p); setAttr('m-alt', 'href', SITE + s.p); setAttr('m-ogu', 'content', SITE + s.p);
    setAttr('m-ogi', 'content', absU(s.img || '/assets/og-corpotex.jpg'));
    setAttr('m-robots', 'content', nf ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1');
    const ld = document.getElementById('ld-page'); if (ld) ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': s.ld || [] });
    document.documentElement.dataset.status = nf ? '404' : '200';
  }

  /* ---------- Router ---------- */
  function route() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(location.search);
    const seg = path.split('/').filter(Boolean);
    closeAll();
    document.body.classList.remove('has-mstick');
    waContext = WA_MSG.home;
    const dark = !seg.length || ['catalogue', 'solutions', 'projets', 'a-propos', 'personnalisation', 'guides'].includes(seg[0]);
    hdr.classList.toggle('is-dark', dark);
    const key = seg[0] || 'home';
    $$('[data-nav]').forEach(a => a.classList.toggle('is-active', a.dataset.nav === key || (key === 'produit' && a.dataset.nav === 'catalogue')));
    $$('[data-bnav]').forEach(a => a.classList.toggle('is-on', a.dataset.bnav === key || (key === 'produit' && a.dataset.bnav === 'catalogue')));
    switch (key) {
      case 'home': viewHome(); break;
      case 'catalogue': viewCatalogue(seg[1] || '', params, seg[2]); break;
      case 'produit': viewProduct(seg[1]); break;
      case 'solutions': seg[1] ? viewSolution(seg[1]) : viewSolutions(); break;
      case 'projets': viewProjects(params); break;
      case 'personnalisation': seg[1] ? viewTech(seg[1]) : viewPerso(); break;
      case 'guides': seg[2] ? view404() : seg[1] ? viewGuide(seg[1]) : viewGuides(); break;
      case 'a-propos': viewAbout(); break;
      case 'contact': viewContact(); break;
      case 'devis': viewQuote(params); break;
      case 'mentions-legales': viewLegal('ml'); break;
      case 'confidentialite': viewLegal('pc'); break;
      default: view404();
    }
    applySeo(seoFor(key, seg));
    if (key !== 'catalogue' || !seg[1]) scrollTo(0, 0); else if (scrollY > 400) scrollTo(0, 0);
    refreshWa(); reveal(); onScroll();
  }
  // Navigation par vraies URL (History API) : liens internes interceptés, anciens liens #/ redirigés
  function nav(url) { if (url !== location.pathname + location.search) history.pushState(null, '', url); route(); }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="/"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute('download')) return;
    const u = a.getAttribute('href');
    if (u.startsWith('//') || /^\/(assets|api|css|js)\//.test(u) || /\.[a-z0-9]{2,4}$/i.test(u.split('?')[0])) return;
    e.preventDefault(); nav(u);
  });
  addEventListener('popstate', route);
  if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1));
  emit(true); // premier affichage des compteurs, une fois toutes les fonctions définies
  route();
})();
