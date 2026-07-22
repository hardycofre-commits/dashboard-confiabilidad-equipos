function copiarTexto(el,valor){
if(navigator.clipboard){navigator.clipboard.writeText(String(valor));}
const original=el.textContent;el.textContent='✔ Copiado';
setTimeout(()=>{el.textContent=original;},900);
}


function copiarTexto(el,valor){
  if(navigator.clipboard){
    navigator.clipboard.writeText(String(valor));
  }
  const original=el.textContent;
  el.textContent='✔ Copiado';
  setTimeout(()=>{el.textContent=original;},900);
}

const CONFIG={owner:'hardycofre-commits',repo:'dashboard-confiabilidad-equipos',branch:'main',folder:'datos'};
const UNIDADES_BASE=['HATCHERY','FF2','ALEVINAJE','PRE SMOLT','RILES','FILTRADO','GENERADORES','OTROS'];
const MAPEO_BASE=[['HATCHERY','HATCHERY'],['HAT','HATCHERY'],['FF2','FF2'],['FF','FF2'],['ALEVINAJE','ALEVINAJE'],['ALEV','ALEVINAJE'],['PRE-SMOLT','PRE SMOLT'],['PRE SMOLT','PRE SMOLT'],['PRESMOLT','PRE SMOLT'],['RILES','RILES'],['FILTRADO','FILTRADO'],['FILTRO','FILTRADO'],['GEN','GENERADORES'],['GENERADOR','GENERADORES']];
const KEY_REGLAS='confEq_reglas_v21', KEY_UNIDADES='confEq_unidades_v21', KEY_NOMBRES='confEq_nombresUnidades_v23';
let reglasUsuario=JSON.parse(localStorage.getItem(KEY_REGLAS)||'[]');
let unidadesUsuario=JSON.parse(localStorage.getItem(KEY_UNIDADES)||'[]');
let nombresUnidades=JSON.parse(localStorage.getItem(KEY_NOMBRES)||'{"Hat":"Hatchery","Hatchery":"Hatchery","FF":"FF2","FF2":"FF2","Pre":"Pre Smolt","Pre Smolt":"Pre Smolt","Alev":"Alevinaje","Alevinaje":"Alevinaje"}');
let datosOriginales=[], datosBase=[], bloquesLYD=[], mapaColumnas={}, listaEquipos=[], pendientes=[], pendienteIndex=0;
let ordenFecha='asc';
const $=id=>document.getElementById(id);

