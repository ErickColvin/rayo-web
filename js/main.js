// Datos de la tienda. Cambia aquí los enlaces y la web los usa en todos los
// botones con data-link="…", data-comprar="…" y data-descarga.
const RAYO = {
  repo: 'sebaile/rayo-optimizador', // GitHub: de aquí sale la última versión
  version: 'v2.5.3',                // se muestra si GitHub no responde
  discord: 'https://discord.gg/vS4KV8m5su',
  correo: '2002sebastian.perez@gmail.com',
  terminos: 'https://sebaile.github.io/rayo-optimizador/terminos.html',
  catalogo: 'https://github.com/sebaile/rayo-optimizador/blob/main/OPTIMIZACIONES.md',

  // Links de pago de Mercado Pago (pesos chilenos), uno por plan. Se crean en
  // la cuenta de Mercado Pago, en Cobrar → Link de pago, con el precio exacto.
  // Con link, en CLP el botón dice «Pagar con Mercado Pago» y después del pago
  // el comprador abre un ticket en Discord con su comprobante.
  // Vacíos (o en USD): «Comprar» lleva al Discord para comprar por ticket.
  mercadoPago: {
    pro: '',   // $3.990
    elite: '', // $6.990
  },
};

const instalador = `https://github.com/${RAYO.repo}/releases/latest/download/RayoSetup.exe`;
const paginaVersion = `https://github.com/${RAYO.repo}/releases/latest`;

document.querySelectorAll('[data-link]').forEach((el) => {
  const valor = RAYO[el.dataset.link];
  if (valor) el.href = el.dataset.link === 'correo' ? `mailto:${valor}` : valor;
});
document.querySelectorAll('[data-descarga]:not([data-portable])').forEach((el) => { el.href = instalador; });
document.querySelectorAll('[data-portable], [data-notas]').forEach((el) => { el.href = paginaVersion; });

// Última versión publicada: número, tamaños y ZIP portátil directo
function tamano(bytes) {
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MB`;
}

fetch(`https://api.github.com/repos/${RAYO.repo}/releases/latest`)
  .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
  .then((rel) => {
    if (rel.tag_name) document.querySelectorAll('[data-version]').forEach((el) => { el.textContent = rel.tag_name; });
    const exe = rel.assets.find((a) => a.name === 'RayoSetup.exe');
    const zip = rel.assets.find((a) => a.name.endsWith('.zip'));
    if (exe) document.querySelectorAll('[data-tam="exe"]').forEach((el) => { el.textContent = tamano(exe.size); });
    if (zip) {
      document.querySelectorAll('[data-tam="zip"]').forEach((el) => { el.textContent = tamano(zip.size); });
      document.querySelectorAll('[data-portable]').forEach((el) => { el.href = zip.browser_download_url; });
    }
    if (rel.html_url) document.querySelectorAll('[data-notas]').forEach((el) => { el.href = rel.html_url; });
  })
  .catch(() => {});

// Precios en CLP o USD y botones de compra
const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ } };
const leer = (clave) => { try { return localStorage.getItem(clave); } catch (e) { return null; } };

// Estado original de cada botón Comprar, para volver a él al cambiar a USD
const botonesCompra = [...document.querySelectorAll('[data-comprar]')].map((el) => ({
  el,
  plan: el.dataset.comprar,
  texto: el.querySelector('span'),
  textoOriginal: el.querySelector('span').textContent,
  icono: el.querySelector('svg'),
  iconoOriginal: el.querySelector('use').getAttribute('href'),
  iconoOculto: el.querySelector('svg').hasAttribute('hidden'), // en <svg> no existe la propiedad .hidden
  alternativa: el.nextElementSibling,
}));

