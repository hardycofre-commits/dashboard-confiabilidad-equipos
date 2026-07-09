const CONFIG = {
  owner: 'hardycofre-commits',
  repo: 'dashboard-confiabilidad-equipos',
  branch: 'main',
  folder: 'datos'
};

const btnActualizar = document.getElementById('btnActualizar');

const kArchivo = document.getElementById('kArchivo');
const kActualizacion = document.getElementById('kActualizacion');
const kEquipos = document.getElementById('kEquipos');
const kAvisos = document.getElementById('kAvisos');
const kFallasBase = document.getElementById('kFallasBase');
const kHorasRep = document.getElementById('kHorasRep');
const txtRegistros = document.getElementById('txtRegistros');
const txtArchivo = document.getElementById('txtArchivo');
const txtLectura = document.getElementById('txtLectura');
const txtFiltro = document.getElementById('txtFiltro');

const fechaDesde = document.getElementById('fechaDesde');
const fechaHasta = document.getElementById('fechaHasta');
const busquedaEquipo = document.getElementById('busquedaEquipo');
const sugerenciasEquipo = document.getElementById('sugerenciasEquipo');
const equipoFiltro = document.getElementById('equipoFiltro');

const estadoValidacion = document.getElementById('estadoValidacion');
const validacionDetalle = document.getElementById('validacionDetalle');
const filasPreview = document.getElementById('filasPreview');
const filasFallas = document.getElementById('filasFallas');

const tablaPreview = document.getElementById('tablaPreview');
const theadPreview = tablaPreview.querySelector('thead');
const tbodyPreview = tablaPreview.querySelector('tbody');

const tablaFallas = document.getElementById('tablaFallas');
const theadFallas = tablaFallas.querySelector('thead');
const tbodyFallas = tablaFallas.querySelector('tbody');

let datosOriginales = [];
let datosFiltrados = [];
let tablaBaseFallas = [];
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
    setEstado('Buscando', 'warning', 'Consultando carpeta datos/ en GitHub...');

    const archivo = await obtenerUltimoExcelGitHub();

    if(!archivo){
      throw new Error('No se encontró ningún archivo Excel en la carpeta datos.');
    }

    setEstado('Cargando', 'warning', `Archivo detectado: ${archivo.name}<br>Descargando y procesando información SAP...`);
    const response = await fetch(archivo.download_url + '?v=' + Date.now());

    if(!response.ok){
      throw new Error('No fue posible descargar el archivo Excel desde GitHub.');
    }

    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, {type:'array', cellDates:true});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {defval:''});

    datosOriginales = rows;
    procesarDatos(rows, archivo.name);
  }catch(error){
    mostrarError(error.message);
    console.error(error);
  }
}