document.addEventListener('DOMContentLoaded',()=>{configurarFechas();setupEventos();cargarDesdeGitHub();});
function setupEventos(){
  document.querySelectorAll('.menu-item').forEach(a=>a.onclick=e=>{e.preventDefault();cambiarVista(a.dataset.view);});
  $('btnActualizar').onclick=cargarDesdeGitHub;
  $('cardSinClasificar').onclick=abrirWizard;
  $('btnCerrarWizard').onclick=cerrarWizard;
  $('btnFinalizarWizard').onclick=cerrarWizard;
  $('btnAnterior').onclick=()=>{if(pendienteIndex>0){pendienteIndex--;renderWizard();}};
  $('btnGuardarSiguiente').onclick=guardarWizard;
  $('wizardUnidad').onchange=()=>{$('boxNuevaUnidad').classList.toggle('hidden',$('wizardUnidad').value!=='__NUEVA__');};
      $('busquedaEquipo').oninput=()=>{mostrarSugerencias($('busquedaEquipo').value.trim());aplicarFiltros();};
  $('busquedaEquipo').onfocus=()=>mostrarSugerencias($('busquedaEquipo').value.trim());
  $('btnAbrirEquipos').onclick=()=>mostrarSugerencias('');
  document.addEventListener('click',e=>{if(!e.target.closest('.search-field'))ocultarSugerencias();});
  $('fechaDesde').onchange=aplicarFiltros;$('fechaHasta').onchange=aplicarFiltros;
  $('btnOrdenAsc').onclick=()=>cambiarOrdenFecha('asc');
  $('btnOrdenDesc').onclick=()=>cambiarOrdenFecha('desc');
  $('unidadFiltro').onchange=aplicarFiltros;
  $('btnGuardarUnidades').onclick=guardarTodosNombresUnidades;
}
function cambiarVista(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));
  document.querySelectorAll('.menu-item').forEach(x=>x.classList.remove('active'));
  if(v==='unidades'){$('viewUnidades').classList.remove('hidden');renderTablaUnidades();}
  else {$('viewResumen').classList.remove('hidden');}
  document.querySelector(`.menu-item[data-view="${v}"]`).classList.add('active');
}
function configurarFechas(){$('fechaDesde').value='2025-01-01';$('fechaHasta').value='2026-12-31';}
async function cargarDesdeGitHub(){
 try{
  setEstado('Buscando','warning','Consultando carpeta datos/ en GitHub...');
  const archivos=await listarArchivosDatos(), sap=selUlt(archivos,esSAP), gantt=selUlt(archivos,esGantt);
  if(!sap) throw new Error('No se encontró archivo SAP/EXPORT en carpeta datos.');
  await cargarSAP(sap); if(gantt) await cargarGantt(gantt); else renderTablaLYD([]);
  $('txtLectura').textContent=new Date().toLocaleString('es-CL');
  setEstado('Validado','ok',`SAP: ${sap.name}<br>Gantt: ${gantt?gantt.name:'No encontrado'}<br>Clasificaciones guardadas: ${reglasUsuario.length}`);
 }catch(e){mostrarError(e.message);console.error(e);}
}
async function listarArchivosDatos(){const r=await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.folder}?ref=${CONFIG.branch}&t=${Date.now()}`); if(!r.ok)throw new Error('No fue posible leer carpeta datos desde GitHub.'); return r.json();}
function esSAP(i){const n=normalizar(i.name);return i.type==='file'&&/\.(xlsx|xls)$/i.test(i.name)&&(n.includes('sap')||n.includes('export'))&&!n.includes('gantt');}
function esGantt(i){const n=normalizar(i.name);return i.type==='file'&&/\.(xlsx|xls)$/i.test(i.name)&&n.includes('gantt');}
function selUlt(arr,f){const x=arr.filter(f).sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true}));return x[x.length-1];}
async function cargarSAP(a){$('kArchivo').textContent=a.name;$('txtArchivo').textContent=a.name;const rows=await leerExcel(a.download_url,'json');datosOriginales=rows.filter(r=>valor(r[detectarColumnas(Object.keys(rows[0]||{})).orden]).trim()!=='');mapaColumnas=detectarColumnas(Object.keys(rows[0]||{}));$('txtRegistros').textContent=`${rows.length.toLocaleString('es-CL')} registros SAP leídos`;cargarListaEquipos(rows);cargarFiltroUnidades();aplicarFiltros();}
async function cargarGantt(a){$('kArchivoGantt').textContent=a.name;$('txtGantt').textContent=a.name;const m=await leerExcel(a.download_url,'array');bloquesLYD=extraerBloquesLYD(m);$('kBloquesLYD').textContent=bloquesLYD.length.toLocaleString('es-CL');renderTablaLYD(bloquesLYD);renderTablaUnidades();}
async function leerExcel(url,modo){const r=await fetch(url+'?v='+Date.now());if(!r.ok)throw new Error('No fue posible descargar archivo.');const b=await r.arrayBuffer(), wb=XLSX.read(b,{type:'array',cellDates:true}), sh=wb.Sheets[wb.SheetNames[0]];return modo==='array'?XLSX.utils.sheet_to_json(sh,{header:1,defval:''}):XLSX.utils.sheet_to_json(sh,{defval:''});}

function cambiarOrdenFecha(tipo){
  ordenFecha=tipo;
  $('btnOrdenAsc').classList.toggle('active',tipo==='asc');
  $('btnOrdenDesc').classList.toggle('active',tipo==='desc');
  aplicarFiltros();
}

function fechaOrdenRegistro(registro){
  return registro.inicioAveriaFecha || registro.fechaAviso || null;
}

function ordenarRegistrosPorFecha(registros){
  return registros.sort((a,b)=>{
    const fa=fechaOrdenRegistro(a);
    const fb=fechaOrdenRegistro(b);

    if(!fa && !fb) return 0;
    if(!fa) return 1;
    if(!fb) return -1;

    return ordenFecha==='asc' ? fa-fb : fb-fa;
  });
}

function aplicarFiltros(){
  let base=construirDatosBase(datosOriginales);

  const d=$('fechaDesde').value?new Date($('fechaDesde').value+'T00:00:00'):null;
  const h=$('fechaHasta').value?new Date($('fechaHasta').value+'T23:59:59'):null;

  if(d||h){
    base=base.filter(r=>{
      const f=r.inicioAveriaFecha||r.fechaAviso;
      if(!f)return true;
      return (!d||f>=d)&&(!h||f<=h);
    });
  }

  const txt=normalizar($('busquedaEquipo').value);
  if(txt){
    base=base.filter(r=>
      normalizar(r.denominacionUbicacionTecnica).includes(txt) ||
      normalizar(r.ubicacionTecnica).includes(txt) ||
      normalizar(r.descripcion).includes(txt)
    );
    $('txtFiltro').textContent='Equipo: '+$('busquedaEquipo').value;
  }else{
    $('txtFiltro').textContent='Todos los equipos';
  }

  const unidadSeleccionada=$('unidadFiltro').value;
  if(unidadSeleccionada){
    base=base.filter(r=>r.unidad===unidadSeleccionada);
    $('txtFiltro').textContent=`Unidad: ${unidadSeleccionada}`;
  }

  base=ordenarRegistrosPorFecha(base);
  datosBase=base;
  actualizarKPIs();
  renderTablaBase(base.slice(0,300));
  renderTablaUnidades();
  $('filasBase').textContent=`${base.length.toLocaleString('es-CL')} filas`;
}
function construirDatosBase(rows){return rows.filter(r=>valor(r[mapaColumnas.orden]).trim()!=='').map(r=>{const ini=unirFechaHora(r[mapaColumnas.inicioFecha],r[mapaColumnas.inicioHora]), fin=unirFechaHora(r[mapaColumnas.finFecha],r[mapaColumnas.finHora]);const den=valor(r[mapaColumnas.denominacionUbicacionTecnica]), ubi=valor(r[mapaColumnas.ubicacionTecnica]), des=valor(r[mapaColumnas.descripcion]);const texto=`${den} ${ubi} ${des}`;const unidad=obtenerUnidad(texto);return{fechaAviso:convertirFecha(r[mapaColumnas.fechaAviso]),claseAviso:valor(r[mapaColumnas.claseAviso]),aviso:valor(r[mapaColumnas.aviso]),orden:valor(r[mapaColumnas.orden]),descripcion:des,ubicacionTecnica:ubi,denominacionUbicacionTecnica:den,textoClasificacion:texto,unidad:unidad,estadoUnidad:unidad==='Sin clasificar'?'Revisar':'OK',inicioAveria:ini?ini.toLocaleString('es-CL'):'',inicioAveriaFecha:ini,finAveria:fin?fin.toLocaleString('es-CL'):'',finAveriaFecha:fin,fechaEvento:ini||convertirFecha(r[mapaColumnas.fechaAviso]),duracionParada:numero(r[mapaColumnas.duracionParada])};});}
function obtenerUnidad(texto){const n=normalizar(texto);for(const r of [...reglasUsuario,...MAPEO_BASE.map(x=>({buscar:x[0],unidad:x[1]}))]) if(n.includes(normalizar(r.buscar))) return nombreUnidad(r.unidad); return 'Sin clasificar';}
function nombreUnidad(u){return normalizarUnidadGantt(u);}
function actualizarKPIs(){const all=construirDatosBase(datosOriginales);$('kEquipos').textContent=new Set(datosBase.map(r=>r.ubicacionTecnica).filter(Boolean)).size.toLocaleString('es-CL');$('kAvisos').textContent=new Set(datosBase.map(r=>r.aviso).filter(Boolean)).size.toLocaleString('es-CL');$('kSinClasificar').textContent=getPendientes().length.toLocaleString('es-CL');}

function getPendientes(){const all=construirDatosBase(datosOriginales).filter(r=>r.unidad==='Sin clasificar');const m=new Map();for(const r of all){const key=r.denominacionUbicacionTecnica||r.ubicacionTecnica||r.descripcion;if(!m.has(key))m.set(key,{equipo:key,ubicacion:r.ubicacionTecnica,descripcion:r.descripcion,texto:r.textoClasificacion,cantidad:0});m.get(key).cantidad++;}return [...m.values()].sort((a,b)=>b.cantidad-a.cantidad);}
function abrirWizard(){pendientes=getPendientes();pendienteIndex=0;$('wizardClasificacion').classList.remove('hidden');renderWizard();}
function cerrarWizard(){$('wizardClasificacion').classList.add('hidden');aplicarFiltros();}
function renderWizard(){pendientes=getPendientes();if(!pendientes.length){$('wizardContenido').classList.add('hidden');$('wizardFinalizado').classList.remove('hidden');$('wizardProgreso').textContent='Finalizado';return;}$('wizardContenido').classList.remove('hidden');$('wizardFinalizado').classList.add('hidden');if(pendienteIndex>=pendientes.length)pendienteIndex=pendientes.length-1;const p=pendientes[pendienteIndex];$('wizardProgreso').textContent=`${pendienteIndex+1} de ${pendientes.length}`;$('wizardEquipo').textContent=p.equipo;$('wizardUbicacion').textContent=p.ubicacion||'-';$('wizardDescripcion').textContent=p.descripcion||'-';$('wizardCantidad').textContent=p.cantidad;llenarUnidades();$('boxNuevaUnidad').classList.add('hidden');$('wizardNuevaUnidad').value='';}
function llenarUnidades(){const select=$('wizardUnidad');const unidades=[...new Set([...UNIDADES_BASE,...unidadesUsuario])];select.innerHTML='<option value="">Seleccionar unidad</option>'+unidades.map(u=>`<option value="${u}">${nombreUnidad(u)}</option>`).join('')+'<option value="__NUEVA__">➕ Nueva unidad...</option>';}
function guardarWizard(){const p=pendientes[pendienteIndex];let unidad=$('wizardUnidad').value;if(unidad==='__NUEVA__'){unidad=$('wizardNuevaUnidad').value.trim().toUpperCase();if(!unidad)return alert('Escribe el nombre de la nueva unidad.');if(!unidadesUsuario.includes(unidad)){unidadesUsuario.push(unidad);nombresUnidades[unidad]=unidad;localStorage.setItem(KEY_UNIDADES,JSON.stringify(unidadesUsuario));localStorage.setItem(KEY_NOMBRES,JSON.stringify(nombresUnidades));}}if(!unidad)return alert('Selecciona una unidad.');const regla=generarRegla(p.equipo);reglasUsuario.unshift({buscar:regla,unidad});localStorage.setItem(KEY_REGLAS,JSON.stringify(reglasUsuario));aplicarFiltros();pendientes=getPendientes();if(pendienteIndex>=pendientes.length)pendienteIndex=pendientes.length-1;if(!pendientes.length){renderWizard();return;}renderWizard();}
function generarRegla(t){return String(t).split(' ').filter(Boolean).slice(0,6).join(' ');}

function obtenerListaUnidades(){
  const unidades = new Set();

  construirDatosBase(datosOriginales).forEach(r=>{
    if(r.unidad && r.unidad !== 'Sin clasificar') unidades.add(r.unidad);
  });

  bloquesLYD.forEach(b=>unidades.add(nombreUnidad(b.unidad)));
  unidadesUsuario.forEach(u=>unidades.add(nombreUnidad(u)));

  return [...unidades].sort((a,b)=>a.localeCompare(b,'es'));
}

function cargarFiltroUnidades(){
  const actual = $('unidadFiltro')?.value || '';
  const unidades = obtenerListaUnidades();
  $('unidadFiltro').innerHTML = '<option value="">Todas</option>' +
    unidades.map(u=>`<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');

  if(unidades.includes(actual)) $('unidadFiltro').value = actual;
}

