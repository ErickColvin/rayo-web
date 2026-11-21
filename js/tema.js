// La página se ve por pantallas (Inicio, Funciones, Juegos, Precios, Ayuda).
// Se elige aquí, antes de dibujar, según el #hash; enlaces viejos como
// #descargar o #preguntas llevan a su pantalla nueva.
window.vistaDesdeHash = function (hash) {
  var alias = { top: 'inicio', seguridad: 'funciones', descargar: 'ayuda', instalar: 'ayuda', smartscreen: 'ayuda', preguntas: 'ayuda', comprar: 'precios', novedades: 'updates' };
  var id = alias[hash] || hash;
  return ['inicio', 'funciones', 'juegos', 'precios', 'ayuda', 'updates'].indexOf(id) >= 0 ? id : null;
};
document.documentElement.classList.add('js');
document.documentElement.dataset.vista = vistaDesdeHash(location.hash.slice(1)) || 'inicio';
