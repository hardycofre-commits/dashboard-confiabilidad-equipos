const CONFIG = {
  owner: 'hardycofre-commits',
  repo: 'dashboard-confiabilidad-equipos',
  branch: 'main',
  folder: 'datos'
};

const MAPEO_UNIDADES_BASE = [
  { buscar: 'HATCHERY', unidad: 'Hat' },
  { buscar: 'HAT', unidad: 'Hat' },
  { buscar: 'FF2', unidad: 'FF' },
  { buscar: 'FF', unidad: 'FF' },
  { buscar: 'ALEVINAJE', unidad: 'Alev' },
  { buscar: 'ALEV', unidad: 'Alev' },
  { buscar: 'PRE-SMOLT', unidad: 'Pre' },
  { buscar: 'PRE SMOLT', unidad: 'Pre' },
  { buscar: 'PRESMOLT', unidad: 'Pre' },
  { buscar: 'RILES', unidad: 'Riles' },
  { buscar: 'FILTRADO', unidad: 'Filtrado' },
  { buscar: 'FILTRO', unidad: 'Filtrado' },
  { buscar: 'GEN', unidad: 'Generadores' },
  { buscar: 'GENERADOR', unidad: 'Generadores' }
];

const STORAGE_KEY = 'dashboardConfiabilidad_mapeoUnidades_v1';
const STORAGE_UNIDADES_KEY = 'dashboardConfiabilidad_unidadesPersonalizadas_v1';
let MAPEO_USUARIO = cargarMapeoUsuario();
let UNIDADES_USUARIO = cargarUnidadesUsuario();

const btnActualizar = document.getElementById('btnActualizar');
const btnVolverNormal = document.getElementById('btnVolverNormal');
const cardSinClasificar = document.getElementById('cardSinClasificar');

const modalAsignacion = document.getElementById('modalAsignacion');
const modalEquipo = document.getElementById('modalEquipo');
const modalUnidad = document.getElementById('modalUnidad');
const nuevaUnidadBox = document.getElementById('nuevaUnidadBox');
const nuevaUnidadInput = document.getElementById('nuevaUnidadInput');
const btnCancelarAsignacion = document.getElementById('btnCancelarAsignacion');
const btnGuardarAsignacion = document.getElementById('btnGuardarAsignacion');

const kArchivo = document.getElementById('kArchivo');
const kArchivoGantt = document.getElementById('kArchivoGantt');
const kEquipos = document.getElementById('kEquipos');
const kAvisos = document.getElementById('kAvisos');
const kSinClasificar = document.getElementById('kSinClasificar');
const kBloquesLYD = document.getElementById('kBloquesLYD');
const txtRegistros = document.getElementById('txtRegistros');
const txtArchivo = document.getElementById('txtArchivo');
const txtGantt = document.getElementById('txtGantt');
const txtLectura = document.getElementById('txtLectura');
const txtFiltro = document.getElementById('txtFiltro');

const fechaDesde = document.getElementById('fechaDesde');
const fechaHasta = document.getElementById('fechaHasta');
const busquedaEquipo = document.getElementById('busquedaEquipo');
const sugerenciasEquipo = document.getElementById('sugerenciasEquipo');
const equipoFiltro = document.getElementById('equipoFiltro');

const estadoValidacion = document.getElementById('estadoValidacion');
const validacionDetalle = document.getElementById('validacionDetalle');
const filasBase = document.getElementById('filasBase');
const filasLYD = document.getElementById('filasLYD');

const tablaBase = document.getElementById('tablaBase');
const theadBase = tablaBase.querySelector('thead');
const tbodyBase = tablaBase.querySelector('tbody');

const tablaLYD = document.getElementById('tablaLYD');
const theadLYD = tablaLYD.querySelector('thead');
const tbodyLYD = tablaLYD.querySelector('tbody');

let datosOriginales = [];
let datosBase = [];
let bloquesLYD = [];
let mapaColumnas = {};
let listaEquipos = [];
let filtroSoloSinClasificar = false;
let textoParaAsignar = '';