async function obtenerUltimoExcelGitHub(){
  const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.folder}?ref=${CONFIG.branch}`;
  const response = await fetch(apiUrl + '&t=' + Date.now());

  if(!response.ok){
    throw new Error('No fue posible leer la carpeta datos desde GitHub. Revisa que exista la carpeta datos y que el repositorio sea público.');
  }

  const archivos = await response.json();

  const excel = archivos
    .filter(item => item.type === 'file')
    .filter(item => /\.(xlsx|xls)$/i.test(item.name))
    .sort((a,b) => compararArchivos(a.name, b.name));

  return excel.length ? excel[excel.length - 1] : null;
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

function procesarDatos(rows, fileName){
  const columnas = rows.length ? Object.keys(rows[0]) : [];
  mapaColumnas = detectarColumnas(columnas);

  kArchivo.textContent = fileName;
  txtArchivo.textContent = fileName;
  txtRegistros.textContent = `${rows.length.toLocaleString('es-CL')} registros leídos`;

  const ahora = new Date().toLocaleString('es-CL');
  kActualizacion.textContent = ahora;
  txtLectura.textContent = ahora;

  cargarFiltroEquipos(rows, mapaColumnas.equipo);
  validarColumnas(mapaColumnas, columnas);
  aplicarFiltros();
}

function aplicarFiltros(){
  let rows = [...datosOriginales];

  const desde = fechaDesde.value ? new Date(fechaDesde.value + 'T00:00:00') : null;
  const hasta = fechaHasta.value ? new Date(fechaHasta.value + 'T23:59:59') : null;

  if(mapaColumnas.inicio && (desde || hasta)){
    rows = rows.filter(r => {
      const f = convertirFecha(r[mapaColumnas.inicio]);
      if(!f) return true;
      if(desde && f < desde) return false;
      if(hasta && f > hasta) return false;
      return true;
    });
  }

  const textoBusqueda = normalizar(busquedaEquipo.value);
  const equipoLista = equipoFiltro.value;

  if(mapaColumnas.equipo){
    if(equipoLista){
      rows = rows.filter(r => String(r[mapaColumnas.equipo]) === equipoLista);
      txtFiltro.textContent = equipoLista;
    }else if(textoBusqueda){
      rows = rows.filter(r => normalizar(r[mapaColumnas.equipo]).includes(textoBusqueda));
      txtFiltro.textContent = `Búsqueda: ${busquedaEquipo.value}`;
    }else{
      txtFiltro.textContent = 'Todos los equipos';
    }
  }

  datosFiltrados = rows;
  tablaBaseFallas = construirTablaBaseFallas(rows);

  actualizarKPIs(rows, tablaBaseFallas);
  renderTablaPreview(rows.slice(0, 25), datosOriginales.length ? Object.keys(datosOriginales[0]) : []);
  renderTablaFallas(tablaBaseFallas.slice(0, 100));

  filasPreview.textContent = `${Math.min(rows.length,25)} de ${rows.length} filas`;
  filasFallas.textContent = `${tablaBaseFallas.length} fallas`;
}

function construirTablaBaseFallas(rows){
  if(!mapaColumnas.equipo || !mapaColumnas.aviso || !mapaColumnas.inicio || !mapaColumnas.fin){
    return [];
  }

  const fallas = rows
    .filter(r => {
      const clase = mapaColumnas.clase ? String(r[mapaColumnas.clase]).trim().toUpperCase() : '';
      if(clase && clase !== 'Z2') return false;
      return r[mapaColumnas.equipo] && r[mapaColumnas.aviso];
    })
    .map(r => {
      const inicio = convertirFecha(r[mapaColumnas.inicio]);
      const fin = convertirFecha(r[mapaColumnas.fin]);
      const horasReparacion = inicio && fin ? Math.max(0, (fin - inicio) / 3600000) : 0;

      return {
        equipo: r[mapaColumnas.equipo],
        aviso: r[mapaColumnas.aviso],
        inicio,
        fin,
        horasReparacion,
        parada: mapaColumnas.parada ? r[mapaColumnas.parada] : '',
        clase: mapaColumnas.clase ? r[mapaColumnas.clase] : ''
      };
    })
    .sort((a,b) => String(a.equipo).localeCompare(String(b.equipo),'es') || ((a.inicio || 0) - (b.inicio || 0)));

  let ultimoPorEquipo = {};

  return fallas.map(f => {
    const key = String(f.equipo);
    const anterior = ultimoPorEquipo[key] || null;

    const horasEntreFallas = anterior && f.inicio && anterior.fin
      ? Math.max(0, (f.inicio - anterior.fin) / 3600000)
      : null;

    const registro = {
      ...f,
      finAnterior: anterior ? anterior.fin : null,
      horasEntreFallas
    };

    ultimoPorEquipo[key] = f;
    return registro;
  });
}

function actualizarKPIs(rows, fallas){
  const equipos = contarUnicos(rows, mapaColumnas.equipo);
  const avisos = contarUnicos(rows, mapaColumnas.aviso);
  const horas = fallas.reduce((acc, f) => acc + (Number(f.horasReparacion) || 0), 0);

  kEquipos.textContent = equipos.toLocaleString('es-CL');
  kAvisos.textContent = avisos.toLocaleString('es-CL');
  kFallasBase.textContent = fallas.length.toLocaleString('es-CL');
  kHorasRep.textContent = horas ? horas.toLocaleString('es-CL', {maximumFractionDigits:1}) : '0';
}

function detectarColumnas(columnas){
  const normalizadas = columnas.map(c => ({original:c, key:normalizar(c)}));

  return {
    equipo: buscarColumna(normalizadas, ['equipo','denominacionequipo','ubicaciontecnica','objeto','denominacionubicaciontecnica','denominaciondelubicaciontecnica','denominacion']),
    aviso: buscarColumna(normalizadas, ['aviso','avisosap','numeroaviso','nroaviso']),
    inicio: buscarColumna(normalizadas, ['inicioaveria','iniciodeaveria','inicioaveriafecha','fecha inicio averia','inicio']),
    fin: buscarColumna(normalizadas, ['finaveria','findeaveria','finaveriafecha','fecha fin averia','fin']),
    parada: buscarColumna(normalizadas, ['parada','duraciondeparada','indparada','indicadorparada']),
    clase: buscarColumna(normalizadas, ['clasedeaviso','claseaviso','tipoaviso'])
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

function normalizar(texto){
  return String(texto)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]/g,'');
}

function contarUnicos(rows, columna){
  if(!columna) return 0;
  return new Set(rows.map(r => r[columna]).filter(Boolean)).size;
}

function cargarFiltroEquipos(rows, columna){
  equipoFiltro.innerHTML = '<option value="">Todos</option>';
  listaEquipos = [];

  if(!columna) return;

  listaEquipos = [...new Set(rows.map(r => r[columna]).filter(Boolean))]
    .sort((a,b) => String(a).localeCompare(String(b),'es'));

  listaEquipos.forEach(eq => {
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
  let resultados = [];

  if(clave.length === 0){
    resultados = listaEquipos.slice(0, 12);
  }else{
    resultados = listaEquipos
      .filter(eq => normalizar(eq).includes(clave))
      .slice(0, 12);
  }

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

function validarColumnas(mapa, columnas){
  const faltantes = [];

  if(!mapa.equipo) faltantes.push('Equipo');
  if(!mapa.aviso) faltantes.push('Aviso');
  if(!mapa.inicio) faltantes.push('Inicio avería');
  if(!mapa.fin) faltantes.push('Fin avería');

  if(faltantes.length === 0){
    setEstado('Validado', 'ok', `
      <b>Archivo SAP cargado correctamente desde GitHub.</b><br>
      Equipo: ${mapa.equipo}<br>
      Aviso: ${mapa.aviso}<br>
      Inicio avería: ${mapa.inicio}<br>
      Fin avería: ${mapa.fin}<br>
      Parada: ${mapa.parada || 'No detectada'}<br>
      Clase de aviso: ${mapa.clase || 'No detectada'}
    `);
  }else{
    setEstado('Revisar', 'error', `
      <b>No se detectaron todas las columnas necesarias.</b><br>
      Faltantes: ${faltantes.join(', ')}<br><br>
      Columnas encontradas:<br>
      ${columnas.join(' | ')}
    `);
  }
}

function renderTablaPreview(rows, columnas){
  theadPreview.innerHTML = '';
  tbodyPreview.innerHTML = '';

  if(!rows.length){
    tbodyPreview.innerHTML = '<tr><td>No hay datos para mostrar</td></tr>';
    return;
  }

  const colsPreferidas = [
    mapaColumnas.equipo,
    mapaColumnas.aviso,
    mapaColumnas.inicio,
    mapaColumnas.fin,
    mapaColumnas.parada,
    mapaColumnas.clase
  ].filter(Boolean);

  const otras = columnas.filter(c => !colsPreferidas.includes(c)).slice(0,5);
  const cols = [...colsPreferidas, ...otras];

  theadPreview.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;

  tbodyPreview.innerHTML = rows.map(row => `
    <tr>${cols.map(c => `<td>${formatearCelda(row[c])}</td>`).join('')}</tr>
  `).join('');
}

function renderTablaFallas(fallas){
  theadFallas.innerHTML = `
    <tr>
      <th>Equipo</th>
      <th>Aviso</th>
      <th>Inicio avería</th>
      <th>Fin avería</th>
      <th>Horas reparación</th>
      <th>Parada</th>
      <th>Fin avería anterior</th>
      <th>Horas entre fallas</th>
    </tr>
  `;

  if(!fallas.length){
    tbodyFallas.innerHTML = '<tr><td colspan="8">No hay fallas Z2 para el filtro seleccionado</td></tr>';
    return;
  }

  tbodyFallas.innerHTML = fallas.map(f => `
    <tr>
      <td>${f.equipo}</td>
      <td>${f.aviso}</td>
      <td>${formatearFecha(f.inicio)}</td>
      <td>${formatearFecha(f.fin)}</td>
      <td>${formatearNumero(f.horasReparacion)}</td>
      <td>${f.parada ?? ''}</td>
      <td>${formatearFecha(f.finAnterior)}</td>
      <td>${f.horasEntreFallas === null ? '-' : formatearNumero(f.horasEntreFallas)}</td>
    </tr>
  `).join('');
}

function convertirFecha(valor){
  if(!valor) return null;
  if(valor instanceof Date && !isNaN(valor)) return valor;

  if(typeof valor === 'number'){
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + valor * 86400000);
  }

  const texto = String(valor).trim();

  const matchCL = texto.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:,\s*)?(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(matchCL){
    return new Date(
      Number(matchCL[3]),
      Number(matchCL[2]) - 1,
      Number(matchCL[1]),
      Number(matchCL[4] || 0),
      Number(matchCL[5] || 0),
      Number(matchCL[6] || 0)
    );
  }

  const f = new Date(texto);
  return isNaN(f) ? null : f;
}

function formatearCelda(valor){
  if(valor instanceof Date) return valor.toLocaleString('es-CL');
  return String(valor ?? '');
}

function formatearFecha(fecha){
  if(!fecha) return '-';
  return fecha.toLocaleString('es-CL');
}

function formatearNumero(n){
  if(n === null || n === undefined || isNaN(n)) return '-';
  return Number(n).toLocaleString('es-CL', {maximumFractionDigits:1});
}

function setEstado(texto, tipo, detalle){
  estadoValidacion.textContent = texto;
  estadoValidacion.className = `status ${tipo}`;
  validacionDetalle.innerHTML = detalle;
}

function mostrarError(msg){
  kArchivo.textContent = 'Error';
  txtArchivo.textContent = 'Sin archivo';
  txtRegistros.textContent = '0 registros leídos';
  kEquipos.textContent = '0';
  kAvisos.textContent = '0';
  kFallasBase.textContent = '0';
  kHorasRep.textContent = '--';
  filasPreview.textContent = '0 filas';
  filasFallas.textContent = '0 fallas';
  theadPreview.innerHTML = '';
  tbodyPreview.innerHTML = '';
  theadFallas.innerHTML = '';
  tbodyFallas.innerHTML = '';
  setEstado('Error', 'error', msg);
}
