# Dashboard Confiabilidad Equipos - v5.4

Aplicación estática que lee las fuentes Excel desde GitHub y clasifica los equipos mediante el maestro oficial de ubicaciones técnicas.

## Fuentes

- SAP: `EXPORT ...xlsx`; solo se procesan avisos con Orden de Trabajo.
- Plan Anual: `Plan Anual Mantencion [AÑO].xlsx`.
- Uso de Salas: `Gantt Uso Salas [AÑO].xlsx`.
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