function usarMoneda(moneda) {
  document.querySelectorAll('[data-moneda]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.moneda === moneda)));
  document.querySelectorAll(`[data-${moneda}]`).forEach((el) => { el.textContent = el.dataset[moneda]; });

  botonesCompra.forEach((b) => {
    const link = moneda === 'clp' ? RAYO.mercadoPago[b.plan] : '';
    b.el.href = link || RAYO.discord;
    b.el.toggleAttribute('data-mp', Boolean(link));
    b.texto.textContent = link ? 'Pagar con Mercado Pago' : b.textoOriginal;
    b.icono.querySelector('use').setAttribute('href', link ? '#i-card' : b.iconoOriginal);
    b.icono.toggleAttribute('hidden', link ? false : b.iconoOculto);
    b.alternativa.hidden = !link;
  });

  const conMercadoPago = botonesCompra.some((b) => b.el.hasAttribute('data-mp'));
  document.querySelectorAll('[data-venta]').forEach((el) => {
    el.hidden = el.dataset.venta !== (conMercadoPago ? 'mercadopago' : 'discord');
  });
}

const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
const enChile = /^(America\/(Santiago|Punta_Arenas)|Pacific\/Easter)$/.test(zona);
usarMoneda(leer('rayo-moneda') || (enChile ? 'clp' : 'usd'));

document.querySelectorAll('[data-moneda]').forEach((b) => b.addEventListener('click', () => {
  usarMoneda(b.dataset.moneda);
  guardar('rayo-moneda', b.dataset.moneda);
}));

// Mercado Pago se abre en otra pestaña: al volver, el siguiente paso ya está a la vista
botonesCompra.forEach((b) => b.el.addEventListener('click', () => {
  if (!b.el.hasAttribute('data-mp')) return;
  const aviso = document.querySelector('.compra__aviso');
  aviso.hidden = false;
  setTimeout(() => aviso.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
}));

// Descargar: en Windows baja el archivo y muestra los pasos de instalación;
// en celular o Mac ofrece enviarse el enlace para abrirlo en el PC
const plataforma = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.userAgent;
const esWindows = /windows/i.test(plataforma);
const alPc = document.querySelector('.al-pc');
const enlaceWeb = `${location.origin}${location.pathname}#descargar`;
const estado = alPc.querySelector('.al-pc__estado');
const compartir = alPc.querySelector('[data-compartir]');

document.querySelectorAll('[data-descarga]').forEach((el) => el.addEventListener('click', (e) => {
  if (!esWindows) {
    e.preventDefault();
    estado.textContent = '';
    alPc.showModal();
    return;
  }
  const aviso = document.querySelector('.dl__ok');
  aviso.hidden = false;
  if (!el.closest('#descargar')) {
    setTimeout(() => document.getElementById('instalar').scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
  }
}));

const copiar = alPc.querySelector('[data-copiar]');

if (navigator.share) {
  compartir.hidden = false;
  compartir.addEventListener('click', () => {
    navigator.share({ title: 'Rayo · Optimizador de FPS para Windows', text: 'Descargar Rayo en el PC', url: enlaceWeb }).catch(() => {});
  });
} else {
  copiar.classList.replace('btn--ghost', 'btn--primary');
}

// Los navegadores de TikTok o Instagram suelen bloquear el portapapeles moderno:
// se intenta el método antiguo y, si tampoco sirve, se muestra el enlace
function copiarAntiguo() {
  const campo = document.createElement('textarea');
  campo.value = enlaceWeb;
  campo.setAttribute('readonly', '');
  campo.style.cssText = 'position:fixed;opacity:0';
  alPc.append(campo);
  campo.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { /* no soportado */ }
  campo.remove();
  return ok;
}

copiar.addEventListener('click', () => {
  const listo = () => { estado.textContent = 'Enlace copiado. Pégalo en un chat contigo o en tu correo.'; };
  const mostrar = () => {
    if (copiarAntiguo()) listo();
    else {
      const url = document.createElement('span');
      url.textContent = enlaceWeb;
      estado.replaceChildren('Mantén presionado para copiarlo: ', url);
    }
  };
  if (navigator.clipboard) navigator.clipboard.writeText(enlaceWeb).then(listo, mostrar);
  else mostrar();
});

alPc.addEventListener('click', (e) => {
  if (e.target === alPc || e.target.closest('[data-cerrar]')) alPc.close();
});

// Menú en móvil y fondo de la barra al hacer scroll
const nav = document.querySelector('.nav');
const toggle = document.querySelector('.nav__toggle');
const menu = document.getElementById('menu');

function cerrarMenu() {
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Abrir menú');
  menu.classList.remove('is-open');
}

toggle.addEventListener('click', () => {
  const abrir = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(abrir));
  toggle.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
  menu.classList.toggle('is-open', abrir);
});
menu.addEventListener('click', (e) => { if (e.target.closest('a')) cerrarMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenu(); });

// Al hacer scroll: fondo de la barra, barra de progreso y la captura de la
// portada que se endereza (de 7° a 0° en los primeros 500 px)
const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const progreso = document.querySelector('.progreso');
const capturaHero = document.querySelector('.window--hero');
let scrollPendiente = false;

function alHacerScroll() {
  scrollPendiente = false;
  const y = window.scrollY;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  nav.classList.toggle('is-scrolled', y > 8);
  progreso.style.transform = `scaleX(${total > 0 ? Math.min(1, y / total) : 0})`;
  if (!sinMovimiento) capturaHero.style.setProperty('--tilt', `${(7 * Math.max(0, 1 - y / 500)).toFixed(2)}deg`);
}
alHacerScroll();
window.addEventListener('scroll', () => {
  if (scrollPendiente) return;
  scrollPendiente = true;
  requestAnimationFrame(alHacerScroll);
}, { passive: true });

// Recorrido por la app: pestañas accesibles con flechas, Inicio y Fin
const tablist = document.querySelector('.tour__tabs');
const tabs = [...tablist.querySelectorAll('[role="tab"]')];

function activar(tab, enfocar) {
  tabs.forEach((t) => {
    const activa = t === tab;
    t.setAttribute('aria-selected', String(activa));
    t.tabIndex = activa ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !activa;
  });
  if (enfocar) tab.focus({ preventScroll: true });
  // En pantallas angostas las pestañas van en fila: centra la elegida
  if (tablist.scrollWidth > tablist.clientWidth) {
    tablist.scrollTo({ left: tab.offsetLeft - (tablist.clientWidth - tab.offsetWidth) / 2, behavior: 'smooth' });
  }
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => activar(tab));
  tab.addEventListener('keydown', (e) => {
    const paso = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    let destino;
    if (paso) destino = tabs[(i + paso + tabs.length) % tabs.length];
    else if (e.key === 'Home') destino = tabs[0];
    else if (e.key === 'End') destino = tabs[tabs.length - 1];
    if (!destino) return;
    e.preventDefault();
    activar(destino, true);
  });
});