let edicionUnidades = {};

function renderTablaUnidades(){
  if(!$('tablaUnidades')) return;

  const unidades = obtenerListaUnidades();

  $('tablaUnidades').querySelector('thead').innerHTML = `
    <tr>
      <th>Unidad</th>
      <th>Editar</th>
    </tr>
  `;

  $('tablaUnidades').querySelector('tbody').innerHTML = unidades.length
    ? unidades.map((unidad, i)=>`
      <tr>
        <td>
          <div id="unidad_texto_${i}" class="unidad-display">${escapeHtml(unidad)}</div>
          <input id="unidad_input_${i}" class="unidad-edit-input hidden"
                 value="${escapeHtml(unidad)}"
                 data-original="${escapeHtml(unidad)}">
        </td>
        <td>
          <button class="edit-pencil" onclick="editarUnidad(${i})" title="Editar nombre">✏️</button>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="2">No hay unidades para mostrar</td></tr>';

  $('btnGuardarUnidades').disabled = true;
}

function editarUnidad(indice){
  const texto = $('unidad_texto_' + indice);
  const input = $('unidad_input_' + indice);
  if(!texto || !input) return;

  texto.classList.add('hidden');
  input.classList.remove('hidden');
  input.focus();
  input.select();

  input.oninput = ()=>{
    edicionUnidades[input.dataset.original] = input.value.trim();
    $('btnGuardarUnidades').disabled = false;
  };
}

function guardarTodosNombresUnidades(){
  const cambios = Object.entries(edicionUnidades)
    .filter(([original,nuevo])=>nuevo && nuevo !== original);

  if(!cambios.length){
    alert('No hay cambios pendientes.');
    return;
  }

  cambios.forEach(([original,nuevo])=>{
    // Actualiza cualquier clave que actualmente muestre el nombre original
    Object.keys(nombresUnidades).forEach(clave=>{
      if(nombreUnidad(clave) === original || clave === original){
        nombresUnidades[clave] = nuevo;
      }
    });

    // Si no existía una clave propia, crea una equivalencia directa
    if(!Object.keys(nombresUnidades).some(clave=>clave===original || nombresUnidades[clave]===nuevo)){
      nombresUnidades[original] = nuevo;
    }

    // Actualiza reglas creadas por el usuario que guarden ese nombre
    reglasUsuario.forEach(regla=>{
      if(nombreUnidad(regla.unidad) === original || regla.unidad === original){
        regla.unidad = nuevo;
      }
    });

    const idx = unidadesUsuario.indexOf(original);
    if(idx >= 0) unidadesUsuario[idx] = nuevo;
  });

  localStorage.setItem(KEY_NOMBRES, JSON.stringify(nombresUnidades));
  localStorage.setItem(KEY_REGLAS, JSON.stringify(reglasUsuario));
  localStorage.setItem(KEY_UNIDADES, JSON.stringify([...new Set(unidadesUsuario)]));

  edicionUnidades = {};
  cargarFiltroUnidades();
  aplicarFiltros();
  renderTablaUnidades();
  setEstado('Validado','ok',`Se guardaron ${cambios.length} cambio(s) de unidad correctamente.`);
}

function escapeHtml(texto){
  return String(texto ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function detectarColumnas(cols){const c=cols.map(x=>({original:x,key:normalizar(x)}));return{fechaAviso:buscar(c,['fechadeaviso','fechaaviso']),claseAviso:buscar(c,['clasedeaviso','claseaviso']),aviso:buscarExact(c,['aviso']),orden:buscar(c,['orden','numeroorden','ordensap']),descripcion:buscar(c,['descripcion','descripciondelaviso','textoaviso']),ubicacionTecnica:buscarExact(c,['ubicaciontecnica']),denominacionUbicacionTecnica:buscar(c,['denominaciondelaubicaciontecnica','denominacionubicaciontecnica','denominaciondelubicaciontecnica']),inicioFecha:buscarExact(c,['iniciodeaveria','inicioaveria']),inicioHora:buscar(c,['iniciodeaveriahora','inicioaveriahora','hora inicio averia']),finFecha:buscarExact(c,['findeaveria','finaveria']),finHora:buscar(c,['findelaaveriahora','findeaveriahora','finaveriahora','hora fin averia']),duracionParada:buscar(c,['duraciondeparada','duracionparada'])};}
function buscar(cols,ps){for(const p0 of ps){const p=normalizar(p0);const e=cols.find(c=>c.key.includes(p)||p.includes(c.key));if(e)return e.original;}return null;}
function buscarExact(cols,ps){for(const p0 of ps){const p=normalizar(p0),e=cols.find(c=>c.key===p);if(e)return e.original;}return buscar(cols,ps);}
function cargarListaEquipos(rows){
  listaEquipos=[...new Set(
    construirDatosBase(rows)
      .map(r=>r.denominacionUbicacionTecnica||r.ubicacionTecnica)
      .filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b,'es'));
}
function mostrarSugerencias(t){$('sugerenciasEquipo').innerHTML='';const clave=normalizar(t);const res=(clave?listaEquipos.filter(e=>normalizar(e).includes(clave)):listaEquipos).slice(0,12);if(!res.length){$('sugerenciasEquipo').innerHTML='<div class="suggestion-empty">Sin coincidencias</div>';$('sugerenciasEquipo').style.display='block';return;}res.forEach(eq=>{$('sugerenciasEquipo').insertAdjacentHTML('beforeend',`<div class="suggestion-item">${eq}</div>`)});[...$('sugerenciasEquipo').children].forEach((d,i)=>d.onclick=()=>{$('busquedaEquipo').value=res[i];ocultarSugerencias();aplicarFiltros();});$('sugerenciasEquipo').style.display='block';}
function ocultarSugerencias(){$('sugerenciasEquipo').style.display='none';}
function renderTablaBase(base){
  $('tablaBase').querySelector('thead').innerHTML=`
    <tr>
      <th>Fecha aviso</th>
      <th>Clase aviso</th>
      <th>Aviso</th>
      <th>Orden</th>
      <th>Descripción</th>
      <th>Ubicación técnica</th>
      <th>Denominación ubicación técnica</th>
      <th>Unidad</th>
      <th>Inicio avería</th>
      <th>Fin avería</th>
      <th>Duración parada</th>
    </tr>
  `;

  $('tablaBase').querySelector('tbody').innerHTML=base.length
    ? base.map(r=>`
      <tr class="${r.unidad==='Sin clasificar'?'fila-sin-clasificar':''}">
        <td>${fmtF(r.fechaAviso)}</td>
        <td>${r.claseAviso}</td>
        <td><span class="copyable" onclick="copiarTexto(this,'${r.aviso}')">${r.aviso}</span></td>
        <td><span class="copyable" onclick="copiarTexto(this,'${r.orden}')">${r.orden}</span></td>
        <td class="descripcion">${r.descripcion}</td>
        <td>${r.ubicacionTecnica}</td>
        <td>${r.denominacionUbicacionTecnica}</td>
        <td>${r.unidad}</td>
        <td>${r.inicioAveria}</td>
        <td>${r.finAveria}</td>
        <td>${fmtN(r.duracionParada)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="11">No hay datos</td></tr>';
}

function extraerBloquesLYD(m){const out=[];if(!m.length)return out;const maxCols=Math.max(...m.slice(0,10).map(f=>f.length));for(let c=1;c<maxCols;c++){let unidad='';for(let r=0;r<Math.min(10,m.length);r++){const v=m[r]?.[c];if(v&& !convertirFecha(v)){unidad=String(v);break;}}if(!unidad)continue;let ini=null,fin=null;for(let r=1;r<m.length;r++){const f=convertirFecha(m[r]?.[0]);if(!f)continue;const is=normalizar(m[r]?.[c]).includes('lyd');if(is&&!ini){ini=f;fin=f}else if(is){fin=f}else if(ini){out.push(crearBloque(unidad,ini,fin));ini=null;fin=null}}if(ini)out.push(crearBloque(unidad,ini,fin));}return out;}
function normalizarUnidadGantt(unidad){
  const n=normalizar(unidad);

  const equivalencias=[
    ['alev','ALEVINAJE'],
    ['alevinaje','ALEVINAJE'],
    ['ff','FF2'],
    ['ff2','FF2'],
    ['hat','HATCHERY'],
    ['hatchery','HATCHERY'],
    ['pre','PRE SMOLT'],
    ['presmolt','PRE SMOLT'],
    ['pre smolt','PRE SMOLT'],
    ['filtrado','FILTRADO'],
    ['riles','RILES'],
    ['ap','AGUA POTABLE'],
    ['agua potable','AGUA POTABLE'],
    ['generadores','GENERADORES'],
    ['generador','GENERADORES']
  ];

  const encontrada=equivalencias.find(([codigo])=>n===normalizar(codigo));
  return encontrada ? encontrada[1] : String(unidad||'').toUpperCase();
}

function crearBloque(unidad,inicio,fin){
  const dias=Math.round((fin-inicio)/86400000)+1;
  return{
    unidad:normalizarUnidadGantt(unidad),
    inicio,
    fin,
    dias,
    horas:dias*24
  };
}
function renderTablaLYD(b){$('tablaLYD').querySelector('thead').innerHTML='<tr><th>Unidad</th><th>Inicio LYD</th><th>Fin LYD</th><th>Días LYD</th><th>Horas no operativas planificadas</th></tr>';$('tablaLYD').querySelector('tbody').innerHTML=b.length?b.map(x=>`<tr><td>${nombreUnidad(x.unidad)}</td><td>${fmtF(x.inicio)}</td><td>${fmtF(x.fin)}</td><td>${x.dias}</td><td>${x.horas}</td></tr>`).join(''):'<tr><td colspan="5">No hay períodos LYD detectados</td></tr>';$('filasLYD').textContent=`${b.length} bloques`;}
function unirFechaHora(fv,hv){const f=convertirFecha(fv);if(!f)return null;const h=convertirHora(hv);return new Date(f.getFullYear(),f.getMonth(),f.getDate(),h.horas,h.minutos,h.segundos);}
function convertirFecha(v){if(!v)return null;if(v instanceof Date&&!isNaN(v))return v;if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+v*86400000);const s=String(v).trim(),m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);if(m)return new Date(+m[3],+m[2]-1,+m[1]);const f=new Date(s);return isNaN(f)?null:f;}
function convertirHora(v){if(!v)return{horas:0,minutos:0,segundos:0};if(v instanceof Date&&!isNaN(v))return{horas:v.getHours(),minutos:v.getMinutes(),segundos:v.getSeconds()};if(typeof v==='number'){const t=Math.round(v*86400);return{horas:Math.floor(t/3600)%24,minutos:Math.floor((t%3600)/60),segundos:t%60};}const m=String(v).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);return m?{horas:+m[1],minutos:+m[2],segundos:+(m[3]||0)}:{horas:0,minutos:0,segundos:0};}
function normalizar(t){return String(t??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function valor(v){return v==null?'':String(v)}function numero(v){if(v==null||v==='')return 0;if(typeof v==='number')return v;const n=Number(String(v).replace(/\./g,'').replace(',','.'));return isNaN(n)?0:n}
function fmtF(f){return f?f.toLocaleDateString('es-CL'):''}function fmtN(n){return Number(n||0).toLocaleString('es-CL',{maximumFractionDigits:2})}
function setEstado(t,cls,d){$('estadoValidacion').textContent=t;$('estadoValidacion').className='status '+cls;$('validacionDetalle').innerHTML=d;}
function mostrarError(msg){setEstado('Error','error',msg);}

document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('.menu-item').forEach(a=>{
   a.addEventListener('click',e=>{
     const v=a.dataset.view;
     if(v==='confiabilidad'){
       document.querySelectorAll('.view').forEach(x=>x.style.display='none');
       const c=document.getElementById('view-confiabilidad');
       if(c) c.style.display='block';
     }
   });
 });
});
