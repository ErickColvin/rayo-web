/**
 * Rayo · pedidos de la web en una planilla de Google
 *
 * Guarda cada pedido con Mercado Pago (plan, nombre, correo y número) como una
 * fila de la hoja «Pedidos». Así puedes cruzarlo con el pago en Mercado Pago y
 * con el ticket de Discord antes de entregar la clave.
 *
 * Protección contra spam (la URL de este script es pública en la web):
 *  - Cada formulario pide antes un permiso firmado de un solo uso.
 *  - Se rechaza lo enviado menos de 4 segundos después de pedir el permiso.
 *  - Límites por correo o número, por hora y por día (ver LIMITES).
 *  - El mismo pedido repetido en 10 minutos no crea otra fila.
 *
 * Cómo instalarlo (una sola vez):
 *  1. Crea una planilla en Google Sheets, por ejemplo «Pedidos Rayo».
 *  2. En la planilla: Extensiones → Apps Script. Borra lo que haya, pega todo
 *     este archivo y guarda (Ctrl + S).
 *  3. Implementar → Nueva implementación → tipo «Aplicación web».
 *       Ejecutar como: Yo
 *       Quién tiene acceso: Cualquier usuario
 *     Pulsa Implementar y autoriza con tu cuenta. Si Google avisa que la app
 *     no está verificada: Configuración avanzada → Ir a … (es tu propio script).
 *  4. Copia la URL de la aplicación web (termina en /exec) y pégala en
 *     planillaPedidos, al inicio de js/main.js.
 *
 * Si después cambias este código: Implementar → Administrar implementaciones →
 * editar (lápiz) → Versión: Nueva versión → Implementar. La URL no cambia.
 */

const HOJA = 'Pedidos';
const ZONA = 'America/Santiago';
const PLANES = {
  pro: { nombre: 'Pro', monto: 3990 },
  elite: { nombre: 'Elite', monto: 6990 },
};
const COLUMNAS = ['Fecha', 'Plan', 'Monto (CLP)', 'Nombre', 'Correo', 'Número', 'Estado', 'Clave entregada'];

// Límites contra spam: una venta real nunca llega a ellos
const LIMITES = {
  minSegundos: 4,  // tiempo mínimo entre pedir el permiso y enviar el pedido
  maxMinutos: 60,  // cuánto dura un permiso
  porContacto: 3,  // pedidos por hora con el mismo correo o número
  porHora: 30,     // pedidos por hora en total
  porDia: 150,     // pedidos por día en total
};

// ?accion=token entrega el permiso del formulario; sin parámetros sirve para
// comprobar en el navegador que el script está funcionando
function doGet(e) {
  if (e && e.parameter && e.parameter.accion === 'token') return responder({ ok: true, token: crearToken() });
  return ContentService.createTextOutput('Pedidos de Rayo: funcionando.');
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (!tokenValido(p.token)) return responder({ ok: false, motivo: 'token' });

  const plan = PLANES[p.plan];
  const nombre = limpiar(p.nombre, 80);
  const correo = limpiar(p.correo, 120).toLowerCase();
  const numero = limpiar(p.numero, 30);
  const digitos = numero.replace(/\D/g, '');
  const valido = plan
    && nombre.length >= 2
    && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)
    && digitos.length >= 8;
  if (!valido) return responder({ ok: false, motivo: 'datos' });

  const candado = LockService.getScriptLock();
  candado.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache();

    // Cada permiso sirve una sola vez
    if (cache.get(`usado:${p.token}`)) return responder({ ok: false, motivo: 'token' });
    cache.put(`usado:${p.token}`, '1', LIMITES.maxMinutos * 60);

    // Doble clic o reenvío del mismo pedido: ya quedó guardado
    const repetido = `rep:${plan.nombre}:${correo}`;
    if (cache.get(repetido)) return responder({ ok: true });

    const contactos = [`c:${correo}`, `n:${digitos}`];
    if (contactos.some((k) => Number(cache.get(k) || 0) >= LIMITES.porContacto)) return responder({ ok: false, motivo: 'limite' });
    if (!usarCupo()) return responder({ ok: false, motivo: 'limite' });

    // El número siempre como texto, para no perder el + ni los ceros
    hoja().appendRow([new Date(), plan.nombre, plan.monto, texto(nombre), texto(correo), `'${numero}`, 'Pendiente', '']);
    cache.put(repetido, '1', 600);
    contactos.forEach((k) => cache.put(k, String(Number(cache.get(k) || 0) + 1), 3600));
  } finally {
    candado.releaseLock();
  }
  return responder({ ok: true });
}

function hoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(HOJA);
  if (!h) h = libro.insertSheet(HOJA);
  if (h.getLastRow() === 0) {
    h.appendRow(COLUMNAS);
    h.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

// Cupos por hora y por día (hora de Chile), en las propiedades del script.
// Se llama con el candado tomado.
function usarCupo() {
  const props = PropertiesService.getScriptProperties();
  const ahora = new Date();
  const cupos = [
    ['cupoHora', Utilities.formatDate(ahora, ZONA, 'yyyy-MM-dd HH'), LIMITES.porHora],
    ['cupoDia', Utilities.formatDate(ahora, ZONA, 'yyyy-MM-dd'), LIMITES.porDia],
  ].map(([clave, periodo, maximo]) => {
    const [guardado, usados] = (props.getProperty(clave) || '').split('|');
    return { clave, periodo, maximo, usados: guardado === periodo ? Number(usados) : 0 };
  });
  if (cupos.some((c) => c.usados >= c.maximo)) return false;
  cupos.forEach((c) => props.setProperty(c.clave, `${c.periodo}|${c.usados + 1}`));
  return true;
}

// Permiso = momento de creación + firma HMAC con un secreto que solo conoce
// este script (se crea solo la primera vez y queda en sus propiedades)
function secreto() {
  const props = PropertiesService.getScriptProperties();
  let valor = props.getProperty('SECRETO');
  if (!valor) {
    valor = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SECRETO', valor);
  }
  return valor;
}

function firmar(textoPlano) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(textoPlano, secreto()));
}

function crearToken() {
  const momento = String(Date.now());
  return `${momento}.${firmar(momento)}`;
}

function tokenValido(token) {
  const [momento, firma] = String(token || '').split('.');
  if (!/^\d{13}$/.test(momento || '') || !firma || firmar(momento) !== firma) return false;
  const segundos = (Date.now() - Number(momento)) / 1000;
  return segundos >= LIMITES.minSegundos && segundos <= LIMITES.maxMinutos * 60;
}

function limpiar(valor, largo) {
  return String(valor || '').replace(/\s+/g, ' ').trim().slice(0, largo);
}

// Sheets ejecuta como fórmula lo que empieza con = + - @: el apóstrofo lo
// guarda como texto (y no se ve en la celda)
function texto(valor) {
  return /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
}

function responder(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos))
    .setMimeType(ContentService.MimeType.JSON);
}
