# Cierre de migracion Worker

Documento de referencia para retirar Apps Script sin perder funcionalidades.

## Lo que ya esta resuelto

- datos operativos en Supabase
- backend principal en Cloudflare Worker
- sesiones propias del Worker
- archivos y adjuntos nuevos en Cloudflare R2
- enlaces de WhatsApp desde el frontend

## WhatsApp

Estado actual:

- no existe envio automatico por API
- se usa redireccion con `https://wa.me/...` y mensaje precargado
- eso ya es suficiente si el objetivo es abrir el chat con texto predefinido

Conclusion practica:

- WhatsApp no bloquea el retiro de Apps Script
- si solo quieres redireccionar, dejalo en frontend
- si en el futuro quieres envio automatico sin abrir WhatsApp, eso ya requiere una integracion formal con la API de WhatsApp Business

## Correos

Estado actual heredado:

- Apps Script enviaba correos de citas con `MailApp`
- el Worker actual agenda y reagenda, pero no envia esos correos

Recomendacion:

1. mover el envio a un proveedor transaccional invocado desde el Worker
2. separar las plantillas HTML de los datos variables
3. opcionalmente poner el envio en cola para que una cita no dependa del tiempo del proveedor

Plantillas minimas sugeridas:

- confirmacion de cita para paciente
- aviso de nueva cita para doctor
- aviso de reagendamiento para paciente
- aviso de reagendamiento para doctor

## PDFs

Estado actual:

- diagnosticos: el frontend genera los PDF con jsPDF y el Worker los guarda en R2
- evolucion del paciente: se genera en el navegador para descarga directa
- Apps Script tenia plantillas Google Docs para reportes y recetas

Recomendacion principal:

- no guardar una "plantilla PDF" como formato maestro editable
- guardar la plantilla fuente en HTML/CSS o en una estructura JSON
- generar el PDF final a partir de esa plantilla
- guardar el PDF resultante en R2

Opciones practicas:

- mantener generacion en frontend si el formato actual ya te sirve
- mover la generacion al Worker si quieres plantillas centralizadas, control de version y resultados consistentes

## Donde guardar plantillas y PDFs

Para PDFs finales:

- usar Cloudflare R2, porque ya esta integrado en este proyecto

Para plantillas:

- repo del proyecto si son pocas y versionadas
- tabla en Supabase si quieres editarlas desde panel admin
- R2 solo para assets estaticos asociados, no como formato maestro principal

## Lo que falta para cerrar al 100%

1. implementar correos transaccionales desde el Worker
2. decidir si evolucion tambien se almacenara en R2 o seguira como descarga local
3. retirar el fallback restante a Apps Script
4. retirar las lecturas hibridas del frontend cuando ya no hagan falta
5. hacer una pasada final con superadmin y flujos raros antes de apagar el puente heredado
