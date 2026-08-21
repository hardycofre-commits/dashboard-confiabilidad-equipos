# Dashboard Confiabilidad Equipos - v5.4

Aplicación estática que lee las fuentes Excel desde GitHub y clasifica los equipos mediante el maestro oficial de ubicaciones técnicas.

## Fuentes

- SAP: el `.xlsx` más reciente de `datos/`; solo se procesan avisos con Orden de Trabajo.
- Plan Anual: el `.xlsx` más reciente de `plan_anual/`.
- Uso de Salas: el `.xlsx` más reciente de `gantt_uso_salas/`.
- El nombre del archivo no determina su tipo; lo determina exclusivamente la carpeta.
- Maestro: `lista_ubicaciones_tecnicas.xlsx` ubicado en la raíz del proyecto. Google no es necesario.

## Confiabilidad

- Selector Anual/Mensual con multiselección.
- Disponibilidad = `(Tiempo exigible - indisponibilidad Z2) / Tiempo exigible`.
- Tiempo exigible 24x7, descontando intervalos programados Z1 y LYD unidos sin duplicar horas.
- Las fallas abiertas o sin fin válido se excluyen.
- Avisos con la misma Orden se consideran un único evento.
- MTBF y MTTR se calculan independientemente para el período seleccionado.

## Navegación

1. Resumen
2. Confiabilidad
3. Plan Anual
4. Carta Gantt Plan Anual
5. Carta Gantt Uso de Salas
