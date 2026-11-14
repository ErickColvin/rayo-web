// Datos de la tienda. Cambia aquí los enlaces y la web los usa en todos los
// botones con data-link="…", data-comprar="…" y data-descarga.
const RAYO = {
  repo: 'sebaile/rayo-optimizador', // GitHub: de aquí sale la última versión
  version: 'v2.5.3',                // se muestra si GitHub no responde
  discord: 'https://discord.gg/vS4KV8m5su',
  tiktok: 'https://www.tiktok.com/@rayopti.fps',
  instagram: 'https://www.instagram.com/rayofps.cl/',
  correo: '2002sebastian.perez@gmail.com',
  terminos: 'https://sebaile.github.io/rayo-optimizador/terminos.html',
  catalogo: 'https://github.com/sebaile/rayo-optimizador/blob/main/OPTIMIZACIONES.md',

  // Links de pago de Mercado Pago (pesos chilenos), uno por plan. Se crean en
  // la cuenta de Mercado Pago, en Cobrar → Link de pago, con el precio exacto.
  // «Comprar» abre un popup: Mercado Pago (pide nombre, correo y número) o
  // transferencia por ticket en Discord. Vacíos (o en USD): solo Discord.
  mercadoPago: {
    pro: 'https://mpago.la/34eSBdt',   // RayoPRO $3.990
    elite: 'https://mpago.la/1wXjGYJ', // RayoELITE $6.990
  },

  // URL de la aplicación web de Apps Script que guarda los pedidos en la
  // planilla de Google (instrucciones en planilla/pedidos.gs). Termina en /exec.
  planillaPedidos: 'https://script.google.com/macros/s/AKfycbwVxmh3H0O-A68tjzgqRvSiAntOcqfnJy7cQ_0aZWpLKaGXWIIaGjGUqlgwLJR7Fcpm/exec',
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

let monedaActual = 'clp';
const linkMercadoPago = (plan) => (monedaActual === 'clp' ? RAYO.mercadoPago[plan] : '');

function usarMoneda(moneda) {
  monedaActual = moneda;
  document.querySelectorAll('[data-moneda]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.moneda === moneda)));
  document.querySelectorAll(`[data-${moneda}]`).forEach((el) => {
    if (el.textContent === el.dataset[moneda]) return;
    el.textContent = el.dataset[moneda];
    // Reinicia la animación del precio que cambia
    el.classList.remove('cambia');
    void el.offsetWidth;
    el.classList.add('cambia');
  });

  const conMercadoPago = Boolean(linkMercadoPago('pro') || linkMercadoPago('elite'));
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



// Popup de compra. Sin JavaScript, «Comprar» sigue llevando al Discord.
const pop = document.querySelector('.pop');
const formulario = pop.querySelector('form');
const errorForm = pop.querySelector('.pop__error');
const botonEnviar = formulario.querySelector('[type="submit"]');
const pintar = (clave, texto) => pop.querySelectorAll(`[data-pop="${clave}"]`).forEach((el) => { el.textContent = texto; });
let planElegido = 'pro';
let pedidoGuardado = ''; // plan y datos del último pedido guardado: evita filas repetidas
try { pedidoGuardado = sessionStorage.getItem('rayo-pedido') || ''; } catch (e) { /* sin almacenamiento */ }
// Lo que incluye cada plan, repetido en el popup al momento de pagar
const INCLUYE = {
  pro: 'Incluye las 87 optimizaciones, perfiles, configs para 18 juegos, quitar apps de más y medir tus FPS.',
  elite: 'Incluye todo lo de Pro, más overlay en pantalla, Modo Juego automático, perfiles propios y mantenimiento.',
};

// Contra spam, la planilla exige un permiso firmado de un solo uso, pedido al
// abrir el formulario, y que pasen al menos 4 s antes de enviar el pedido
const ESPERA_MINIMA = 4500; // un poco más que los 4 s que exige el script
const DURACION_PERMISO = 50 * 60 * 1000; // el script los acepta hasta 60 min
const limiteTiempo = (ms) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
const esperar = (ms) => new Promise((listo) => { setTimeout(listo, ms); });
let permiso = null; // promesa de { token, desde }

function pedirPermiso() {
  permiso = fetch(`${RAYO.planillaPedidos}?accion=token`, { signal: limiteTiempo(12000) })
    .then((r) => r.json())
    .then((d) => (d.token ? { token: d.token, desde: Date.now() } : null))
    .catch(() => null);
  return permiso;
}

async function permisoListo() {
  let p = await permiso;
  if (!p || Date.now() - p.desde > DURACION_PERMISO) p = await pedirPermiso();
  if (p) await esperar(ESPERA_MINIMA - (Date.now() - p.desde));
  permiso = null; // cada permiso sirve para un solo envío
  return p ? p.token : '';
}

function irA(paso) {
  pop.dataset.paso = paso;
  pop.querySelectorAll('[data-paso]').forEach((p) => { p.hidden = p.dataset.paso !== paso; });
  const primero = pop.querySelector(`[data-paso="${paso}"]`).querySelector('input, button:not(.pop__volver), a');
  if (primero) primero.focus({ preventScroll: true });
  if (paso === 'datos' && RAYO.planillaPedidos && !permiso) pedirPermiso();
}

document.querySelectorAll('[data-comprar]').forEach((boton) => boton.addEventListener('click', (e) => {
  e.preventDefault();
  planElegido = boton.dataset.comprar;
  const plan = boton.closest('.plan');
  pintar('plan', plan.querySelector('.plan__name').textContent);
  pintar('precio', plan.querySelector('.plan__amount').textContent);
  pintar('unidad', plan.querySelector('.plan__unit').textContent);
  pintar('incluye', INCLUYE[planElegido] || '');

  // Sin Mercado Pago (en USD o sin link) se va directo a la compra por Discord
  const conMercadoPago = Boolean(linkMercadoPago(planElegido));
  pop.querySelector('[data-ir="datos"]').hidden = !conMercadoPago;
  pop.querySelector('[data-paso="discord"] .pop__volver').hidden = !conMercadoPago;
  pintar('etapaDiscord', conMercadoPago ? 'Paso 2 de 2 · Paga por Discord' : 'Paga por Discord');
  errorForm.hidden = true;
  [formulario.elements.nombre, formulario.elements.correo, formulario.elements.numero].forEach(limpiarError);
  if (pedidoGuardado.startsWith(`${planElegido}|`)) {
    const [, nombre, correo, numero] = pedidoGuardado.split('|');
    Object.assign(formulario.elements.nombre, { value: nombre });
    Object.assign(formulario.elements.correo, { value: correo });
    Object.assign(formulario.elements.numero, { value: numero });
    pintar('nombre', nombre.split(' ')[0]);
    pintar('correo', correo);
    pop.querySelector('[data-pop="pagar"]').href = linkMercadoPago(planElegido);
  }
  pop.showModal();
  // Si ya dejó sus datos para este plan, vuelve directo al pago
  irA(!conMercadoPago ? 'discord' : pedidoGuardado.startsWith(`${planElegido}|`) ? 'pagar' : 'elegir');
}));

pop.addEventListener('click', (e) => {
  const destino = e.target.closest('[data-ir]');
  if (destino) irA(destino.dataset.ir);
  else if (e.target === pop || e.target.closest('[data-cerrar]')) pop.close();
});

// Cada error va bajo su campo; se revisan los tres de una vez
function marcarError(campo, mensaje) {
  const aviso = document.getElementById(`err-${campo.name}`);
  aviso.textContent = mensaje;
  aviso.hidden = false;
  campo.setAttribute('aria-invalid', 'true');
}
function limpiarError(campo) {
  campo.removeAttribute('aria-invalid');
  const aviso = document.getElementById(`err-${campo.name}`);
  if (aviso) aviso.hidden = true;
}

const REGLAS = {
  nombre: [(v) => v.length >= 2, 'Escribe tu nombre y apellido.'],
  correo: [(v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Revisa tu correo: debe ser como nombre@correo.com.'],
  numero: [(v) => v.replace(/\D/g, '').length >= 8, 'Escribe tu número con código de área, por ejemplo +56 9 1234 5678.'],
};
function revisar(campo) {
  const [vale, mensaje] = REGLAS[campo.name];
  if (vale(campo.value.trim())) limpiarError(campo);
  else marcarError(campo, mensaje);
}

formulario.addEventListener('input', (e) => limpiarError(e.target));
// Al salir de un campo ya escrito se avisa de inmediato, sin esperar a enviar
formulario.addEventListener('focusout', (e) => { if (REGLAS[e.target.name] && e.target.value.trim()) revisar(e.target); });

formulario.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorForm.hidden = true;
  const campos = formulario.elements;
  const nombre = campos.nombre.value.trim();
  const correo = campos.correo.value.trim();
  const numero = campos.numero.value.trim();
  [campos.nombre, campos.correo, campos.numero].forEach(revisar);
  const primerError = formulario.querySelector('[aria-invalid]');
  if (primerError) { primerError.focus(); return; }

  botonEnviar.disabled = true;
  botonEnviar.setAttribute('aria-busy', 'true');
  botonEnviar.querySelector('span').textContent = 'Guardando tu pedido…';
  const pedido = [planElegido, nombre, correo, numero].join('|');
  let guardado = pedido === pedidoGuardado; // mismo pedido: no se envía otra vez
  if (guardado) {
    // nada que enviar
  } else if (campos.sitio.value) {
    guardado = true; // campo trampa lleno: es un bot, no se envía nada
  } else if (RAYO.planillaPedidos) {
    const enviar = async () => {
      try {
        const respuesta = await fetch(RAYO.planillaPedidos, {
          method: 'POST',
          body: new URLSearchParams({ plan: planElegido, nombre, correo, numero, token: await permisoListo() }),
          signal: limiteTiempo(12000),
        });
        return await respuesta.json();
      } catch (err) { return { ok: false }; }
    };
    let resultado = await enviar();
    // Permiso vencido o rechazado (p. ej. el formulario quedó abierto mucho rato): un reintento
    if (resultado.motivo === 'token') resultado = await enviar();
    guardado = resultado.ok === true;
  } else {
    console.warn('Rayo web: falta planillaPedidos en js/main.js; el pedido no se guardó.');
  }
  botonEnviar.disabled = false;
  botonEnviar.removeAttribute('aria-busy');
  botonEnviar.querySelector('span').textContent = 'Continuar al pago';

  if (guardado && !campos.sitio.value) {
    pedidoGuardado = pedido;
    try { sessionStorage.setItem('rayo-pedido', pedido); } catch (err) { /* sin almacenamiento */ }
  }
  pintar('nombre', nombre.split(' ')[0]);
  pintar('correo', correo);
  pop.querySelector('[data-pop="sinConfirmar"]').hidden = guardado;
  pop.querySelector('[data-pop="pagar"]').href = linkMercadoPago(planElegido);
  irA('pagar');
});

// Descargar: en Windows baja el archivo y muestra los pasos de instalación;
// en celular o Mac ofrece enviarse el enlace para abrirlo en el PC
const plataforma = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.userAgent;
const esWindows = /windows/i.test(plataforma);

// Fuera de Windows (casi siempre un celular) lo que se puede hacer es comprar:
// «Ver planes» pasa a ser el botón principal de la portada
if (!esWindows) {
  const descargaHero = document.querySelector('.hero__ctas [data-descarga]');
  const planesHero = document.querySelector('.hero__ctas a[href="#precios"]');
  if (descargaHero && planesHero) {
    descargaHero.classList.replace('btn--primary', 'btn--ghost');
    planesHero.classList.replace('btn--ghost', 'btn--primary');
    planesHero.after(descargaHero);
  }
}
const alPc = document.querySelector('.al-pc');
const enlaceWeb = `${location.origin}${location.pathname}#ayuda`;
const estado = alPc.querySelector('.al-pc__estado');
const compartir = alPc.querySelector('[data-compartir]');

document.querySelectorAll('[data-descarga]').forEach((el) => el.addEventListener('click', (e) => {
  if (!esWindows) {
    e.preventDefault();
    estado.textContent = '';
    alPc.showModal();
    return;
  }
  // La descarga sigue su curso; mientras, se abre Ayuda con los pasos de instalación
  document.querySelector('.dl__ok').hidden = false;
  const instalar = document.getElementById('instalar');
  instalar.open = true;
  document.getElementById('smartscreen').open = true;
  irAVista('ayuda');
  setTimeout(() => instalar.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
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

const nav = document.querySelector('.nav');

// Al hacer scroll: fondo de la barra, barra de progreso y la captura de la
// portada que se endereza (de 7° a 0° en los primeros 500 px)
const progreso = document.querySelector('.progreso');
let scrollPendiente = false;

function alHacerScroll() {
  scrollPendiente = false;
  const y = window.scrollY;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  nav.classList.toggle('is-scrolled', y > 8);
  progreso.style.transform = `scaleX(${total > 0 ? Math.min(1, y / total) : 0})`;
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
  // La captura nueva llega desde el lado de la pestaña elegida
  const antes = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  const ahora = tabs.indexOf(tab);
  if (antes !== ahora) document.querySelector('.tour__panels').dataset.dir = ahora > antes ? 'adelante' : 'atras';
  document.querySelector('.tour__cuenta').textContent = `${ahora + 1} de ${tabs.length} · desliza para ver más`;
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
document.querySelectorAll('.games, .garantias, .plans__notes, .ticks').forEach((lista) => {
  [...lista.children].forEach((hijo, i) => hijo.style.setProperty('--i', i));
});

// Brillo que sigue al mouse en las tarjetas (solo con mouse, no en pantallas táctiles)
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.plan, .game, .dl__card').forEach((el) => el.classList.add('spot'));
  document.addEventListener('pointermove', (e) => {
    const tarjeta = e.target.closest('.spot');
    if (!tarjeta) return;
    const caja = tarjeta.getBoundingClientRect();
    tarjeta.style.setProperty('--mx', `${e.clientX - caja.left}px`);
    tarjeta.style.setProperty('--my', `${e.clientY - caja.top}px`);
  }, { passive: true });

  // Luz naranja suave que sigue al mouse por el fondo de la página
  const luz = document.createElement('div');
  luz.className = 'luz';
  luz.setAttribute('aria-hidden', 'true');
  document.body.prepend(luz);
  let luzPendiente = false;
  let luzX = 0;
  let luzY = 0;
  document.addEventListener('pointermove', (e) => {
    luzX = e.clientX;
    luzY = e.clientY;
    if (luzPendiente) return;
    luzPendiente = true;
    requestAnimationFrame(() => {
      luzPendiente = false;
      // Al aparecer se ubica de inmediato; después sigue al mouse con un leve retraso
      const recienAparece = !luz.classList.contains('is-on');
      if (recienAparece) luz.style.transitionProperty = 'opacity';
      luz.style.transform = `translate3d(${luzX}px, ${luzY}px, 0)`;
      luz.classList.add('is-on');
      if (recienAparece) requestAnimationFrame(() => { luz.style.transitionProperty = ''; });
    });
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => luz.classList.remove('is-on'));
}

// Títulos que aparecen palabra por palabra (la animación está en el CSS y se
// repite cada vez que se abre la pantalla)
document.querySelectorAll('.vista h1, .vista .section__head h2').forEach((titulo) => {
  let orden = 0;
  const separar = (nodo) => {
    [...nodo.childNodes].forEach((hijo) => {
      if (hijo.nodeType === Node.TEXT_NODE) {
        const trozos = hijo.textContent.split(/(\s+)/).filter(Boolean);
        hijo.replaceWith(...trozos.map((trozo) => {
          if (/^\s+$/.test(trozo)) return trozo;
          const palabra = document.createElement('span');
          palabra.className = 'palabra';
          palabra.style.setProperty('--p', orden++);
          palabra.textContent = trozo;
          return palabra;
        }));
      } else if (hijo.classList.contains('grad')) {
        // El texto con degradado aparece como un solo bloque
        hijo.classList.add('palabra');
        hijo.style.setProperty('--p', orden++);
      } else {
        separar(hijo);
      }
    });
  };
  separar(titulo);
});

// Fondo de todas las pantallas: chispas que suben y un rayo que cae cada tantos segundos
const cielo = document.querySelector('.cielo');
if (cielo) {
  const azar = (min, max) => min + Math.random() * (max - min);
  const cuantas = window.innerWidth < 640 ? 14 : 26;
  for (let n = 0; n < cuantas; n += 1) {
    const chispa = document.createElement('span');
    chispa.className = 'chispa';
    chispa.style.cssText = [
      `--x:${azar(2, 98).toFixed(1)}%`,
      `--y:${azar(12, 78).toFixed(1)}%`,
      `--t:${azar(1.5, 3.6).toFixed(1)}px`,
      `--d:${azar(6, 12).toFixed(1)}s`,
      `--r:-${azar(0, 12).toFixed(1)}s`, // empiezan ya en vuelo
      `--dx:${azar(-60, 60).toFixed(0)}px`,
      `--dy:-${azar(160, 320).toFixed(0)}px`,
      `--o:${azar(0.45, 0.95).toFixed(2)}`,
    ].join(';');
    cielo.append(chispa);
  }

  const SVG = 'http://www.w3.org/2000/svg';
  const dibujo = document.createElementNS(SVG, 'svg');
  const destello = document.createElement('div');
  destello.className = 'cielo__flash';
  cielo.prepend(destello);
  cielo.append(dibujo);

  // Línea quebrada hacia abajo desde (x, y) hasta la altura «hasta»
  const zigzag = (x, y, hasta, abre) => {
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const puntos = [];
    while (y < hasta) {
      y += azar(18, 42);
      x += azar(-abre, abre);
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      puntos.push([x, y]);
    }
    return { d, puntos };
  };

  const caerRayo = () => {
    const ancho = cielo.clientWidth;
    const alto = cielo.clientHeight;
    if (!ancho) return;
    dibujo.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
    const x = ancho * azar(0.12, 0.88);
    const largo = Math.min(alto * 0.55, 460) * azar(0.7, 1);
    const tronco = zigzag(x, -10, largo, 26);
    const [rx, ry] = tronco.puntos[Math.floor(tronco.puntos.length * azar(0.3, 0.6))];
    const rama = zigzag(rx, ry, ry + largo * azar(0.2, 0.4), 22);
    dibujo.replaceChildren();
    [[tronco.d, 'rayo-trazo'], [rama.d, 'rayo-trazo rayo-trazo--rama']].forEach(([d, clase]) => {
      const trazo = document.createElementNS(SVG, 'path');
      trazo.setAttribute('d', d);
      trazo.setAttribute('class', clase);
      dibujo.append(trazo);
      const total = trazo.getTotalLength();
      trazo.style.strokeDasharray = total;
      trazo.animate([{ strokeDashoffset: total }, { strokeDashoffset: 0 }], { duration: 140, easing: 'ease-out', fill: 'forwards' });
    });
    dibujo.animate(
      [{ opacity: 1 }, { opacity: 0.25, offset: 0.2 }, { opacity: 1, offset: 0.32 }, { opacity: 0 }],
      { duration: 750, delay: 120, easing: 'ease-out', fill: 'both' },
    );
    destello.style.setProperty('--rx', `${((x / ancho) * 100).toFixed(1)}%`);
    destello.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0.3, offset: 0.3 }, { opacity: 0.8, offset: 0.42 }, { opacity: 0 }],
      { duration: 900, delay: 100, easing: 'ease-out' },
    );
  };

  // Solo cae con la pestaña abierta
  const programarRayo = (espera) => {
    setTimeout(() => {
      if (!document.hidden && !document.documentElement.classList.contains('fondo-pausado')) caerRayo();
      programarRayo(azar(5500, 9500));
    }, espera);
  };
  programarRayo(1600);
}

// Botón del pie para pausar el fondo animado; la elección se recuerda
const pausa = document.querySelector('.pausa');
if (pausa) {
  const ponerPausa = (pausado) => {
    document.documentElement.classList.toggle('fondo-pausado', pausado);
    pausa.setAttribute('aria-pressed', String(pausado));
    pausa.textContent = pausado ? 'Reanudar fondo animado' : 'Pausar fondo animado';
  };
  let guardado = false;
  try { guardado = localStorage.getItem('rayo-fondo') === 'pausado'; } catch (e) { /* sin almacenamiento */ }
  ponerPausa(guardado);
  pausa.addEventListener('click', () => {
    const pausado = !document.documentElement.classList.contains('fondo-pausado');
    ponerPausa(pausado);
    try { localStorage.setItem('rayo-fondo', pausado ? 'pausado' : 'activo'); } catch (e) { /* sin almacenamiento */ }
  });
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

// Pantallas: el <head> elige la primera según el #hash (data-vista en <html>).
// Los enlaces #pantalla cambian de pantalla sin recargar y atrás/adelante
// del navegador funcionan.
const enlacesVista = document.querySelectorAll('.tabbar a');

const TITULO = document.title;
const ORDEN_VISTAS = ['inicio', 'funciones', 'juegos', 'precios', 'ayuda', 'updates'];
const tabbar = document.querySelector('.tabbar');

function mostrarVista(vista) {
  const enlace = document.querySelector(`.tabbar a[href="#${vista}"]`);
  document.title = vista === 'inicio' ? TITULO : `${enlace.textContent.trim()} · Rayo`;
  // La pantalla nueva entra desde la derecha si avanzas y desde la izquierda si vuelves
  const paso = ORDEN_VISTAS.indexOf(vista) - ORDEN_VISTAS.indexOf(document.documentElement.dataset.vista);
  if (paso) document.documentElement.dataset.dir = paso > 0 ? 'adelante' : 'atras';
  // La pantalla que dejas ya no repite su entrada (títulos y bloques) al volver
  const anterior = document.getElementById(document.documentElement.dataset.vista);
  if (anterior && anterior.id !== vista) anterior.classList.add('ya-vista');
  document.documentElement.dataset.vista = vista;
  enlacesVista.forEach((a) => {
    if (a.getAttribute('href') === `#${vista}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  // La píldora de la barra se desliza a la pantalla actual
  tabbar.style.setProperty('--tab', ORDEN_VISTAS.indexOf(vista));
  window.scrollTo(0, 0);
  alHacerScroll();
}

function irAVista(vista) {
  if (document.documentElement.dataset.vista === vista) return;
  history.pushState(null, '', `#${vista}`);
  mostrarVista(vista);
  // Solo cuando la persona cambia de pantalla: el foco va al título para que se anuncie
  const titulo = document.querySelector(`#${vista} h1, #${vista} h2`);
  if (titulo) { titulo.tabIndex = -1; titulo.focus({ preventScroll: true }); }
}

document.addEventListener('click', (e) => {
  const abrir = e.target.closest('[data-abrir]');
  if (abrir) {
    const pregunta = document.getElementById(abrir.dataset.abrir);
    pregunta.open = true;
    setTimeout(() => pregunta.scrollIntoView({ block: 'center' }), 350); // tras el cambio de pantalla
  }
  const enlace = e.target.closest('a[href^="#"]');
  const vista = enlace && vistaDesdeHash(enlace.getAttribute('href').slice(1));
  if (!vista || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  if (document.documentElement.dataset.vista === vista) window.scrollTo({ top: 0, behavior: 'smooth' });
  else irAVista(vista);
});

const vistaDeLaUrl = () => vistaDesdeHash(location.hash.slice(1)) || 'inicio';
window.addEventListener('popstate', () => mostrarVista(vistaDeLaUrl()));
window.addEventListener('hashchange', () => mostrarVista(vistaDeLaUrl()));
mostrarVista(document.documentElement.dataset.vista);
