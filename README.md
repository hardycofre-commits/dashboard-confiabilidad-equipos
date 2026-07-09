# Dashboard Confiabilidad Equipos - v1.3

## Cambios principales
- Se elimina el selector manual de archivo.
- El dashboard consulta automáticamente la carpeta `datos/` del repositorio mediante GitHub API.
- Detecta el último archivo Excel `.xlsx` o `.xls`.
- Descarga y procesa el archivo automáticamente.
- Mantiene el botón Actualizar para volver a consultar GitHub.

## Estructura
- index.html
- styles.css
- app.js
- logo.png
- datos/

## Importante
Para que funcione, sube al menos un archivo Excel SAP dentro de la carpeta `datos/`.
El repositorio debe estar público para que GitHub Pages pueda leer la carpeta mediante API.