document.addEventListener('DOMContentLoaded', () => {
  configurarFechasFijas();
  cargarDesdeGitHub();
});

btnActualizar.addEventListener('click', cargarDesdeGitHub);

cardSinClasificar.addEventListener('click', () => {
  filtroSoloSinClasificar = true;
  busquedaEquipo.value = '';
  equipoFiltro.value = '';
  btnVolverNormal.classList.remove('hidden');
  aplicarFiltros();
});

btnVolverNormal.addEventListener('click', () => {
  filtroSoloSinClasificar = false;
  btnVolverNormal.classList.add('hidden');
  aplicarFiltros();
});

equipoFiltro.addEventListener('change', () => {
  filtroSoloSinClasificar = false;
  btnVolverNormal.classList.add('hidden');
  busquedaEquipo.value = equipoFiltro.value;
  ocultarSugerencias();
  aplicarFiltros();
});

busquedaEquipo.addEventListener('input', () => {
  filtroSoloSinClasificar = false;
  btnVolverNormal.classList.add('hidden');
  equipoFiltro.value = '';
  mostrarSugerencias(busquedaEquipo.value.trim());
  aplicarFiltros();
});

busquedaEquipo.addEventListener('focus', () => mostrarSugerencias(busquedaEquipo.value.trim()));

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-field')) ocultarSugerencias();
});

fechaDesde.addEventListener('change', aplicarFiltros);
fechaHasta.addEventListener('change', aplicarFiltros);

btnCancelarAsignacion.addEventListener('click', cerrarModalAsignacion);
btnGuardarAsignacion.addEventListener('click', guardarAsignacionUnidad);
modalUnidad.addEventListener('change', controlarNuevaUnidad);

function configurarFechasFijas(){
  fechaDesde.value = '2025-01-01';
  fechaHasta.value = '2026-12-31';
}

async function cargarDesdeGitHub(){
  try{
    limpiarEstadoCarga();
    setEstado('Buscando', 'warning', 'Consultando carpeta datos/ en GitHub...');

    const archivos = await listarArchivosDatos();
    const archivoSAP = seleccionarUltimoArchivo(archivos, esArchivoSAP);
    const archivoGantt = seleccionarUltimoArchivo(archivos, esArchivoGantt);

    if(!archivoSAP){
      throw new Error('No se encontró archivo SAP/EXPORT en carpeta datos.');
    }

    await cargarSAP(archivoSAP);

    if(archivoGantt){
      await cargarGantt(archivoGantt);
    }else{
      kArchivoGantt.textContent = 'No encontrado';
      txtGantt.textContent = 'Sin archivo Gantt';
      bloquesLYD = [];
      renderTablaLYD([]);
    }

    txtLectura.textContent = new Date().toLocaleString('es-CL');
    setEstado('Validado', 'ok', generarResumenValidacion(archivoSAP, archivoGantt));
  }catch(error){
    mostrarError(error.message);
    console.error(error);
  }
}

function limpiarEstadoCarga(){
  kArchivo.textContent = 'Buscando archivo...';
  kArchivoGantt.textContent = 'Buscando gantt...';
  txtArchivo.textContent = 'Sin archivo SAP';
  txtGantt.textContent = 'Sin archivo Gantt';
}

