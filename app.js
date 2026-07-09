const CONFIG = {
  owner: 'hardycofre-commits',
  repo: 'dashboard-confiabilidad-equipos',
  branch: 'main',
  folder: 'datos'
};

const btnActualizar = document.getElementById('btnActualizar');

const kArchivo = document.getElementById('kArchivo');
const kArchivoGantt = document.getElementById('kArchivoGantt');
const kEquipos = document.getElementById('kEquipos');
const kAvisos = document.getElementById('kAvisos');
const kOrdenes = document.getElementById('kOrdenes');
const kGantt = document.getElementById('kGantt');
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
const filasGantt = document.getElementById('filasGantt');

const tablaBase = document.getElementById('tablaBase');
const theadBase = tablaBase.querySelector('thead');
const tbodyBase = tablaBase.querySelector('tbody');

const tablaGantt = document.getElementById('tablaGantt');
const theadGantt = tablaGantt.querySelector('thead');
const tbodyGantt = tablaGantt.querySelector('tbody');

let datosOriginales = [];
let datosBase = [];
let ganttOriginal = [];
let mapaColumnas = {};
let listaEquipos = [];

document.addEventListener('DOMContentLoaded', () => {
  configurarFechasFijas();
  cargarDesdeGitHub();
});

btnActualizar.addEventListener('click', cargarDesdeGitHub);

equipoFiltro.addEventListener('change', () => {
  busquedaEquipo.value = equipoFiltro.value;
  ocultarSugerencias();
  aplicarFiltros();
});

busquedaEquipo.addEventListener('input', () => {
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
      kGantt.textContent = '0';
      renderTablaGantt([]);
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
  ganttOriginal = procesarGantt(matriz);

  kGantt.textContent = ganttOriginal.length.toLocaleString('es-CL');
  filasGantt.textContent = `${ganttOriginal.length.toLocaleString('es-CL')} registros`;
  renderTablaGantt(ganttOriginal.slice(0, 100));
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

function procesarGantt(matriz){
  if(!matriz || matriz.length < 2) return [];

  const registros = [];
  const maxFilas = Math.min(matriz.length, 500);

  for(let i = 0; i < maxFilas; i++){
    const fila = matriz[i];
    const fecha = convertirFecha(fila[0]);

    if(!fecha) continue;

    for(let c = 1; c < fila.length; c++){
      const valorCelda = fila[c];

      if(valorCelda === null || valorCelda === undefined || valorCelda === '') continue;

      const area = buscarEncabezadoSuperior(matriz, i, c);
      const equipo = buscarEncabezadoColumna(matriz, c);

      registros.push({
        fecha,
        area,
        equipo,
        estado: String(valorCelda)
      });
    }
  }

  return registros;
}

function buscarEncabezadoSuperior(matriz, filaActual, col){
  for(let r = filaActual - 1; r >= 0; r--){
    const valor = matriz[r]?.[col];
    if(valor !== null && valor !== undefined && valor !== '' && !convertirFecha(valor)){
      return String(valor);
    }
  }
  return '';
}

function buscarEncabezadoColumna(matriz, col){
  for(let r = 0; r < Math.min(8, matriz.length); r++){
    const valor = matriz[r]?.[col];
    if(valor !== null && valor !== undefined && valor !== '' && !convertirFecha(valor)){
      return String(valor);
    }
  }
  return `Columna ${col + 1}`;
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

  if(equipoLista){
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

    return {
      fechaAviso: convertirFecha(r[mapaColumnas.fechaAviso]),
      claseAviso: valor(r[mapaColumnas.claseAviso]),
      aviso: valor(r[mapaColumnas.aviso]),
      orden: valor(r[mapaColumnas.orden]),
      descripcion: valor(r[mapaColumnas.descripcion]),
      ubicacionTecnica: valor(r[mapaColumnas.ubicacionTecnica]),
      denominacionUbicacionTecnica: valor(r[mapaColumnas.denominacionUbicacionTecnica]),
      inicioAveria: inicio ? inicio.toLocaleString('es-CL') : '',
      inicioAveriaFecha: inicio,
      finAveria: fin ? fin.toLocaleString('es-CL') : '',
      finAveriaFecha: fin,
      duracionParada: numero(r[mapaColumnas.duracionParada])
    };
  });
}

function actualizarKPIs(base){
  kEquipos.textContent = new Set(base.map(r => r.ubicacionTecnica).filter(Boolean)).size.toLocaleString('es-CL');
  kAvisos.textContent = new Set(base.map(r => r.aviso).filter(Boolean)).size.toLocaleString('es-CL');
  kOrdenes.textContent = new Set(base.map(r => r.orden).filter(Boolean)).size.toLocaleString('es-CL');
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
  busquedaEquipo.value = equipo;
  equipoFiltro.value = equipo;
  ocultarSugerencias();
  aplicarFiltros();
}

function ocultarSugerencias(){
  sugerenciasEquipo.style.display = 'none';
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
    html += `Registros Gantt detectados: ${ganttOriginal.length.toLocaleString('es-CL')}`;
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
      <th>Inicio avería</th>
      <th>Fin avería</th>
      <th>Duración parada</th>
    </tr>
  `;

  if(!base.length){
    tbodyBase.innerHTML = '<tr><td colspan="10">No hay datos para el filtro seleccionado</td></tr>';
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
      <td>${r.inicioAveria}</td>
      <td>${r.finAveria}</td>
      <td>${formatearNumero(r.duracionParada)}</td>
    </tr>
  `).join('');
}

function renderTablaGantt(registros){
  theadGantt.innerHTML = `
    <tr>
      <th>Fecha</th>
      <th>Área / Encabezado</th>
      <th>Columna</th>
      <th>Estado / Código</th>
    </tr>
  `;

  if(!registros.length){
    tbodyGantt.innerHTML = '<tr><td colspan="4">No hay datos Gantt detectados</td></tr>';
    filasGantt.textContent = '0 registros';
    return;
  }

  tbodyGantt.innerHTML = registros.map(r => `
    <tr>
      <td>${formatearFechaCorta(r.fecha)}</td>
      <td>${r.area}</td>
      <td>${r.equipo}</td>
      <td>${r.estado}</td>
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
  kOrdenes.textContent = '0';
  kGantt.textContent = '0';
  filasBase.textContent = '0 filas';
  filasGantt.textContent = '0 registros';
  theadBase.innerHTML = '';
  tbodyBase.innerHTML = '';
  theadGantt.innerHTML = '';
  tbodyGantt.innerHTML = '';
  setEstado('Error', 'error', msg);
}