// Visor para ampliar las capturas
const visor = document.querySelector('.visor');
const visorImg = visor.querySelector('img');

document.querySelectorAll('.zoom').forEach((boton) => {
  boton.addEventListener('click', () => {
    const img = boton.querySelector('img');
    visorImg.src = img.currentSrc || img.src;
    visorImg.alt = img.alt;
    visor.showModal();
  });
});
visor.addEventListener('click', () => visor.close());

// Orden para las apariciones escalonadas (--i en el CSS): entre bloques
// hermanos y entre los elementos de cada lista
document.querySelectorAll('.reveal').forEach((el) => {
  const hermanos = [...el.parentElement.children].filter((h) => h.classList.contains('reveal'));
  el.style.setProperty('--i', hermanos.indexOf(el));
});
document.querySelectorAll('.games, .diag, .nohace__list, .plans__notes, .req, .install, .compra__pasos, .ticks').forEach((lista) => {
  [...lista.children].forEach((hijo, i) => hijo.style.setProperty('--i', i));
});

// Brillo que sigue al mouse en las tarjetas (solo con mouse, no en pantallas táctiles)
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.step, .trust__item, .plan, .card, .game, .dl__card, .nohace').forEach((el) => el.classList.add('spot'));
  document.addEventListener('pointermove', (e) => {
    const tarjeta = e.target.closest('.spot');
    if (!tarjeta) return;
    const caja = tarjeta.getBoundingClientRect();
    tarjeta.style.setProperty('--mx', `${e.clientX - caja.left}px`);
    tarjeta.style.setProperty('--my', `${e.clientY - caja.top}px`);
  }, { passive: true });
}

// Cifras que cuentan desde 0 cuando aparecen
function contar(el) {
  const meta = Number(el.dataset.count);
  const inicio = performance.now();
  const paso = (ahora) => {
    const avance = Math.min(1, (ahora - inicio) / 1400);
    el.textContent = Math.round(meta * (1 - (1 - avance) ** 3));
    if (avance < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// Aparición suave de las secciones
const aparecer = document.querySelectorAll('.reveal, .stats__grid');
if ('IntersectionObserver' in window) {
  document.querySelectorAll('[data-count]').forEach((el) => { el.textContent = '0'; });
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add('is-visible');
      entrada.target.querySelectorAll('[data-count]').forEach(contar);
      io.unobserve(entrada.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  aparecer.forEach((el) => io.observe(el));
} else {
  aparecer.forEach((el) => el.classList.add('is-visible'));
}
