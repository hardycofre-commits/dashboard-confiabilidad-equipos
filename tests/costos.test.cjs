const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function app(){
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){}},querySelector:sub=>node(id+sub),querySelectorAll:()=>[]});return nodes.get(id);};
  const ctx=vm.createContext({console,localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){},getElementById:node,querySelectorAll:()=>[]}});
  vm.runInContext(source,ctx);
  return {ctx,node,run:code=>vm.runInContext(code,ctx)};
}
test('normaliza identificadores y valores SAP; formato obligatorio',()=>{
  const {run}=app();
  for(const id of [10009984,' 10009984 ','10009984.0','0010009984'])assert.equal(run(`normalizarIdIntervencion(${JSON.stringify(id)})`),'10009984');
  for(const [raw,n] of [['19,18',19.18],['4.299,36',4299.36],['125.430,50',125430.5],[4299.36,4299.36],['',null],['incorrecto',null],[0,0],['19,18-',-19.18]])assert.equal(run(`interpretarCosto(${JSON.stringify(raw)})`),n);
  assert.equal(run('formatoCosto(1250430.75)'),'US$ 1.250.430,75');
  assert.equal(run('formatoCosto(null)'),'');
  assert.equal(run('formatoCosto(0)'),'US$ 0,00');
});
test('índices comparten intervención, deduplican, omiten ausentes y se reemplazan',()=>{
  const {run}=app();
  run(`procesarCostos([{Aviso:1,Orden:2,SumCostPln:'4.299,36'},{Aviso:'1.0',Orden:'2.0',SumCostPln:'4.299,36'}])`);
  assert.equal(run(`costosPorAviso.get('1')===costosPorOrden.get('2')`),true);
  assert.equal(run(`totalCostoIntervenciones([{aviso:1},{aviso:'1.0'},{aviso:999}])`),4299.36);
  assert.equal(run(`totalCostoIntervenciones([{orden:2},{orden:'2.0'},{orden:''}],'orden')`),4299.36);
  run(`procesarCostos([{Aviso:1,Orden:2,'Suma costo plan':19.18}])`);
  assert.equal(run('costoIntervencion(1)'),19.18);
  run(`procesarCostos([{Aviso:'',Orden:25,'Suma de costes plan':19.18},{Aviso:26,Orden:' ','Suma de costes plan':30},{Aviso:27,Orden:28,'Suma de costes plan':40}])`);
  assert.equal(run(`costoIntervencion(25,'orden')`),null);
  assert.equal(run(`costoIntervencion(26)`),null);
  assert.equal(run(`costoIntervencion(27)`),40);
  assert.equal(run(`totalCostoIntervenciones([{orden:25},{orden:28}],'orden')`),40);
  assert.equal(run(`totalCostoIntervenciones([{aviso:26},{aviso:27}])`),40);
  assert.equal(run(`costoIntervencion('')`),null);
  run('procesarCostos([])');
  assert.equal(run('costoIntervencion(1)'),null);
  assert.throws(()=>run(`procesarCostos([{Aviso:1,Orden:2,Otra:10}])`),/SumCostPln/);
});
test('total completo mayor a 300 filas y renderizado del historial vacío',()=>{
  const {run,node}=app();
  run(`procesarCostos(Array.from({length:350},(_,i)=>({Aviso:i+1,Orden:i+1000,SumCostPln:1})));const filasCosto=Array.from({length:350},(_,i)=>({aviso:i+1,costo:1}));mostrarTotalCosto('costoTotalBase',filasCosto);renderTablaBase(filasCosto.slice(0,300));renderCronologiaConfiabilidad(filasCosto);`);
  assert.equal(node('costoTotalBase').textContent,'Costo total intervenciones: US$ 350,00');
  assert.equal(node('costoTotalHistorial').textContent,'Costo total intervenciones: US$ 350,00');
  assert.equal((node('tablaBasetbody').innerHTML.match(/US\$ 1,00/g)||[]).length,300);
  assert.match(node('tablaBasethead').innerHTML,/<th>Duración parada<\/th>\s*<th>Costo<\/th>/);
  run(`renderCronologiaConfiabilidad([])`);
  assert.equal(node('costoTotalHistorial').textContent,'Costo total intervenciones: US$ 0,00');
});
test('Plan Anual filtra y suma una vez cada Orden',()=>{
  const {run,node}=app();
  run(`procesarCostos([{Aviso:1,Orden:2,SumCostPln:10},{Aviso:3,Orden:4,SumCostPln:20}]);planAnual=[{orden:2,equipo:'Bomba',estado:'Pendiente'},{orden:'2.0',equipo:'Bomba',estado:'Pendiente'},{orden:4,equipo:'Motor',estado:'Pendiente'},{orden:'',equipo:'Bomba',estado:'Pendiente'}];renderPlanAnual();`);
  assert.equal(node('costoTotalPlan').textContent,'Costo total intervenciones: US$ 30,00');
  node('planBuscar').value='Bomba';run('renderPlanAnual()');
  assert.equal(node('costoTotalPlan').textContent,'Costo total intervenciones: US$ 10,00');
  node('planBuscar').value='ausente';run('renderPlanAnual()');
  assert.equal(node('costoTotalPlan').textContent,'Costo total intervenciones: US$ 0,00');
});
test('costos no cambian métricas de confiabilidad',()=>{
  const {run}=app();
  assert.equal(run(`(()=>{const r={aviso:1,orden:2,claseAviso:'Z2',unidad:'Hatchery',inicioAveriaFecha:new Date(2026,0,2),finAveriaFecha:new Date(2026,0,3)};const ventana=[[new Date(2026,0,1),new Date(2026,1,1)]];const antes=calcularMetricasPeriodo([r],ventana),despues=calcularMetricasPeriodo([{...r,costo:4299.36}],ventana);delete antes.historial;delete despues.historial;return JSON.stringify(antes)===JSON.stringify(despues);})()`),true);
});
test('SAP: hora se lee de la columna horaria, nunca de la fecha',()=>{
  const {run}=app();
  const result=run(`(()=>{
    const fila={'Aviso':'10031700','Orden':'10011977','Clase de aviso':'Z2','Inicio de avería':new Date(2026,2,21),'Inicio de avería (hora)':'12:32:00','Fin de avería':new Date(2026,6,30),'Fin de la avería (hora)':'14:00:00','Duración de parada':0};
    mapaColumnas=detectarColumnas(Object.keys(fila));const r=construirDatosBase([fila])[0];
    return {inicio:r.inicioAveriaFecha.getHours(),minutos:r.inicioAveriaFecha.getMinutes(),fin:r.finAveriaFecha.getHours(),sinHora:detectarColumnas(['Inicio de avería','Fin de avería']).inicioHora};
  })()`);
  assert.equal(result.inicio,12);assert.equal(result.minutos,32);assert.equal(result.fin,14);assert.equal(result.sinHora,null);
});
test('generador: avisos con parada cero conservan historial y costos sin bajar disponibilidad',()=>{
  const {run}=app();
  const m=run(`(()=>{
    const r={claseAviso:'Z2',unidad:'ELECTRICO Y GENERACION',duracionParada:0};
    return calcularMetricasPeriodo([{...r,aviso:'10031700',orden:'10011977',inicioAveriaFecha:new Date(2026,2,21,12,32),finAveriaFecha:new Date(2026,6,30,14),costo:0},{...r,aviso:'10033904',orden:'10013207',inicioAveriaFecha:new Date(2026,6,24,14,55,32),finAveriaFecha:new Date(2026,6,28,16),costo:889.59}],[[new Date(2026,2,1),new Date(2026,8,1)]]);
  })()`);
  assert.equal(m.disponibilidad,100);assert.equal(m.tiempoIndisponible,0);assert.equal(m.mttr,null);
  assert.equal(m.historial.length,2);assert.equal(m.historial[1].costo,889.59);
  for(const r of m.historial){assert.equal(r.horasFallaPeriodo,0);assert.equal(r.horasProgramadasSuperpuestas,0);assert.equal(r.horasIndisponibles,0);}
});
test('parada oficial prevalece sobre fecha de cierre y se recorta por mes',()=>{
  const {run}=app();
  const m=run(`(()=>{
    const r={aviso:1,orden:2,claseAviso:'Z2',duracionParada:4,inicioAveriaFecha:new Date(2026,0,31,22),finAveriaFecha:new Date(2026,1,10)};
    return [calcularMetricasPeriodo([r],[[new Date(2026,0,1),new Date(2026,1,1)]]),calcularMetricasPeriodo([r],[[new Date(2026,1,1),new Date(2026,2,1)]]),calcularMetricasPeriodo([r],[[new Date(2026,0,1),new Date(2026,2,1)]])];
  })()`);
  assert.equal(m[0].tiempoIndisponible,2);assert.equal(m[1].tiempoIndisponible,2);assert.equal(m[2].tiempoIndisponible,4);
  assert.equal(m[2].mttr,4);
});
test('paradas oficiales superpuestas y programadas no se duplican',()=>{
  const {run}=app();
  const m=run(`(()=>{
    const base={unidad:'U',inicioAveriaFecha:new Date(2026,0,1,2),finAveriaFecha:new Date(2026,0,2),duracionParada:6};
    return calcularMetricasPeriodo([{...base,aviso:1,orden:1,claseAviso:'Z2'},{...base,aviso:2,orden:2,claseAviso:'Z2',inicioAveriaFecha:new Date(2026,0,1,4)},{...base,aviso:3,orden:3,claseAviso:'Z1',duracionParada:2}],[[new Date(2026,0,1),new Date(2026,0,2)]]);
  })()`);
  assert.equal(m.horasProgramadas,2);assert.equal(m.tiempoIndisponible,6);assert.equal(m.tiempoExigible,22);
  assert.equal(m.historial[0].horasProgramadasSuperpuestas,2);
});
test('manifiesto y alternativa GitHub seleccionan la fuente vigente',async()=>{
  const {ctx,run}=app();
  ctx.fetch=async()=>({ok:true,json:async()=>({costo:{nombre:'SAP nuevo.xlsx',ruta:'costo/SAP nuevo.xlsx'}})});
  assert.equal((await run('cargarManifestFuentes()')).costo.download_url,'costo/SAP nuevo.xlsx');
  ctx.fetch=async url=>({ok:true,json:async()=>url.includes('/contents/')?[
    {type:'file',name:'ZZ anterior.xlsx',path:'costo/anterior.xlsx'},
    {type:'file',name:'AA nuevo.xlsx',path:'costo/nuevo.xlsx'},
    {type:'file',name:'ignorar.txt',path:'costo/ignorar.txt'}
  ]:[{commit:{committer:{date:url.includes('nuevo')?'2026-08-27T12:00:00Z':'2026-08-26T12:00:00Z'}}}]});
  assert.equal((await run(`seleccionarExcelMasReciente(CARPETAS_FUENTE.costo)`)).name,'AA nuevo.xlsx');
});