async function listarArchivosDatos(){
  const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.folder}?ref=${CONFIG.branch}`;
  const response = await fetch(apiUrl + '&t=' + Date.now());

  if(!response.ok){
    throw new Error('No fue posible leer la carpeta datos desde GitHub. Revisa que exista la carpeta datos y que el repositorio sea público.');
  }

  return await response.json();
}

function esArchivoSAP(item){
  const n = normalizar(item.name);
  return item.type === 'file' &&
    /\.(xlsx|xls)$/i.test(item.name) &&
    (n.includes('sap') || n.includes('export')) &&
    !n.includes('gantt');
}

function esArchivoGantt(item){
  const n = normalizar(item.name);
  return item.type === 'file' &&
    /\.(xlsx|xls)$/i.test(item.name) &&
    n.includes('gantt');
}

function seleccionarUltimoArchivo(archivos, filtro){
  const seleccion = archivos
    .filter(filtro)
    .sort((a,b) => compararArchivos(a.name, b.name));

  return seleccion.length ? seleccion[seleccion.length - 1] : null;
}

async function cargarSAP(archivo){
  setEstado('Cargando', 'warning', `Archivo SAP detectado: ${archivo.name}<br>Descargando y procesando...`);

  const rows = await leerExcelDesdeUrl(archivo.download_url, 'json');

  datosOriginales = rows;
  const columnas = rows.length ? Object.keys(rows[0]) : [];
  mapaColumnas = detectarColumnas(columnas);

  kArchivo.textContent = archivo.name;
  txtArchivo.textContent = archivo.name;
  txtRegistros.textContent = `${rows.length.toLocaleString('es-CL')} registros SAP leídos`;

  cargarFiltroEquipos(rows);
  aplicarFiltros();
}

async function cargarGantt(archivo){
  kArchivoGantt.textContent = archivo.name;
  txtGantt.textContent = archivo.name;

  const matriz = await leerExcelDesdeUrl(archivo.download_url, 'array');
  bloquesLYD = extraerBloquesLYD(matriz);

  renderTablaLYD(bloquesLYD);
  kBloquesLYD.textContent = bloquesLYD.length.toLocaleString('es-CL');
  filasLYD.textContent = `${bloquesLYD.length.toLocaleString('es-CL')} bloques`;
}

async function leerExcelDesdeUrl(url, modo){
  const response = await fetch(url + '?v=' + Date.now());

  if(!response.ok){
    throw new Error('No fue posible descargar un archivo desde GitHub.');
  }

  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, {type:'array', cellDates:true});
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  if(modo === 'array'){
    return XLSX.utils.sheet_to_json(sheet, {header:1, defval:''});
  }

  return XLSX.utils.sheet_to_json(sheet, {defval:''});
}

function extraerBloquesLYD(matriz){
  if(!matriz || !matriz.length) return [];

  const columnas = detectarColumnasGantt(matriz);
  const bloques = [];

  columnas.forEach(col => {
    let inicio = null;
    let fin = null;

    for(let r = col.filaInicioDatos; r < matriz.length; r++){
      const fecha = convertirFecha(matriz[r]?.[0]);
      if(!fecha) continue;

      const valor = normalizar(matriz[r]?.[col.indice]);
      const esLYD = valor.includes('lyd');

      if(esLYD && !inicio){
        inicio = fecha;
        fin = fecha;
      }else if(esLYD && inicio){
        const diferenciaDias = Math.round((fecha - fin) / 86400000);
        if(diferenciaDias <= 1){
          fin = fecha;
        }else{
          bloques.push(crearBloqueLYD(col.unidad, inicio, fin));
          inicio = fecha;
          fin = fecha;
        }
      }else if(!esLYD && inicio){
        bloques.push(crearBloqueLYD(col.unidad, inicio, fin));
        inicio = null;
        fin = null;
      }
    }

    if(inicio){
      bloques.push(crearBloqueLYD(col.unidad, inicio, fin));
    }
  });

  return bloques.sort((a,b) => String(a.unidad).localeCompare(String(b.unidad),'es') || a.inicio - b.inicio);
}

function detectarColumnasGantt(matriz){
  const columnas = [];
  const maxFilasCabecera = Math.min(10, matriz.length);
  const maxCols = Math.max(...matriz.slice(0, maxFilasCabecera).map(f => f.length));

  for(let c = 1; c < maxCols; c++){
    let unidad = '';

    for(let r = 0; r < maxFilasCabecera; r++){
      const valor = matriz[r]?.[c];
      if(valor !== null && valor !== undefined && String(valor).trim() !== '' && !convertirFecha(valor)){
        unidad = String(valor).trim();
        break;
      }
    }

    if(unidad){
      columnas.push({ indice:c, unidad, filaInicioDatos:1 });
    }
  }

  return columnas;
}

function crearBloqueLYD(unidad, inicio, fin){
  const dias = Math.round((fin - inicio) / 86400000) + 1;
  return {
    unidad,
    inicio,
    fin,
    dias,
    horas: dias * 24
  };
}

function compararArchivos(a, b){
  const fa = extraerFechaNombre(a);
  const fb = extraerFechaNombre(b);

  if(fa && fb) return fa - fb;
  return a.localeCompare(b, 'es', {numeric:true, sensitivity:'base'});
}

function extraerFechaNombre(nombre){
  const limpio = nombre.replace(/[_]/g,' ');
  const iso = limpio.match(/(20\d{2})[-. ]?(\d{2})[-. ]?(\d{2})(?:[T _-]?(\d{2})?[:.-]?(\d{2})?[:.-]?(\d{2})?)?/);

  if(!iso) return null;

  return new Date(
    Number(iso[1]),
    Number(iso[2]) - 1,
    Number(iso[3]),
    Number(iso[4] || 0),
    Number(iso[5] || 0),
    Number(iso[6] || 0)
  );
}

function aplicarFiltros(){
  let base = construirDatosBase(datosOriginales);

  const desde = fechaDesde.value ? new Date(fechaDesde.value + 'T00:00:00') : null;
  const hasta = fechaHasta.value ? new Date(fechaHasta.value + 'T23:59:59') : null;

  if(desde || hasta){
    base = base.filter(r => {
      const f = r.inicioAveriaFecha || r.fechaAviso;
      if(!f) return true;
      if(desde && f < desde) return false;
      if(hasta && f > hasta) return false;
      return true;
    });
  }

  const textoBusqueda = normalizar(busquedaEquipo.value);
  const equipoLista = equipoFiltro.value;

  if(filtroSoloSinClasificar){
    base = base.filter(r => r.unidadGantt === 'Sin clasificar');
    txtFiltro.textContent = 'Solo sin clasificar';
  }else if(equipoLista){
    base = base.filter(r => String(r.denominacionUbicacionTecnica) === equipoLista || String(r.ubicacionTecnica) === equipoLista);
    txtFiltro.textContent = equipoLista;
  }else if(textoBusqueda){
    base = base.filter(r =>
      normalizar(r.denominacionUbicacionTecnica).includes(textoBusqueda) ||
      normalizar(r.ubicacionTecnica).includes(textoBusqueda) ||
      normalizar(r.descripcion).includes(textoBusqueda)
    );
    txtFiltro.textContent = `Búsqueda: ${busquedaEquipo.value}`;
  }else{
    txtFiltro.textContent = 'Todos los equipos';
  }

  datosBase = base;
  actualizarKPIs(base);
  renderTablaBase(base.slice(0, 300));
  filasBase.textContent = `${base.length.toLocaleString('es-CL')} filas`;
}

function construirDatosBase(rows){
  return rows.map(r => {
    const inicio = unirFechaHora(r[mapaColumnas.inicioFecha], r[mapaColumnas.inicioHora]);
    const fin = unirFechaHora(r[mapaColumnas.finFecha], r[mapaColumnas.finHora]);
    const ubicacionTecnica = valor(r[mapaColumnas.ubicacionTecnica]);
    const denominacion = valor(r[mapaColumnas.denominacionUbicacionTecnica]);
    const descripcion = valor(r[mapaColumnas.descripcion]);
    const textoClasificacion = `${denominacion} ${ubicacionTecnica} ${descripcion}`;
    const unidad = obtenerUnidadGantt(textoClasificacion);
    const estadoUnidad = unidad === 'Sin clasificar' ? 'Revisar' : 'OK';

    return {
      fechaAviso: convertirFecha(r[mapaColumnas.fechaAviso]),
      claseAviso: valor(r[mapaColumnas.claseAviso]),
      aviso: valor(r[mapaColumnas.aviso]),
      orden: valor(r[mapaColumnas.orden]),
      descripcion,
      ubicacionTecnica,
      denominacionUbicacionTecnica: denominacion,
      textoClasificacion,
      unidadGantt: unidad,
      estadoUnidad,
      inicioAveria: inicio ? inicio.toLocaleString('es-CL') : '',
      inicioAveriaFecha: inicio,
      finAveria: fin ? fin.toLocaleString('es-CL') : '',
      finAveriaFecha: fin,
      duracionParada: numero(r[mapaColumnas.duracionParada])
    };
  });
}

function obtenerUnidadGantt(textoEquipo){
  const texto = normalizar(textoEquipo);
  const reglas = [...MAPEO_USUARIO, ...MAPEO_UNIDADES_BASE];

  const regla = reglas.find(r =>
    texto.includes(normalizar(r.buscar))
  );

  return regla ? regla.unidad : 'Sin clasificar';
}

function actualizarKPIs(base){
  kEquipos.textContent = new Set(base.map(r => r.ubicacionTecnica).filter(Boolean)).size.toLocaleString('es-CL');
  kAvisos.textContent = new Set(base.map(r => r.aviso).filter(Boolean)).size.toLocaleString('es-CL');
  const totalSin = construirDatosBase(datosOriginales).filter(r => r.unidadGantt === 'Sin clasificar').length;
  kSinClasificar.textContent = totalSin.toLocaleString('es-CL');
}

function detectarColumnas(columnas){
  const normalizadas = columnas.map(c => ({original:c, key:normalizar(c)}));

  return {
    fechaAviso: buscarColumna(normalizadas, ['fechadeaviso','fechaaviso']),
    claseAviso: buscarColumna(normalizadas, ['clasedeaviso','claseaviso']),
    aviso: buscarColumnaExacta(normalizadas, ['aviso']),
    orden: buscarColumna(normalizadas, ['orden','numeroorden','ordensap']),
    descripcion: buscarColumna(normalizadas, ['descripcion','descripciondelaviso','textoaviso']),
    ubicacionTecnica: buscarColumnaExacta(normalizadas, ['ubicaciontecnica']),
    denominacionUbicacionTecnica: buscarColumna(normalizadas, ['denominaciondelaubicaciontecnica','denominacionubicaciontecnica','denominaciondelubicaciontecnica']),
    inicioFecha: buscarColumnaExacta(normalizadas, ['iniciodeaveria','inicioaveria']),
    inicioHora: buscarColumna(normalizadas, ['iniciodeaveriahora','inicioaveriahora','hora inicio averia']),
    finFecha: buscarColumnaExacta(normalizadas, ['findeaveria','finaveria']),
    finHora: buscarColumna(normalizadas, ['findelaaveriahora','findeaveriahora','finaveriahora','hora fin averia']),
    duracionParada: buscarColumna(normalizadas, ['duraciondeparada','duracionparada'])
  };
}

function buscarColumna(cols, posibles){
  for (const posible of posibles){
    const p = normalizar(posible);
    const encontrada = cols.find(c => c.key.includes(p) || p.includes(c.key));
    if (encontrada) return encontrada.original;
  }
  return null;
}

function buscarColumnaExacta(cols, posibles){
  for (const posible of posibles){
    const p = normalizar(posible);
    const exacta = cols.find(c => c.key === p);
    if(exacta) return exacta.original;
  }
  return buscarColumna(cols, posibles);
}

function cargarFiltroEquipos(rows){
  equipoFiltro.innerHTML = '<option value="">Todos</option>';

  const base = construirDatosBase(rows);
  const equipos = [...new Set(
    base.map(r => r.denominacionUbicacionTecnica || r.ubicacionTecnica).filter(Boolean)
  )].sort((a,b) => String(a).localeCompare(String(b),'es'));

  listaEquipos = equipos;

  equipos.forEach(eq => {
    const opt = document.createElement('option');
    opt.value = eq;
    opt.textContent = eq;
    equipoFiltro.appendChild(opt);
  });
}

function mostrarSugerencias(texto){
  sugerenciasEquipo.innerHTML = '';

  if(!listaEquipos.length){
    ocultarSugerencias();
    return;
  }

  const clave = normalizar(texto);
  const resultados = (clave.length === 0 ? listaEquipos : listaEquipos.filter(eq => normalizar(eq).includes(clave))).slice(0, 12);

  if(!resultados.length){
    sugerenciasEquipo.innerHTML = '<div class="suggestion-empty">Sin coincidencias</div>';
    sugerenciasEquipo.style.display = 'block';
    return;
  }

  resultados.forEach(eq => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = eq;
    div.addEventListener('click', () => seleccionarEquipo(eq));
    sugerenciasEquipo.appendChild(div);
  });

  sugerenciasEquipo.style.display = 'block';
}

function seleccionarEquipo(equipo){
  filtroSoloSinClasificar = false;
  btnVolverNormal.classList.add('hidden');
  busquedaEquipo.value = equipo;
  equipoFiltro.value = equipo;
  ocultarSugerencias();
  aplicarFiltros();
}

function ocultarSugerencias(){
  sugerenciasEquipo.style.display = 'none';
}


function abrirModalAsignacion(texto){
  textoParaAsignar = texto;
  modalEquipo.textContent = texto;
  cargarOpcionesUnidad();
  modalUnidad.value = '';
  nuevaUnidadInput.value = '';
  nuevaUnidadBox.classList.add('hidden');
  modalAsignacion.classList.remove('hidden');
}

function cerrarModalAsignacion(){
  textoParaAsignar = '';
  nuevaUnidadInput.value = '';
  nuevaUnidadBox.classList.add('hidden');
  modalAsignacion.classList.add('hidden');
}

function guardarAsignacionUnidad(){
  let unidad = modalUnidad.value;

  if(unidad === '__nueva__'){
    unidad = nuevaUnidadInput.value.trim();

    if(!unidad){
      nuevaUnidadInput.focus();
      return;
    }

    if(!UNIDADES_USUARIO.some(u => normalizar(u) === normalizar(unidad))){
      UNIDADES_USUARIO.push(unidad);
      guardarUnidadesUsuario(UNIDADES_USUARIO);
    }
  }

  if(!unidad || !textoParaAsignar) return;

  const regla = generarReglaBusqueda(textoParaAsignar);
  const existente = MAPEO_USUARIO.find(r => normalizar(r.buscar) === normalizar(regla));

  if(existente){
    existente.unidad = unidad;
  }else{
    MAPEO_USUARIO.unshift({ buscar: regla, unidad });
  }

  guardarMapeoUsuario(MAPEO_USUARIO);
  cerrarModalAsignacion();
  aplicarFiltros();
  setEstado('Validado', 'ok', `Regla agregada correctamente:<br><b>${regla}</b> → <b>${unidad}</b><br><br>La unidad/regla quedó guardada en este navegador.`);
}

function controlarNuevaUnidad(){
  if(modalUnidad.value === '__nueva__'){
    nuevaUnidadBox.classList.remove('hidden');
    nuevaUnidadInput.focus();
  }else{
    nuevaUnidadBox.classList.add('hidden');
    nuevaUnidadInput.value = '';
  }
}

function cargarOpcionesUnidad(){
  const base = ['Hat','FF','Alev','Pre','Filtrado','Riles','Generadores','Otros'];
  const todas = [...base, ...UNIDADES_USUARIO]
    .filter(Boolean)
    .filter((u, idx, arr) => arr.findIndex(x => normalizar(x) === normalizar(u)) === idx);

  modalUnidad.innerHTML = '<option value="">Seleccionar unidad</option>' +
    todas.map(u => `<option value="${escapeHTML(u)}">${escapeHTML(u)}</option>`).join('') +
    '<option value="__nueva__">+ Agregar nueva unidad</option>';
}

function generarReglaBusqueda(texto){
  const partes = String(texto)
    .split(' ')
    .map(x => x.trim())
    .filter(Boolean);
  return partes.slice(0, 6).join(' ');
}

function cargarMapeoUsuario(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }catch{
    return [];
  }
}

function guardarMapeoUsuario(reglas){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reglas));
}

function cargarUnidadesUsuario(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_UNIDADES_KEY) || '[]');
  }catch{
    return [];
  }
}

function guardarUnidadesUsuario(unidades){
  localStorage.setItem(STORAGE_UNIDADES_KEY, JSON.stringify(unidades));
}

function generarResumenValidacion(archivoSAP, archivoGantt){
  const faltantes = validarColumnasRequeridas();

  let html = `<b>Archivos detectados correctamente.</b><br>
    SAP: ${archivoSAP.name}<br>
    Gantt: ${archivoGantt ? archivoGantt.name : 'No encontrado'}<br><br>`;

  if(faltantes.length){
    estadoValidacion.textContent = 'Revisar';
    estadoValidacion.className = 'status error';
    html += `<b>Columnas SAP faltantes:</b> ${faltantes.join(', ')}`;
  }else{
    html += `Columnas SAP requeridas: OK<br>`;
    html += `Bloques LYD detectados: ${bloquesLYD.length.toLocaleString('es-CL')}<br>`;
    html += `Reglas manuales guardadas: ${MAPEO_USUARIO.length.toLocaleString('es-CL')}<br>`;
    html += `Unidades personalizadas: ${UNIDADES_USUARIO.length.toLocaleString('es-CL')}<br>`;
    html += `Equipos sin clasificar: ${kSinClasificar.textContent}`;
  }

  return html;
}

function validarColumnasRequeridas(){
  const requeridas = [
    ['Fecha aviso', mapaColumnas.fechaAviso],
    ['Clase aviso', mapaColumnas.claseAviso],
    ['Aviso', mapaColumnas.aviso],
    ['Orden', mapaColumnas.orden],
    ['Descripción', mapaColumnas.descripcion],
    ['Ubicación técnica', mapaColumnas.ubicacionTecnica],
    ['Denominación ubicación técnica', mapaColumnas.denominacionUbicacionTecnica],
    ['Inicio de avería', mapaColumnas.inicioFecha],
    ['Inicio de avería hora', mapaColumnas.inicioHora],
    ['Fin de avería', mapaColumnas.finFecha],
    ['Fin de avería hora', mapaColumnas.finHora],
    ['Duración de parada', mapaColumnas.duracionParada]
  ];

  return requeridas.filter(x => !x[1]).map(x => x[0]);
}

function renderTablaBase(base){
  theadBase.innerHTML = `
    <tr>
      <th>Fecha aviso</th>
      <th>Clase aviso</th>
      <th>Aviso</th>
      <th>Orden</th>
      <th>Descripción</th>
      <th>Ubicación técnica</th>
      <th>Denominación ubicación técnica</th>
      <th>Unidad Gantt detectada</th>
      <th>Estado</th>
      <th>Acción</th>
      <th>Inicio avería</th>
      <th>Fin avería</th>
      <th>Duración parada</th>
    </tr>
  `;

  if(!base.length){
    tbodyBase.innerHTML = '<tr><td colspan="13">No hay datos para el filtro seleccionado</td></tr>';
    return;
  }

  tbodyBase.innerHTML = base.map(r => `
    <tr>
      <td>${formatearFechaCorta(r.fechaAviso)}</td>
      <td>${r.claseAviso}</td>
      <td>${r.aviso}</td>
      <td>${r.orden}</td>
      <td class="descripcion">${r.descripcion}</td>
      <td>${r.ubicacionTecnica}</td>
      <td>${r.denominacionUbicacionTecnica}</td>
      <td>${r.unidadGantt}</td>
      <td>${r.estadoUnidad === 'OK' ? '<span class="badge-ok">OK</span>' : '<span class="badge-review">Revisar</span>'}</td>
      <td>${r.estadoUnidad === 'OK' ? '' : `<button class="assign-btn" onclick="abrirModalAsignacion('${escapeAttr(r.textoClasificacion)}')">Asignar</button>`}</td>
      <td>${r.inicioAveria}</td>
      <td>${r.finAveria}</td>
      <td>${formatearNumero(r.duracionParada)}</td>
    </tr>
  `).join('');
}


function escapeAttr(texto){
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, ' ');
}

function renderTablaLYD(bloques){
  theadLYD.innerHTML = `
    <tr>
      <th>Unidad Gantt</th>
      <th>Inicio LYD</th>
      <th>Fin LYD</th>
      <th>Días LYD</th>
      <th>Horas no operativas planificadas</th>
    </tr>
  `;

  if(!bloques.length){
    tbodyLYD.innerHTML = '<tr><td colspan="5">No hay períodos LYD detectados</td></tr>';
    filasLYD.textContent = '0 bloques';
    return;
  }

  tbodyLYD.innerHTML = bloques.map(b => `
    <tr>
      <td>${b.unidad}</td>
      <td>${formatearFechaCorta(b.inicio)}</td>
      <td>${formatearFechaCorta(b.fin)}</td>
      <td>${b.dias}</td>
      <td>${b.horas}</td>
    </tr>
  `).join('');
}

function unirFechaHora(fechaValor, horaValor){
  const fecha = convertirFecha(fechaValor);
  if(!fecha) return null;

  const h = convertirHora(horaValor);

  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    h.horas,
    h.minutos,
    h.segundos
  );
}

function convertirFecha(valorEntrada){
  if(!valorEntrada) return null;
  if(valorEntrada instanceof Date && !isNaN(valorEntrada)) return valorEntrada;

  if(typeof valorEntrada === 'number'){
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + valorEntrada * 86400000);
  }

  const texto = String(valorEntrada).trim();

  const matchCL = texto.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if(matchCL){
    return new Date(Number(matchCL[3]), Number(matchCL[2]) - 1, Number(matchCL[1]));
  }

  const f = new Date(texto);
  return isNaN(f) ? null : f;
}

function convertirHora(valorEntrada){
  if(!valorEntrada) return {horas:0,minutos:0,segundos:0};

  if(valorEntrada instanceof Date && !isNaN(valorEntrada)){
    return {horas: valorEntrada.getHours(), minutos: valorEntrada.getMinutes(), segundos: valorEntrada.getSeconds()};
  }

  if(typeof valorEntrada === 'number'){
    const totalSegundos = Math.round(valorEntrada * 24 * 60 * 60);
    return {
      horas: Math.floor(totalSegundos / 3600) % 24,
      minutos: Math.floor((totalSegundos % 3600) / 60),
      segundos: totalSegundos % 60
    };
  }

  const texto = String(valorEntrada).trim();
  const match = texto.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);

  if(match){
    return {horas: Number(match[1]), minutos: Number(match[2]), segundos: Number(match[3] || 0)};
  }

  return {horas:0,minutos:0,segundos:0};
}

function normalizar(texto){
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]/g,'');
}

function valor(v){
  if(v === null || v === undefined) return '';
  return String(v);
}

function numero(v){
  if(v === null || v === undefined || v === '') return 0;
  if(typeof v === 'number') return v;
  const n = Number(String(v).replace(/\./g,'').replace(',','.'));
  return isNaN(n) ? 0 : n;
}

function formatearFechaCorta(fecha){
  if(!fecha) return '';
  return fecha.toLocaleDateString('es-CL');
}

function formatearNumero(n){
  if(n === null || n === undefined || isNaN(n)) return '';
  return Number(n).toLocaleString('es-CL', {maximumFractionDigits:2});
}

function escapeHTML(texto){
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setEstado(texto, tipo, detalle){
  estadoValidacion.textContent = texto;
  estadoValidacion.className = `status ${tipo}`;
  validacionDetalle.innerHTML = detalle;
}

function mostrarError(msg){
  kArchivo.textContent = 'Error';
  kArchivoGantt.textContent = 'Error';
  txtArchivo.textContent = 'Sin archivo SAP';
  txtGantt.textContent = 'Sin archivo Gantt';
  txtRegistros.textContent = '0 registros leídos';
  kEquipos.textContent = '0';
  kAvisos.textContent = '0';
  kSinClasificar.textContent = '0';
  kBloquesLYD.textContent = '0';
  filasBase.textContent = '0 filas';
  filasLYD.textContent = '0 bloques';
  theadBase.innerHTML = '';
  tbodyBase.innerHTML = '';
  theadLYD.innerHTML = '';
  tbodyLYD.innerHTML = '';
  setEstado('Error', 'error', msg);
}
