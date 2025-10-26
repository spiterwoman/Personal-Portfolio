// util
const lerp = (a,b,t)=>a+(b-a)*t;

let visualCarouselController = null;

// DOM
const root = document.getElementById('keychain');
const cursor = document.getElementById('cursor');
const tags = [...document.querySelectorAll('.tag')];
const ringHook = document.querySelector('.ring-hook');
const arms = [...document.querySelectorAll('.arm')]; // one chain image per tag

// springs for tag swing
const springs = new Map();
tags.forEach(t=>springs.set(t.dataset.id, {angle:0, vel:0, base:+t.dataset.rot||0, target:0}));

const layoutConfigs = [
  {
    mq: window.matchMedia('(max-width: 460px)'),
    positions: {
      tri:  {x:0,   y:210},
      oval: {x:0,   y:310},
      rect: {x:0,   y:410}
    }
  },
  {
    mq: window.matchMedia('(max-width: 560px)'),
    positions: {
      tri:  {x:-80,  y:200},
      oval: {x:0,    y:280},
      rect: {x:80,   y:360}
    }
  },
  {
    mq: window.matchMedia('(max-width: 720px)'),
    positions: {
      tri:  {x:-180, y:240},
      oval: {x:0,    y:280},
      rect: {x:180,  y:320}
    }
  }
];

const desktopLayout = {
  tri:  {x:-240, y:260},
  oval: {x:0,    y:240},
  rect: {x:240, y:260}
};

function applyLayout(){
  let active = desktopLayout;
  for(const cfg of layoutConfigs){
    if(cfg.mq.matches){
      active = cfg.positions;
      break;
    }
  }

  tags.forEach(tag=>{
    const id = tag.dataset.id;
    const pos = active[id] || {x:0, y:0};
    tag.dataset.x = pos.x;
    tag.dataset.y = pos.y;
  });
}

applyLayout();
layoutConfigs.forEach(cfg=>{
  if(typeof cfg.mq.addEventListener === 'function'){
    cfg.mq.addEventListener('change', applyLayout);
  }else if(typeof cfg.mq.addListener === 'function'){
    cfg.mq.addListener(applyLayout);
  }
});
window.addEventListener('resize', applyLayout);

let rx=0, ry=0, tx=0, ty=0;

const bounds = ()=> root.getBoundingClientRect();

function onMove(e){
  const b = bounds();
  const cx = b.left + b.width/2;
  const cy = b.top + b.height/2;
  const x = (e.clientX - cx) / (b.width/2);   // -1..1
  const y = (e.clientY - cy) / (b.height/2);

  tx = 12 * x;
  ty = -10 * y;

  // swing targets
  tags.forEach(tag=>{
    const s = springs.get(tag.dataset.id);
    s.target = (x*10 + y*6);
  });

  // moving gloss highlight
  tags.forEach(tag=>{
    const r = tag.getBoundingClientRect();
    tag.style.setProperty('--hlx', (e.clientX - r.left) + 'px');
    tag.style.setProperty('--hly', (e.clientY - r.top) + 'px');
  });
}

// draw 3 separate chain arms from star ring to each tag
function updateArms(){
  const kb = bounds();
  const rb = ringHook.getBoundingClientRect();
  const rcx = rb.left + rb.width/2 - kb.left;
  const rcy = rb.top  + rb.height/2 - kb.top;
  const ringR = rb.width/2;

  const PAD_HEAD = 4;
  const IMG_ZERO = 90;

  arms.forEach(arm=>{
    const id = arm.dataset.target;
    const tag = document.querySelector(`.tag[data-id="${id}"]`);
    if(!tag) return;

    const hookEl = tag.querySelector('.hook');
    const hole = hookEl.getBoundingClientRect();
    const hx = hole.left + hole.width/2 - kb.left;
    const hy = hole.top  + hole.height/2 - kb.top;
    const tagR = hole.width/2;

    const dx = hx - rcx;
    const dy = hy - rcy;
    const dist  = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180/Math.PI;

    const length = Math.max(28, dist - ringR - tagR + 6);

    arm.style.left   = rcx + 'px';
    arm.style.top    = rcy + 'px';
    arm.style.height = length + 'px';
    arm.style.transform =
      `translate(-50%, -${PAD_HEAD}px) rotate(${angle - IMG_ZERO}deg) translateY(${ringR + PAD_HEAD + 3}px)`;
  });
}



function animate(){
  // container tilt
  rx = lerp(rx, tx, 0.08);
  ry = lerp(ry, ty, 0.08);
  root.style.transform = `rotateY(${rx}deg) rotateX(${ry}deg)`;

  // tag springs + parallax
  tags.forEach(tag=>{
    const s = springs.get(tag.dataset.id);
    s.vel += (s.target - s.angle) * 0.08;
    s.vel *= 0.88;
    s.angle += s.vel;

    const b = +tag.dataset.rot||0;
    const depth = +tag.dataset.depth || 20;
    const baseX = +(tag.dataset.x||0);
    const baseY = +(tag.dataset.y||0);
    const px = baseX + (-rx/12 * depth);
    const py = baseY + (ry/10 * depth);

    tag.style.transform = `translate(-50%, -50%) translate3d(${px}px, ${py}px, ${depth}px) rotate(${b + s.angle}deg)`;
  });

  updateArms();
  requestAnimationFrame(animate);
}
animate();

root.addEventListener('pointermove', onMove);
root.addEventListener('pointerleave', ()=>{
  tx=0; ty=0;
  springs.forEach(s=>s.target=0);
});

// cursor
window.addEventListener('pointermove', (e)=>{
  cursor.style.left = e.clientX+'px';
  cursor.style.top  = e.clientY+'px';
});

// smooth scroll for internal anchors (nav + keychain tags)
document.querySelectorAll('a[href^="#"]').forEach(link=>{
  const href = link.getAttribute('href');
  if(href.length <= 1) return;
  const target = document.querySelector(href);
  if(!target) return;

  link.addEventListener('click', evt=>{
    evt.preventDefault();
    target.scrollIntoView({behavior:'smooth', block:'start'});

    if(link.dataset.slide !== undefined){
      const slideIndex = Number(link.dataset.slide);
      if(Number.isFinite(slideIndex)){
        const send = ()=>{
          if(visualCarouselController?.goTo){
            visualCarouselController.goTo(slideIndex);
          }else{
            const carouselEl = document.querySelector('.visual-carousel');
            carouselEl?.dispatchEvent(new CustomEvent('carousel:goto',{detail:slideIndex}));
          }
        };
        if(href === '#visual'){
          setTimeout(send, 220);
        }else{
          send();
        }
      }
    }
  });
});

// visual carousel
const carousel = document.querySelector('.visual-carousel');
if(carousel){
  const track = carousel.querySelector('.carousel-track');
  const slides = [...carousel.querySelectorAll('.visual-slide')];
  const prev = carousel.querySelector('.carousel-nav.prev');
  const next = carousel.querySelector('.carousel-nav.next');
  const dotsWrap = carousel.querySelector('.carousel-dots');
  let index = 0;
  let timer;

  const createDot = (slide, i)=>{
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot' + (i===0 ? ' is-active' : '');
    const title = slide.dataset.title || `Slide ${i+1}`;
    dot.setAttribute('aria-label', `Go to ${title}`);
    dot.addEventListener('click', ()=> goTo(i));
    dotsWrap.appendChild(dot);
    return dot;
  };

  const dots = slides.map(createDot);

  const setState = ()=>{
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((slide,i)=> slide.classList.toggle('is-active', i===index));
    dots.forEach((dot,i)=> dot.classList.toggle('is-active', i===index));
  };

  const goTo = (i)=>{
    index = (i + slides.length) % slides.length;
    setState();
    restartAuto();
  };

  const restartAuto = ()=>{
    clearInterval(timer);
    timer = setInterval(()=> goTo(index + 1), 7000);
  };

  const triggers = [...carousel.querySelectorAll('.visual-card-trigger')];
  const lightbox = document.querySelector('.visual-lightbox');
  const lightboxImg = lightbox?.querySelector('img');
  const lightboxCaption = lightbox?.querySelector('.visual-lightbox__caption');
  const lightboxCloseButtons = lightbox ? [...lightbox.querySelectorAll('[data-lightbox-close]')] : [];
  let lastFocus;

  const openLightbox = (trigger)=>{
    if(!lightbox) return;
    const img = trigger.querySelector('img');
    const src = trigger.dataset.full || img?.currentSrc || img?.src;
    if(lightboxImg){
      lightboxImg.src = src;
      lightboxImg.alt = img?.alt || '';
    }
    if(lightboxCaption) lightboxCaption.textContent = img?.alt || '';
    lightbox.removeAttribute('hidden');
    requestAnimationFrame(()=> lightbox.classList.add('is-open'));
    document.body.classList.add('no-scroll');
    lastFocus = document.activeElement;
    clearInterval(timer);
    lightbox.querySelector('.visual-lightbox__close')?.focus({preventScroll:true});
  };

  const closeLightbox = ()=>{
    if(!lightbox) return;
    lightbox.classList.remove('is-open');
    const handleHide = ()=>{
      lightbox.setAttribute('hidden','');
    };
    const hideFallback = setTimeout(()=>{
      if(!lightbox.hasAttribute('hidden')) handleHide();
    }, 320);
    lightbox.addEventListener('transitionend', (event)=>{
      if(event.target === lightbox){
        clearTimeout(hideFallback);
        handleHide();
      }
    }, {once:true});
    if(lightboxImg){
      lightboxImg.src = '';
      lightboxImg.alt = '';
    }
    if(lightboxCaption) lightboxCaption.textContent = '';
    document.body.classList.remove('no-scroll');
    lastFocus?.focus?.();
    restartAuto();
  };

  triggers.forEach(trigger=>{
    trigger.addEventListener('click', ()=> openLightbox(trigger));
  });

  carousel.addEventListener('carousel:goto', event=>{
    const detail = event.detail;
    const targetIndex = typeof detail === 'object' && detail !== null && 'index' in detail
      ? Number(detail.index)
      : Number(detail);
    if(Number.isFinite(targetIndex)){
      goTo(targetIndex);
    }
  });

  visualCarouselController = {
    goTo,
    get index(){return index;},
    get length(){return slides.length;}
  };

  lightboxCloseButtons.forEach(btn=>{
    btn.addEventListener('click', closeLightbox);
  });

  lightbox?.addEventListener('click', (event)=>{
    if(event.target.dataset.lightboxClose !== undefined){
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event)=>{
    if(event.key === 'Escape' && lightbox?.classList.contains('is-open')){
      closeLightbox();
    }
  });

  prev?.addEventListener('click', ()=> goTo(index - 1));
  next?.addEventListener('click', ()=> goTo(index + 1));
  carousel.addEventListener('pointerenter', ()=> clearInterval(timer));
  carousel.addEventListener('pointerleave', restartAuto);

  setState();
  restartAuto();
}

// year
document.getElementById('y').textContent = new Date().getFullYear();
