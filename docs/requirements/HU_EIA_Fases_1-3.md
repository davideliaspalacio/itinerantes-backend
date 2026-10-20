
ESCUELA ITINERANTE DEL AGUA
Historias de Usuario y Flujos Detallados
Plataforma eLearning — Sitio Público, Portal Educativo y Panel Administrativo
Fases 1, 2 y 3 · Backlog completo de producto

Documento técnico de producto
Basado en: Guía de desarrollo web — Escuela Itinerante del Agua y respuestas del cliente (cuestionario de levantamiento)
Septiembre de 2026
Versión 3 — compacta, incorpora respuestas del cliente
Introducción y estándar de documentación
Historias de usuario de la plataforma de la Escuela Itinerante del Agua: Sitio Público, Portal Educativo y Panel Administrativo. Conserva las 14 HUs de la Fase 1 (ajustadas con las respuestas del cliente) y agrega 24 nuevas; la numeración HU-01 a HU-14 no cambia.
Bloques: Sitio Público — Landing (HU-01) · Fase 1 — Portal Educativo (HU-02 a HU-18) · Fase 2 — Postulaciones, becas y pagos (HU-19 a HU-26) · Fase 3 — Panel administrativo (HU-27 a HU-33) · Sitio Público — Páginas completas (HU-34 a HU-38). Cada HU documenta solo lo prioritario; el detalle se resuelve en diseño (Figma) y desarrollo.
Estándar aplicado a cada historia de usuario
Cada historia de usuario se documenta siguiendo exactamente la misma estructura de cinco partes:
	•	Historia de usuario: formato “Como [rol], quiero [acción], para [beneficio]”, junto con el valor que aporta.
	•	Wireframe ilustrativo: boceto esquemático de baja fidelidad que muestra la ubicación de los elementos de la interfaz. NO es el diseño final; el diseño final se construye en Figma según la sección 7 de la guía técnica.
	•	Descripción de campos: tabla con cada campo o elemento interactivo, su tipo, si es obligatorio, su validación y notas relevantes.
	•	Criterios de aceptación: enunciados en formato Dado / Cuando / Entonces (Gherkin), que definen cuándo la historia se considera correctamente implementada.
	•	Descripción completa de la tarea: el detalle necesario para construir la funcionalidad desde la interfaz (frontend y experiencia), junto con la tabla de estados que debe contemplar cada pantalla o flujo (Loading, Empty, Success, Error, Disabled, entre otros), siguiendo el principio de la sección 40 de la guía técnica: “no entregar solamente pantallas”.
Reglas de negocio confirmadas por el cliente
Las siguientes definiciones provienen de las respuestas del cliente al cuestionario de levantamiento y aplican de forma transversal a todas las historias:
	•	Oferta: Diplomado (60 h + proyecto final, ~3 meses, en vivo), Curso (≤ 9 h, en vivo, cuota fija), Taller (presencial y práctico), Eventos (charlas, paneles, masterclasses) y Programas por convocatoria (Aprendices del Agua, Siembra de Agua).
	•	Clases: en vivo; cada módulo tiene presentación, lecturas previas, actividades y grabación; tras cada sesión se registra asistencia; cada oferta tiene grupo de WhatsApp.
	•	Becas: solo diplomados, del 10% al 80%, con carta de intención y evidencias territoriales; más del 70% requiere entrevista por Zoom.
	•	Pagos: Stripe (pago completo, saldo tras beca y cuotas automáticas) y transferencia para México; precios en MXN y USD.
	•	Origen: ofertas NAS se inscriben y pagan en línea; ofertas Moodle ya están pagadas y solo se accede a materiales.
	•	Calendario: 5 categorías de color (Formación, Territorio, Comunidad, Eventos, Fechas importantes); sesiones generadas desde el horario de cada oferta.
Cambios respecto a la versión original (14 HUs)
Historias existentes que se ajustaron con la información nueva del cliente:
HU
Ajuste realizado
HU-01
Contacto embebe el formulario de HU-38 (canal “landing”); cada sección resume su área y remite a HU-34 a HU-38.
HU-02
Se agregó ubicación en cascada (País, Estado, Municipio), zona horaria detectada (CDMX por defecto) y teléfono con indicativo.
HU-06
Se enlazaron Becas y Convocatorias (HU-19 a HU-21), “Continuar” abre el Aula (HU-17) y se agregó aviso de cuotas (HU-24).
HU-07
“Continuar” abre el Aula (HU-17), el vacío lleva al catálogo (HU-15); se agregó próxima sesión y soporte Moodle (HU-25).
HU-08
Cada módulo organiza sus recursos en los cuatro tipos del cliente, con la grabación como enlace por sesión.
HU-10
Cinco categorías de color con leyenda y filtro, talleres, fechas importantes, entrevistas, hora CDMX y sesiones automáticas (HU-29).
HU-11
Zona por defecto pasa a America/Mexico_City; horarios muestran hora CDMX junto a la local; tabla incluye Centroamérica y España.
HU-12
Historial con enlace a grabación y registro de asistencia en ventana de 24 h (HU-18); sesiones canceladas o sin enlace.
HU-13
Nuevos eventos de postulaciones, becas, cuotas, transferencias, asistencia, WhatsApp, grabaciones y cambios de sesión, con nombres de estado de HU-21.
HU-14
Campos alineados con el registro, el País define la moneda (MXN/USD) y nueva pestaña “Mis pagos” (HU-26).

Historias nuevas agregadas: HU-15 a HU-38 (24 en total). La numeración de las HU-01 a HU-14 se conserva sin cambios.
Preguntas clave por confirmar con el cliente
Estas definiciones se documentaron con un supuesto razonable y deben validarse con el cliente antes de desarrollo. El detalle completo de supuestos por HU está en el Anexo A.
	•	¿Postulaciones, becas y pagos (Fase 2) entran en el primer lanzamiento?
	•	¿Qué es exactamente “NAS”? Se asumió que es la nueva plataforma (inscripción y pago en línea).
	•	Moneda y cuotas: ¿México paga en MXN y el resto en USD? ¿2 a 4 cuotas mensuales y suspensión manual a los 15 días de mora?
	•	Becas: ¿los niveles Agua Viva 10%, Ríos Vivos 25%, Aguas Libres 50%, Cenotes Vivos 70% y Beca especial hasta 80% aplican a todos los diplomados? ¿7 días para pagar el saldo?
	•	Convocatorias: necesitamos el formulario actual de Aprendices del Agua y Siembra de Agua, y saber si tienen costo.
	•	Landing: ¿se mantiene “Nuestra trayectoria”? Falta su contenido (historia, premios, equipo) y el texto de Contacto.
	•	Necesitamos el brochure del Diplomado en Ecotecnologías del Agua (nombres de los 9 módulos).
	•	El Google Form público del diplomado muestra datos bancarios y de tarjeta de una persona; se recomienda retirarlos.
Índice de historias de usuario
Sitio Público — Landing page
HU-01  —  Landing page — punto de entrada al ecosistema   (ajustada)
Fase 1 — Portal Educativo (participante)
HU-02  —  Registro en la plataforma   (ajustada)
HU-03  —  Validación de correo electrónico mediante OTP
HU-04  —  Inicio de sesión al portal educativo
HU-05  —  Recuperación de contraseña mediante OTP
HU-06  —  Dashboard personal del participante   (ajustada)
HU-07  —  Consulta de mi Formación (Diplomados, Cursos y Talleres)   (ajustada)
HU-08  —  Consulta y descarga de materiales del curso   (ajustada)
HU-09  —  Exploración de la biblioteca digital
HU-10  —  Calendario central de actividades   (ajustada)
HU-11  —  Conversor automático de horarios   (ajustada)
HU-12  —  Acceso a sesiones en vivo (Zoom / Google Meet)   (ajustada)
HU-13  —  Notificaciones del portal   (ajustada)
HU-14  —  Consulta y edición del perfil de usuario   (ajustada)
HU-15  —  Catálogo de oferta formativa   (nueva)
HU-16  —  Ficha de detalle de una oferta formativa   (nueva)
HU-17  —  Aula: detalle de mi formación   (nueva)
HU-18  —  Registro de asistencia a una sesión   (nueva)
Fase 2 — Postulaciones, becas y pagos
HU-19  —  Postulación a beca de diplomado   (nueva)
HU-20  —  Postulación a convocatoria de programa presencial   (nueva)
HU-21  —  Seguimiento de mis postulaciones   (nueva)
HU-22  —  Inscripción y pago completo con Stripe   (nueva)
HU-23  —  Pago del saldo tras beca (Stripe o transferencia México)   (nueva)
HU-24  —  Plan de pago en cuotas con cobro automático   (nueva)
HU-25  —  Acceso de participantes inscritos por Moodle   (nueva)
HU-26  —  Mis pagos y comprobantes   (nueva)
Fase 3 — Panel administrativo
HU-27  —  Crear y editar una oferta formativa   (nueva)
HU-28  —  Gestión de módulos y recursos pedagógicos   (nueva)
HU-29  —  Generación automática de sesiones en el calendario   (nueva)
HU-30  —  Control de asistencia por sesión   (nueva)
HU-31  —  Revisión de postulaciones en equipo   (nueva)
HU-32  —  Seguimiento de postulación a inscripción (embudo)   (nueva)
HU-33  —  Gestión de pagos, cuotas y transferencias   (nueva)
Sitio Público — Páginas completas
HU-34  —  Página Itinerantes del Agua / Escuela Itinerante del Agua   (nueva)
HU-35  —  Página Diseño y Asesoría   (nueva)
HU-36  —  Página Innovación y tecnologías regenerativas (incl. HAWA)   (nueva)
HU-37  —  Página Nuestra trayectoria (Quiénes somos)   (nueva)
HU-38  —  Página Contacto   (nueva)
Sitio Público — Landing page
Punto de entrada al ecosistema; enlaza las páginas completas (HU-34 a HU-38).
HU-01 — Landing page — punto de entrada al ecosistema
Rol / actor: Visitante público (aún no registrado)
1. Historia de usuario
Como visitante nuevo, quiero una landing a pantalla completa que recorra las áreas desde Itinerantes del Agua hasta Contacto, para entender qué ofrece cada una y cómo formarme o escribir al equipo.
Beneficio / valor: Primera impresión del ecosistema: resume sus tres áreas y lleva a cada página completa (ver HU-34 a HU-38) o a escribir al equipo.
2. Wireframe ilustrativo

Figura 01 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Hero a pantalla completa
Sección 100vh
—
Animación ligera (CSS/SVG/canvas), nunca video; imagen estática de respaldo
Título “Escuela Itinerante del Agua”; subtítulo “Aprende ecotecnologías para las aguas vivas”; cauce con luciérnagas
Nuestra trayectoria (supuesto)
Acordeón (scroll-reveal)
—
Solo si Historia y Equipo tienen contenido
Historia, premios y equipo; antes de Itinerantes del Agua si se confirma (ver HU-37)
Itinerantes del Agua
Acordeón (scroll-reveal)
—
—
La Escuela y sus tres caminos: formación especializada, cursos online, aprendizaje práctico (ver HU-34)
Diseño y Asesoría
Acordeón (scroll-reveal)
—
—
Soluciones basadas en la naturaleza para cada territorio; 5 servicios (ver HU-35)
Innovación y tecnologías regenerativas
Acordeón (scroll-reveal)
—
—
Captación, tratamiento, regeneración del paisaje y HAWA destacado (ver HU-36 #hawa)
Contacto
Acordeón + formulario
—
Validaciones y anti-spam de HU-38
Formulario único de HU-38 con canal “landing”; confirma sin salir de la página
4. Criterios de aceptación
	•	Dado que un visitante abre la landing, cuando termina de cargar, entonces ve el hero a pantalla completa con título, subtítulo y fondo animado ligero, sin video y sin retrasar la aparición del título.
	•	Dado que la animación no carga, tarda demasiado o el visitante activó “prefers-reduced-motion”, cuando se muestra el hero, entonces aparece la imagen estática de respaldo con la misma atmósfera.
	•	Dado que hago scroll, cuando las secciones entran en vista, entonces aparecen en orden Itinerantes del Agua → Diseño y Asesoría → Innovación y tecnologías regenerativas → Contacto; al expandir una veo su resumen y “Ver página completa”.
	•	Dado que completo el formulario de Contacto con datos válidos y acepto la política de datos, cuando lo envío, entonces veo la confirmación en la misma sección y el mensaje queda registrado con canal “landing” (ver HU-38).
	•	Dado que falta un campo obligatorio, el correo es inválido o el envío se detecta como spam, cuando intento enviar, entonces se aplican las validaciones y reglas anti-spam de HU-38.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Hero 100vh centrado con indicador sutil “desliza para explorar”; el fondo nunca es video y siempre tiene imagen de respaldo.
	•	Acordeones con scroll-reveal: colapsados, título y frase; expandidos, resumen y “Ver página completa”; el texto literal vive en HU-34 a HU-38.
	•	Mobile-first: secciones apiladas a ancho completo, solo una expandida a la vez; carga diferida bajo el pliegue.
5.2 Estados de la interfaz
Estado
Descripción
Default
Hero con fondo animado; secciones colapsadas con título y frase corta.
Fallback
Animación no disponible o movimiento reducido: imagen estática de respaldo.
Success
Confirmación “¡Gracias! Recibimos tu mensaje.” dentro de la sección Contacto.
Error
Validación en línea o envío bloqueado por anti-spam, con opción de reintentar.

Fase 1 — Portal Educativo (participante)
Experiencia del participante en el Portal Educativo, incluidas cuatro HUs nuevas: catálogo, ficha de la oferta, aula y asistencia (HU-15 a HU-18).
HU-02 — Registro en la plataforma
Rol / actor: Nuevo participante
1. Historia de usuario
Como nuevo participante, quiero crear una cuenta con mis datos básicos, ubicación y zona horaria, para acceder al portal educativo e inscribirme en la formación disponible.
Beneficio / valor: Es la puerta de entrada al portal; capturar país, ubicación y zona horaria desde el inicio permite mostrar horarios y precios correctos al público latinoamericano.
2. Wireframe ilustrativo

Figura 02 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Nombre completo
Texto
Sí
No vacío; solo letras, tildes, ñ y espacios
Personaliza el portal (“Hola, [Nombre]”) y las comunicaciones
Username y correo
Texto / email
Sí
Únicos; correo con formato válido
Correo para login (ver HU-04) y OTP (ver HU-03); username no editable (ver HU-14)
País y ubicación
Selectores en cascada
Sí
Estado y municipio dependen del país; texto libre sin lista
México y Centroamérica primero; país define MXN/USD (ver HU-22) y transferencia (ver HU-23)
Zona horaria
Selector (prellenado)
Sí
Zona IANA; del navegador o America/Mexico_City si falla
Base para convertir desde hora CDMX (ver HU-11); editable en Perfil (ver HU-14)
Teléfono
Indicativo + número
Sí
Solo dígitos; longitud válida para el indicativo
Indicativo sugerido por país; se usa para seguimiento por WhatsApp
Contraseña
Texto (oculto)
Sí
Mínimo 8 caracteres, al menos una letra y un número
Solo hash; misma regla en recuperación (ver HU-05) y Perfil (ver HU-14)
4. Criterios de aceptación
	•	Dado que completo todos los campos obligatorios con datos válidos, cuando envío el registro, entonces se crea mi cuenta “pendiente de verificación”, se envía un OTP a mi correo y paso a su validación (ver HU-03).
	•	Dado que elijo un país con lista cargada (p. ej. México), cuando completo la ubicación, entonces solo veo sus divisiones y municipios; si el país no tiene lista, ambos campos son texto libre obligatorio.
	•	Dado que abro el registro, cuando se carga, entonces la zona horaria aparece prellenada con la detectada por el navegador o, si falla, con America/Mexico_City y un aviso para confirmarla.
	•	Dado que el correo o username ya está registrado o un campo obligatorio falta o es inválido, cuando intento enviar, entonces veo el error en línea y “Crear cuenta” sigue deshabilitado.
	•	Dado que no verifiqué mi correo, cuando intento iniciar sesión, entonces el sistema me pide verificar la cuenta y me lleva a la validación por OTP (ver HU-03).
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Formulario centrado, mobile-first: nombre, username, correo, país, ubicación, zona horaria, teléfono y contraseña; enlace a login (ver HU-04).
	•	Ubicación en cascada: cada selector se habilita al elegir el anterior; País con búsqueda, México y Centroamérica primero.
	•	Zona horaria con ayuda “Detectamos tu zona horaria: [zona]. Puedes cambiarla.”; teléfono con indicativo a la izquierda.
5.2 Estados de la interfaz
Estado
Descripción
Loading
“Crear cuenta” deshabilitado mientras se crea la cuenta.
Warning (zona horaria)
Detección fallida: queda America/Mexico_City con un aviso para confirmarla.
Error
Correo o username ya registrado, formato inválido o error del servidor.
Success
Redirección automática a la validación de correo por OTP (ver HU-03).

HU-03 — Validación de correo electrónico mediante OTP
Rol / actor: Nuevo participante (cuenta recién creada)
1. Historia de usuario
Como nuevo participante que acaba de registrarse, quiero ingresar el código OTP que llegó a mi correo, para verificar que la cuenta me pertenece y activarla.
Beneficio / valor: Confirma que el correo es real y pertenece al participante, evitando cuentas falsas o con errores de digitación antes de dar acceso al portal.
2. Wireframe ilustrativo

Figura 03 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Correo de referencia
Texto (solo lectura)
—
—
Correo al que se envió el código, parcialmente enmascarado (ej. “j***@correo.com”)
Código OTP
Numérico (6 dígitos)
Sí
Debe coincidir con el código vigente; expira tras un tiempo definido
Casillas por dígito con avance automático y opción de pegar el código completo
Enlace “Reenviar código”
Acción
—
Disponible al terminar la cuenta regresiva (cooldown)
Envía un código nuevo e invalida el anterior
Botón “Verificar”
Acción
—
Se habilita al completar el código
Valida el código y activa la cuenta
4. Criterios de aceptación
	•	Dado que ingreso el código OTP correcto y vigente, cuando presiono “Verificar”, entonces mi cuenta queda activada y soy dirigido al inicio de sesión (ver HU-04) o al Dashboard si ya tengo sesión.
	•	Dado que el código es incorrecto o ya expiró, cuando intento verificarlo, entonces veo el mensaje específico y puedo reintentar o solicitar un código nuevo.
	•	Dado que terminó la cuenta regresiva, cuando presiono “Reenviar código”, entonces recibo un código nuevo en mi correo y el anterior queda invalidado.
	•	Dado que agoto el máximo de intentos fallidos consecutivos, cuando intento de nuevo, entonces el sistema aplica un bloqueo temporal antes de permitir otro intento.
	•	Dado que abandono la pantalla sin verificar, cuando intento iniciar sesión más tarde, entonces el sistema me redirige aquí hasta completar la verificación.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Pantalla centrada, mobile-first, con el correo de destino enmascarado para que el usuario confirme que es el correcto.
	•	“Reenviar código” deshabilitado con cuenta regresiva visible (ej. “Reenviar en 00:30”); “Verificar” se habilita al completar todos los dígitos.
	•	Mensajes de error específicos (código incorrecto, expirado, demasiados intentos) sin revelar información sensible del sistema.
5.2 Estados de la interfaz
Estado
Descripción
Default
Código recién enviado; casillas vacías listas para completarse.
Loading
“Verificar” deshabilitado mientras se valida el código.
Error
Código incorrecto, expirado o límite de intentos alcanzado, con su mensaje.
Success
Cuenta verificada; redirección al login (ver HU-04) o al Dashboard.

HU-04 — Inicio de sesión al portal educativo
Rol / actor: Participante registrado
1. Historia de usuario
Como participante ya registrado en la Escuela, quiero iniciar sesión con mi correo electrónico y contraseña, para acceder a mi portal educativo personal de forma segura.
Beneficio / valor: Protege la información personal y los materiales de cada participante; es la puerta de entrada obligatoria a todo el portal educativo.
2. Wireframe ilustrativo

Figura 04 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Correo electrónico
Texto / email
Sí
Formato de correo válido
Identificador único del usuario
Contraseña
Texto (oculto)
Sí
Mínimo 8 caracteres
Nunca se muestra en texto plano ni se transmite sin cifrar
Recordarme
Checkbox
No
—
Extiende la duración de la sesión en este dispositivo
Enlace “Recuperar contraseña”
Acción
—
—
Lleva a la recuperación de contraseña por OTP (ver HU-05)
4. Criterios de aceptación
	•	Dado que soy un usuario registrado y verificado, cuando ingreso correo y contraseña correctos, entonces accedo al Dashboard (ver HU-06) o a la página que intentaba visitar.
	•	Dado que ingreso una combinación de correo y contraseña incorrecta, cuando envío el formulario, entonces veo un mensaje genérico, sin indicar cuál de los dos campos falló.
	•	Dado que fallo el inicio de sesión varias veces seguidas, cuando lo intento de nuevo, entonces el sistema aplica un bloqueo temporal de intentos.
	•	Dado que mi sesión expiró por inactividad, cuando intento acceder a una ruta de /portal, entonces soy redirigido a esta pantalla de login.
	•	Dado que dejo el correo o la contraseña vacíos, cuando intento enviar, entonces veo una validación en línea y “Ingresar” permanece deshabilitado.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Formulario centrado, mobile-first, con foco automático en el campo de correo al cargar.
	•	“Ingresar” cambia a “Ingresando…” deshabilitado mientras se validan las credenciales.
	•	Mensaje de error genérico debajo del formulario; se conserva el correo ingresado y se limpia la contraseña.
5.2 Estados de la interfaz
Estado
Descripción
Default
Formulario vacío, listo para completarse.
Loading
Botón “Ingresando…” deshabilitado mientras se validan las credenciales.
Error
Mensaje genérico de credenciales inválidas o bloqueo temporal por intentos.
Success
Redirección al Dashboard o a la página solicitada.

HU-05 — Recuperación de contraseña mediante OTP
Rol / actor: Participante registrado que olvidó su contraseña
1. Historia de usuario
Como participante que olvidó su contraseña, quiero verificar un código OTP enviado a mi correo y definir una nueva contraseña, para recuperar el acceso sin ayuda del equipo de la Escuela.
Beneficio / valor: Evita que un participante quede bloqueado fuera de su cuenta y reduce las solicitudes manuales de restablecimiento al equipo administrativo.
2. Wireframe ilustrativo

Figura 05 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Correo electrónico
Texto / email
Sí
Formato válido; debe corresponder a una cuenta registrada
Paso 1: ubica la cuenta y envía el código OTP
Código OTP
Numérico (6 dígitos)
Sí
Debe coincidir con el código vigente; expira tras un tiempo definido
Paso 2: mismas casillas y reenvío con cuenta regresiva (ver HU-03)
Nueva contraseña
Texto (oculto)
Sí
Mínimo 8 caracteres, al menos una letra y un número
Paso 3: mismas reglas del registro (ver HU-02)
Confirmar nueva contraseña
Texto (oculto)
Sí
Debe coincidir exactamente con “Nueva contraseña”
Paso 3: indicador de coincidencia en tiempo real
4. Criterios de aceptación
	•	Dado que ingreso el correo de una cuenta existente, cuando presiono “Enviar código”, entonces se envía un OTP a ese correo y avanzo al paso de verificación.
	•	Dado que ingreso un correo que no corresponde a ninguna cuenta, cuando presiono “Enviar código”, entonces el sistema me informa que no existe una cuenta con ese correo y no envía código.
	•	Dado que ingreso el OTP, cuando presiono “Verificar código”, entonces avanzo al paso 3 si es correcto; si es incorrecto o expiró, veo el error y puedo reenviarlo (bloqueo por intentos: ver HU-03).
	•	Dado que defino una nueva contraseña válida y coincidente, cuando presiono “Guardar contraseña”, entonces queda actualizada, el OTP usado se invalida y soy redirigido al login (ver HU-04).
	•	Dado que la nueva contraseña y su confirmación no coinciden, cuando intento guardar, entonces veo la validación en línea y “Guardar contraseña” permanece deshabilitado.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Flujo de tres pasos centrados, mobile-first, con indicador de progreso: (1) correo, (2) código OTP, (3) nueva contraseña.
	•	El paso 2 reutiliza las casillas por dígito y la cuenta regresiva de reenvío de la verificación de registro (ver HU-03).
	•	Enlace “Volver al login” en cada paso; al terminar, confirmación y redirección automática al login (ver HU-04).
5.2 Estados de la interfaz
Estado
Descripción
Default
Paso 1 con el campo de correo vacío.
Loading
Botón del paso actual deshabilitado mientras se procesa.
Error
Correo no encontrado, OTP incorrecto o expirado, o contraseñas que no coinciden.
Success
Contraseña actualizada; confirmación y redirección al login (ver HU-04).

HU-06 — Dashboard personal del participante
Rol / actor: Participante
1. Historia de usuario
Como participante, quiero ver al iniciar sesión mi próxima actividad, mi formación activa y accesos rápidos, para saber de inmediato qué debo hacer sin buscar la información.
Beneficio / valor: Reduce la fricción: el participante entiende en segundos qué tiene que hacer ahora, qué sigue y dónde entra, incluidos los avisos de pagos pendientes.
2. Wireframe ilustrativo

Figura 06 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Aviso de cuota
Banner de alerta
—
Cuota en los próximos 7 días, o plan “Cobro fallido”/“En mora”
Monto, fecha y tarjeta ####; si falló: “Actualizar tarjeta” y “Pagar ahora” (ver HU-24)
Próxima actividad
Tarjeta destacada
—
Solo si hay un evento futuro del usuario
Nombre, hora en su zona y hora CDMX (ver HU-11), botón de acceso (ver HU-12)
Mi formación
Lista de tarjetas
—
Máximo configurable; “Ver toda mi formación” (ver HU-07)
Nombre y % de progreso; “Continuar” abre el Aula (ver HU-17)
Widget Becas
Resumen + estado
—
Siempre visible
Estado de la postulación más reciente (ver HU-21); sin postulaciones, invita a postular (ver HU-19)
Widget Convocatorias
Contador + resumen
—
—
Nuevas desde el último ingreso (ver HU-20) y estado de mi postulación (ver HU-21)
Widgets Calendario y Biblioteca
Resumen visual
—
—
Próximos eventos con color de categoría (ver HU-10) y material recomendado (ver HU-09)
4. Criterios de aceptación
	•	Dado que tengo formación activa y una sesión en las próximas 24 h, cuando entro al Dashboard, entonces veo “Próxima actividad” en mi zona horaria con acceso, y mis formaciones con % de progreso y “Continuar” (ver HU-17).
	•	Dado que una cuota de mi plan se cobrará en los próximos 7 días, cuando entro al Dashboard, entonces veo un aviso informativo con monto, fecha del cobro automático y tarjeta asociada (ver HU-24).
	•	Dado que un cobro automático falló o mi plan está “En mora”, cuando entro al Dashboard, entonces veo un aviso destacado con “Actualizar tarjeta” y “Pagar ahora”, que no se cierra hasta regularizar el pago.
	•	Dado que tengo una postulación a beca o convocatoria, cuando entro al Dashboard, entonces el widget correspondiente muestra su estado actual (p. ej. “Entrevista agendada”) y enlaza a Mis postulaciones (ver HU-21).
	•	Dado que un bloque falla al cargar o no tiene datos, cuando se muestra el Dashboard, entonces ese bloque presenta error con reintento o un mensaje orientador, sin afectar los demás.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Orden: banner de cuota (si aplica), “Próxima actividad” destacada, “Mi formación” y widgets; en mobile se apilan por prioridad.
	•	Aviso de cuota con dos niveles: informativo (cuota próxima, se puede cerrar) y destacado (cobro fallido o “En mora”, persistente).
	•	Los widgets de Becas y Convocatorias usan los mismos nombres de estado que Mis postulaciones (ver HU-21).
5.2 Estados de la interfaz
Estado
Descripción
Empty
Sin próxima actividad o sin formación: mensaje orientador en el bloque afectado.
Success
Todos los bloques cargados con datos reales del usuario.
Warning (cuota)
Banner de cuota próxima (informativo) o de cobro fallido / “En mora” (destacado).
Error
El bloque muestra “No se pudo cargar esta información” con reintento.

HU-07 — Consulta de mi Formación (Diplomados, Cursos y Talleres)
Rol / actor: Participante
1. Historia de usuario
Como participante, quiero ver en el menú “Formación” mis diplomados, cursos y talleres inscritos con su progreso, para retomar fácilmente mi aprendizaje donde lo dejé.
Beneficio / valor: Refleja la estructura real de la oferta (Diplomados, Cursos, Talleres) y muestra al participante en qué está inscrito y cuánto le falta.
2. Wireframe ilustrativo

Figura 07 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Menú “Formación”
Grupo expandible (sidebar)
—
—
Sub-ítems Diplomados, Cursos y Talleres; cada uno lista solo las inscripciones de ese tipo
Pestañas de estado
Tabs
—
—
Activos / Completados / Todos, dentro del tipo seleccionado
Tarjeta de formación
Imagen + texto
—
—
Portada, nombre y % de progreso (sesiones con asistencia ÷ sesiones programadas, ver HU-17)
Próxima sesión
Texto dinámico
—
Solo si hay sesión futura; si no, “Finalizado” o “Sin sesiones próximas”
“11:00 tu hora · 10:00 hora CDMX” (ver HU-11); talleres: hora local y sede
Botón “Continuar”
Acción
—
Solo con inscripción activa
Abre el Aula de esa formación (ver HU-17)
Soporte Moodle
Badge + enlace
—
Badge solo en inscripciones de origen Moodle; enlace siempre visible
Badge “Vía Moodle” (pago externo); “¿No ves tu formación?” vincula con código (ver HU-25)
4. Criterios de aceptación
	•	Dado que selecciono Diplomados, Cursos o Talleres en el menú Formación, cuando la página carga, entonces veo solo mis inscripciones de ese tipo con su % de progreso y “Continuar” abre su Aula (ver HU-17).
	•	Dado que una formación activa tiene sesiones futuras, cuando reviso su tarjeta, entonces veo la próxima sesión en mi zona horaria con la hora CDMX de referencia (ver HU-11).
	•	Dado que una inscripción proviene de Moodle, cuando reviso su tarjeta, entonces veo la etiqueta “Vía Moodle” y “Continuar” funciona igual que en el resto (ver HU-25).
	•	Dado que intento acceder por URL a una formación en la que no estoy inscrito, cuando la ruta se solicita, entonces el sistema me niega el acceso.
	•	Dado que no tengo inscripciones de un tipo, cuando entro a esa sección, entonces veo un estado vacío con un botón al catálogo filtrado por ese tipo (ver HU-15).
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	“Formación” es un ítem expandible del sidebar con tres sub-ítems navegables de forma independiente.
	•	Grid de tarjetas: una columna en mobile, dos en tablet y tres en desktop; reutiliza el componente “Course card”.
	•	“Vía Moodle” discreta junto al nombre; la pestaña de estado elegida se recuerda por sub-ítem durante la sesión.
5.2 Estados de la interfaz
Estado
Descripción
Loading
Tarjetas en skeleton mientras se carga el tipo seleccionado.
Empty
“Aún no tienes [diplomados/cursos/talleres]” con botón al catálogo filtrado (ver HU-15).
Success
Tarjetas del tipo seleccionado con progreso real y próxima sesión.
Error
Mensaje de error al cargar con opción de reintentar.

HU-08 — Consulta y descarga de materiales del curso
Rol / actor: Participante
1. Historia de usuario
Como participante inscrito, quiero consultar y descargar los recursos de cada módulo —presentación, lecturas previas, actividades y grabación—, para prepararme antes de cada clase en vivo y repasar después.
Beneficio / valor: Centraliza el material sin depender de correo o WhatsApp; cuatro tipos fijos de recurso por módulo indican qué revisar antes y después de cada sesión.
2. Wireframe ilustrativo

Figura 08 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Acordeón de módulo
Componente expandible
—
—
Muestra cuatro grupos fijos en orden (ej.: 9 módulos del Diplomado en Ecotecnologías del Agua)
Presentación del módulo
Archivo o enlace
—
Uno por módulo; visible al publicarse (ver HU-28)
Objetivos, contenidos y docente del módulo
Lecturas previas y actividades
Lista de archivos/enlaces
—
0 a n recursos por grupo
Actividades con fecha de entrega aparecen en el calendario como “Fecha importante” (ver HU-10)
Grabación de la sesión
Enlace externo
—
Una por sesión; visible cuando el equipo carga el enlace
Sin enlace: “Disponible después de la sesión” o “Grabación pendiente” (ver HU-12)
Ítem y acción “Descargar”/“Ver”
Nombre + ícono + botón
—
Requiere inscripción activa
Ícono por tipo; archivos con URL temporal; grabaciones y enlaces en pestaña nueva
4. Criterios de aceptación
	•	Dado que un módulo tiene recursos, cuando lo expando, entonces veo sus cuatro grupos en orden: Presentación del módulo, Lecturas previas, Actividades y Grabación de la sesión.
	•	Dado que el equipo cargó la grabación de una sesión, cuando hago clic en “Ver grabación”, entonces se abre en una pestaña nueva; si aún no existe, veo “Disponible después de la sesión” o “Grabación pendiente”.
	•	Dado que no tengo inscripción activa en esa formación, cuando intento acceder a sus materiales, entonces veo “No autorizado” y no se expone ningún enlace de descarga.
	•	Dado que el enlace de descarga generado expiró, cuando intento usarlo, entonces veo el error y puedo generar uno nuevo.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Acordeón de módulos: en mobile solo uno expandido a la vez; cada subtítulo de grupo indica cuántos recursos contiene.
	•	“Ver grabación” con fecha, uno por sesión (p. ej. sábado y domingo del mismo módulo).
	•	Cada recurso o grabación publicada se notifica con enlace directo al módulo (ver HU-13).
5.2 Estados de la interfaz
Estado
Descripción
Empty
Módulo o grupo sin recursos publicados (“Sin recursos por ahora”).
Pending (grabación)
Sin enlace: “Disponible después de la sesión” o “Grabación pendiente”.
Error
Enlace expirado o archivo no disponible.
Unauthorized
Sin inscripción activa o acceso suspendido por mora: aviso para regularizar el pago (ver HU-24).

HU-09 — Exploración de la biblioteca digital
Rol / actor: Participante
1. Historia de usuario
Como participante, quiero explorar una biblioteca de recursos (PDFs, artículos, libros, videos, audios y recursos externos), para complementar mi formación con material adicional.
Beneficio / valor: Ofrece un espacio de consulta permanente que no depende de que el participante esté cursando una clase específica.
2. Wireframe ilustrativo

Figura 09 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Filtro por tipo
Chips / tabs
—
PDF, artículo, libro, video, audio, recurso externo, material de curso
Filtra la biblioteca por tipo de contenido
Buscador
Campo de texto
No
—
Busca por título o palabra clave
Tarjeta de recurso
Imagen + texto
—
—
Miniatura, título y tipo de recurso
Visibilidad del recurso
Atributo del recurso
—
Público o exclusivo de un curso
Los recursos de un curso solo aparecen a sus inscritos
4. Criterios de aceptación
	•	Dado que selecciono un filtro de tipo (p. ej. “Video”), cuando se aplica, entonces la lista muestra únicamente recursos de ese tipo.
	•	Dado que un recurso está marcado como público, cuando cualquier participante autenticado lo busca, entonces puede visualizarlo.
	•	Dado que un recurso es exclusivo de un curso, cuando lo busca un participante no inscrito en ese curso, entonces no aparece en su biblioteca.
	•	Dado que no hay resultados para el filtro o la búsqueda, cuando la lista se actualiza, entonces se muestra un estado vacío con la opción de limpiar filtros.
	•	Dado que hago clic en un recurso externo, cuando la acción se ejecuta, entonces se abre en una pestaña nueva sin perder mi sesión en el portal.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Grid de tarjetas responsive (2 a 4 columnas según el ancho de pantalla).
	•	Filtros persistentes mientras el usuario navega dentro de la sección.
	•	Buscador con retraso (debounce) antes de disparar la consulta.
5.2 Estados de la interfaz
Estado
Descripción
Loading
Skeletons de tarjetas mientras se cargan los recursos.
Empty
“No encontramos recursos con este filtro” con opción de limpiar filtros.
Success
Recursos mostrados según el filtro o la búsqueda aplicada.
Error
Error al cargar la biblioteca con opción de reintentar.

HU-10 — Calendario central de actividades
Rol / actor: Participante
1. Historia de usuario
Como participante, quiero ver mis clases, talleres, encuentros, eventos y fechas importantes en un calendario con colores y filtro por categoría, para organizar mi tiempo y no perderme ninguna actividad.
Beneficio / valor: Centraliza las fechas del proceso formativo; 5 categorías de color evitan saturación y las sesiones se generan solas desde cada oferta (ver HU-29).
2. Wireframe ilustrativo

Figura 10 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Categorías de color
Leyenda + filtro
No
Formación azul, Territorio verde, Comunidad naranja, Eventos morado, Fechas importantes rojo
Chips que filtran sin recargar; todas activas por defecto; se conservan en la sesión
Evento y detalle
Bloque de color + modal
—
Color según su categoría
Detalle: “11:00 tu hora · 10:00 hora CDMX” (ver HU-11), modalidad y enlace (ver HU-12)
Sesiones de formación
Eventos automáticos
—
Generadas desde el horario de la oferta (ver HU-29); no editables
Ej.: Diplomado en Ecotecnologías del Agua, sábados y domingos 10:00–13:00 hora CDMX
Talleres presenciales
Evento Territorio
—
Solo para inscritos en el taller
Hora local y sede, sin enlace de conexión (ej. biofiltro para aguas jabonosas)
Fechas importantes
Evento día completo
—
Inscripciones, becas, convocatorias, entregas y proyecto final; entrevistas con hora
Enlazan a oferta, beca, convocatoria o entrevista (ver HU-16, HU-19, HU-20, HU-21)
4. Criterios de aceptación
	•	Dado que tengo eventos en el mes, cuando entro al calendario o desmarco una categoría, entonces veo cada evento con el color de su categoría y los de categorías desmarcadas se ocultan sin recargar.
	•	Dado que estoy inscrito en el Diplomado en Ecotecnologías del Agua, cuando consulto el calendario, entonces veo sus clases de sábados y domingos 10:00–13:00 hora CDMX, convertidas a mi zona y generadas automáticamente (ver HU-29).
	•	Dado que hago clic en un evento, cuando se abre el detalle, entonces veo la hora en mi zona y la hora CDMX de referencia y, si aplica, el enlace de acceso (ver HU-12).
	•	Dado que hay una apertura o cierre de inscripciones, becas o convocatorias, o una entrevista agendada, cuando consulto el calendario, entonces la veo en Fechas importantes con enlace a la oferta, convocatoria o postulación.
	•	Dado que un evento es solo para cierta audiencia (p. ej. inscritos en un taller), cuando lo consulta alguien fuera de ella, entonces no lo ve en su calendario.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Cuadrícula mensual en desktop; en mobile, lista por día o semana con barra de color por evento.
	•	Leyenda: Formación (clases, cursos, diplomados), Territorio (instalaciones, talleres presenciales), Comunidad (encuentros), Eventos (webinars, paneles, masterclasses), Fechas importantes (entregas, cierres, inscripciones).
	•	Cada evento lleva etiqueta o ícono de categoría (no solo color); sesiones canceladas (ver HU-29) siguen visibles como “Cancelada”, sin enlace.
5.2 Estados de la interfaz
Estado
Descripción
Loading
Cuadrícula en skeleton mientras se cargan los eventos del mes.
Empty
Mes sin eventos: cuadrícula vacía, sin mensajes de error.
Success
Eventos del mes mostrados con su color y categoría.
Error
Error al cargar eventos con opción de reintentar.

HU-11 — Conversor automático de horarios
Rol / actor: Participante (México, Centroamérica y Latinoamérica)
1. Historia de usuario
Como participante de México, Centroamérica u otro país de Latinoamérica, quiero ver cada actividad en hora CDMX y convertida automáticamente a mi zona horaria, para no confundirme con la hora real de inicio.
Beneficio / valor: La Escuela publica en hora CDMX para participantes de varios países; componente único reutilizado en HU-06, HU-10, HU-12, HU-15, HU-16 y HU-27.
2. Wireframe ilustrativo

Figura 11 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Selector “Mostrar horarios en”
Dropdown con búsqueda
No
Zona IANA válida; busca por país o ciudad
Por defecto: zona del perfil (HU-14), luego la del navegador; si falla, America/Mexico_City
Horario convertido
Texto dinámico
—
Calculado para la fecha de la actividad (horario de verano incluido)
Portal: “11:00 tu hora · 10:00 hora CDMX”; en zona CDMX, una sola hora
Tabla “Ver en otros países”
Tabla informativa
—
—
Fila CDMX de referencia; Centroamérica, Bogotá/Lima, Santiago, Buenos Aires, Madrid; resalta la zona del usuario
Horario presencial
Texto
—
—
Hora local del lugar (“10:00 hora local · sede del taller”), sin conversión
Botón “Usar siempre esta zona”
Acción
—
Solo con sesión iniciada
Guarda la zona en el perfil, pestaña “Zona horaria” (ver HU-14)
4. Criterios de aceptación
	•	Dado que entro por primera vez, cuando se carga una pantalla con horarios, entonces se detecta mi zona horaria desde el navegador y cada horario muestra mi hora local junto a la hora CDMX.
	•	Dado que estoy en Bogotá y consulto una clase del Diplomado en Ecotecnologías del Agua (sábado 10:00–13:00 hora CDMX), cuando veo su horario, entonces aparece “11:00–14:00 tu hora · 10:00–13:00 hora CDMX”.
	•	Dado que tengo zona guardada en mi perfil (ver HU-14) o elijo otra en el selector, cuando se aplica, entonces todos los horarios visibles se recalculan con esa zona.
	•	Dado que el navegador no permite detectar mi zona, cuando se carga una pantalla con horarios, entonces se usa America/Mexico_City por defecto y veo un aviso para elegir mi zona manualmente.
	•	Dado que la actividad es presencial (taller o programa por convocatoria), cuando veo su horario, entonces se muestra en hora local del lugar, indicada explícitamente, sin tabla de conversión.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Selector siempre visible (“Mostrar horarios en: [Mi zona ▾]”), con búsqueda por país o ciudad.
	•	Portal: hora local primero y CDMX de referencia; catálogo y ficha pública: CDMX primero y debajo la local (ver HU-15, HU-16).
	•	La tabla se abre con “Ver en otros países”; mismo componente en la ficha (ver HU-16) y el panel (ver HU-27, HU-29).
5.2 Estados de la interfaz
Estado
Descripción
Default
Zona del perfil o detectada automáticamente al ingresar.
Loading
Breve recálculo tras cambiar manualmente la zona horaria.
Success
Horarios en la zona activa con la hora CDMX de referencia.
Error
Detección fallida: se usa America/Mexico_City, con aviso y selección manual.

HU-12 — Acceso a sesiones en vivo (Zoom / Google Meet)
Rol / actor: Participante inscrito
1. Historia de usuario
Como participante inscrito, quiero ver mis próximas sesiones en vivo con su enlace de Zoom o Meet, y en las pasadas la grabación y mi asistencia, para conectarme puntualmente y no perder lo visto.
Beneficio / valor: Evita compartir enlaces por otros canales y reduce accesos no autorizados; reúne por sesión la grabación y la asistencia, que hoy llegan por separado.
2. Wireframe ilustrativo

Figura 12 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Próximas sesiones
Lista de tarjetas
—
Solo de formaciones con inscripción activa
Oferta y módulo, fecha/hora local con hora CDMX (ver HU-11) y plataforma Zoom/Meet
Botón “Entrar a sesión”
Acción
—
Habilitado desde 10 minutos antes del inicio
Redirige al join_url, nunca al start_url del anfitrión
Historial de sesiones pasadas
Lista
—
—
De la más reciente a la más antigua; asistencia: Pendiente / Registrada / No registrada
Enlace “Ver grabación”
Enlace externo
—
Solo si el equipo cargó la grabación (ver HU-28)
Si no, etiqueta “Grabación pendiente”; mismo enlace que en Materiales (ver HU-08)
Botón “Registrar asistencia”
Acción
—
Ventana de 24 h tras la sesión (configurable, ver HU-30)
Abre el registro de la sesión (ver HU-18); fuera de la ventana: “Ventana cerrada”
4. Criterios de aceptación
	•	Dado que faltan 10 minutos o menos para una sesión, cuando reviso mis próximas sesiones, entonces “Entrar a sesión” está habilitado y me redirige al enlace; antes aparece deshabilitado indicando cuándo se habilita.
	•	Dado que soy participante, cuando obtengo el enlace de una sesión, entonces el sistema me entrega solo el join_url y nunca el start_url de Zoom, reservado al anfitrión.
	•	Dado que no tengo inscripción activa en la oferta de una sesión, cuando reviso mis próximas sesiones, entonces no veo esa sesión ni su enlace.
	•	Dado que una sesión terminó, cuando reviso el historial, entonces veo “Ver grabación” o “Grabación pendiente” y, dentro de las 24 h, “Registrar asistencia” habilitado (ver HU-18).
	•	Dado que el equipo canceló una sesión o aún no cargó su enlace (ver HU-29), cuando la reviso, entonces veo “Cancelada” o “Enlace aún no disponible”, sin botón de acceso habilitado.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	“Entrar a sesión” muestra “Disponible 10 min antes” o una cuenta regresiva y cambia a color activo al habilitarse.
	•	Cada tarjeta muestra la hora local y la hora CDMX de referencia (ver HU-11).
	•	Historial separado de las próximas sesiones: sin acceso, con “Ver grabación” y “Registrar asistencia” destacado mientras la ventana está abierta.
5.2 Estados de la interfaz
Estado
Descripción
Disabled
Faltan más de 10 minutos, sesión cancelada o enlace aún no disponible.
Enabled
Botón activo; redirige al enlace de acceso.
Pending
Sesión pasada sin grabación o con asistencia por registrar en la ventana.
Error
Fallo al cargar sesiones o con Zoom/Meet; opción de reintentar.

HU-13 — Notificaciones del portal
Rol / actor: Participante
1. Historia de usuario
Como participante, quiero recibir notificaciones en el portal y por correo sobre mis postulaciones, becas, pagos, sesiones, materiales y asistencia, para mantenerme informado sin revisar todo manualmente.
Beneficio / valor: Disminuye la carga de seguimiento manual tanto para el participante como para el equipo administrativo de la Escuela.
2. Wireframe ilustrativo

Figura 13 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Campana y panel
Ícono + lista desplegable
—
—
Contador de no leídas en todo el portal; “Marcar todas como leídas” e historial
Postulaciones y entrevistas
Evento (portal+correo)
—
Cada cambio de estado; “En revisión” solo en portal
Mismos estados (ver HU-21); entrevista Zoom con hora local y CDMX; recordatorio 24 h antes
Beca aprobada
Evento (portal+correo)
—
Al pasar a “Aprobada – pendiente de pago”
Nivel y %, saldo MXN/USD, plazo 7 días; Stripe o transferencia México (ver HU-23)
Pagos y cuotas
Evento (portal+correo)
—
Cuota cobrada o fallida, plan en mora (15 días), transferencia validada/rechazada
Fallido o En mora: prioridad alta, fijada arriba, con “Actualizar tarjeta” (ver HU-24, HU-33)
Formación y sesiones
Evento (portal+correo)
—
Asistencia habilitada (24 h), WhatsApp, material, grabación, cambio o cancelación
Cada una enlaza a su sección: registro (HU-18), Aula (HU-17), Materiales (HU-08), sesiones (HU-12)
4. Criterios de aceptación
	•	Dado que ocurre un evento notificable, cuando el sistema lo procesa, entonces se genera una notificación en el portal y un correo con botón a la sección relacionada (salvo “En revisión”, solo en portal).
	•	Dado que cambia el estado de una de mis postulaciones, cuando se actualiza, entonces la notificación usa el mismo nombre de estado que veo en “Mis postulaciones” (ver HU-21).
	•	Dado que el equipo aprueba mi beca, cuando pasa a “Aprobada – pendiente de pago”, entonces recibo el nivel y % asignado, el saldo en MXN o USD, la fecha límite (7 días) y el acceso para pagar (ver HU-23).
	•	Dado que falla el cobro automático de una cuota, cuando el sistema recibe el rechazo, entonces recibo una notificación de prioridad alta, fijada al inicio del panel hasta regularizar, con acción para actualizar mi tarjeta (ver HU-24).
	•	Dado que termina una sesión de mi formación, cuando se habilita su registro de asistencia, entonces recibo una notificación con enlace directo al registro (ver HU-18) que indica que cierra en 24 h.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Campana en el encabezado de todo el portal; las no leídas se destacan con un indicador de color.
	•	Ícono por grupo (Formación, Postulaciones y becas, Pagos); las de prioridad alta (cobro fallido, mora) quedan fijadas al inicio del panel.
	•	Los correos replican la notificación e incluyen un botón hacia la sección relacionada del portal.
5.2 Estados de la interfaz
Estado
Descripción
Empty
Mensaje “No tienes notificaciones”.
Success
Lista cargada diferenciando leídas de no leídas.
Priority
Cobro fallido o plan en mora fijado al inicio hasta regularizarse.
Error
Error al cargar, con opción de reintentar.

HU-14 — Consulta y edición del perfil de usuario
Rol / actor: Participante
1. Historia de usuario
Como participante, quiero consultar y actualizar mis datos personales, ubicación, teléfono y zona horaria, cambiar mi contraseña y consultar mis pagos, para mantener mi información al día en el portal.
Beneficio / valor: Mantiene al día datos de contacto y preferencias, alimenta el conversor de horarios (ver HU-11) y reúne pagos y comprobantes (ver HU-26).
2. Wireframe ilustrativo

Figura 14 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Nombre completo
Texto
Sí
No vacío; solo letras (tildes, ñ) y espacios
Username y correo se muestran en solo lectura (definidos en HU-02)
Ubicación (país, estado, municipio)
Selectores en cascada
Sí
Misma lógica que HU-02; texto libre si no hay lista
País define moneda de pagos nuevos (MXN México, USD resto) y transferencia (ver HU-23)
Teléfono de contacto
Indicativo + número
Sí
Solo dígitos y longitud válida
Indicativo sugerido según el país (formato de HU-02)
Zona horaria
Selector
Sí
Zona horaria IANA válida
Alimenta HU-11; sin zona guardada ni detectada se usa America/Mexico_City
Cambiar contraseña
Submódulo
—
Actual + nueva + confirmación; reglas de HU-02
Pestaña “Seguridad”: mínimo 8 caracteres, una letra y un número; olvido en HU-05
Pestaña “Mis pagos”
Vista embebida
—
—
Pagos, cuotas y comprobantes (ver HU-26); en origen Moodle indica pago externo (ver HU-25)
4. Criterios de aceptación
	•	Dado que edito mis datos y presiono “Guardar cambios”, cuando la validación es correcta, entonces veo una confirmación y los datos quedan actualizados.
	•	Dado que cambio mi país de México a otro (o viceversa), cuando guardo, entonces los pagos nuevos se ofrecen en la moneda del nuevo país, sin modificar pagos hechos ni planes de cuotas vigentes (ver HU-24, HU-26).
	•	Dado que actualizo mi zona horaria, cuando se guarda, entonces todos los horarios del portal (Dashboard, Calendario, Sesiones) usan la nueva zona.
	•	Dado que cambio mi contraseña en “Seguridad”, cuando la envío, entonces se valida la contraseña actual y que la nueva cumpla las reglas de HU-02 antes de aplicarla.
	•	Dado que dejo vacío un campo requerido u ocurre un error al guardar, cuando intento guardar, entonces veo la validación en línea o el error específico sin perder los datos ingresados.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Cuatro pestañas: “Datos personales”, “Zona horaria”, “Seguridad” y “Mis pagos” (ver HU-26).
	•	Username y correo con fondo gris, no editables, para dejar claro que no se modifican aquí.
	•	Ubicación en cascada igual que el registro (HU-02): País → Estado / Departamento / Provincia → Municipio / Ciudad.
5.2 Estados de la interfaz
Estado
Descripción
Default
Formulario prellenado con los datos actuales.
Loading
“Guardar cambios” deshabilitado mientras se procesa.
Success
Mensaje “Cambios guardados” y datos actualizados.
Error
Error específico (p. ej. contraseña actual incorrecta) sin perder los datos.

HU-15 — Catálogo de oferta formativa
Rol / actor: Visitante público / Participante
1. Historia de usuario
Como visitante o participante, quiero explorar un catálogo público de diplomados, cursos, talleres, eventos y programas por convocatoria, con filtros por tipo, modalidad, estado y beca, para encontrar la formación adecuada.
Beneficio / valor: Vitrina única, sin sesión, de la oferta que hoy se difunde por separado; conduce a la ficha (ver HU-16) para inscribirse, pagar o postular.
2. Wireframe ilustrativo

Figura 15 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Filtros de tipo y modalidad
Chips + selector
No
Tipo: Diplomados, Cursos, Talleres, Eventos, Programas por convocatoria
Modalidad: En línea en vivo o Presencial; filtros reflejados en la URL (ej. desde HU-07)
Filtro “Estado”
Selector
No
Por defecto: Inscripciones abiertas y Próximamente
También Inscripciones cerradas y Finalizado; se deriva de publicación y fechas (ver HU-27)
Beca disponible (filtro y badge)
Interruptor + etiqueta
No
Solo diplomados NAS con beca habilitada
Badge con rango “10%–80%”; nunca en cursos, talleres, eventos ni convocatorias
Buscador
Texto
No
Mínimo 3 caracteres
Por nombre de la oferta o de la persona docente
Tarjeta de oferta
Imagen + texto
—
Solo ofertas publicadas, nunca borradores
Portada, badges tipo/estado, nombre, fechas, horario y costo; abre la ficha (ver HU-16)
Horario y costo
Texto dinámico
—
En línea: hora CDMX + local (HU-11); presencial: hora y lugar
MXN en México, USD el resto ($10,200 MXN / $585 USD); Moodle: “Inscripción externa”
4. Criterios de aceptación
	•	Dado que soy visitante sin sesión, cuando abro el catálogo, entonces veo las ofertas publicadas con “Inscripciones abiertas” o “Próximamente”, ordenadas por fecha de inicio más cercana, sin que se me pida iniciar sesión.
	•	Dado que aplico uno o varios filtros, cuando se actualiza la lista, entonces veo solo las ofertas que los cumplen todos, sin recargar, y los filtros quedan en la URL para compartir o preaplicar (ver HU-07, HU-34).
	•	Dado que activo “Con beca disponible”, cuando se aplica, entonces solo veo diplomados con beca habilitada; ningún curso, taller, evento o programa por convocatoria muestra el badge de beca.
	•	Dado que mi país de perfil es México (o, sin sesión, mi zona detectada es de México), cuando veo un costo, entonces aparece en MXN ($10,200 MXN); desde otro país, en USD ($585 USD).
	•	Dado que tengo sesión y una inscripción activa en una oferta, cuando la veo listada, entonces su tarjeta muestra “Inscrito” y me lleva a mi Aula (HU-17) en lugar de la ficha.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Página pública /escuela/oferta: chips de tipo arriba, demás filtros debajo y grilla de 1 a 4 columnas; en mobile, botón “Filtros (n)”.
	•	Reutiliza el “Course card” de HU-07 en variante pública; en línea, horario en dos líneas: hora CDMX y hora local.
	•	“Próximamente” indica la fecha de apertura; “Inscripciones cerradas” y “Finalizado” se muestran atenuadas y al final de la lista.
5.2 Estados de la interfaz
Estado
Descripción
Loading
Carga del catálogo o aplicación de filtros.
Empty
“No encontramos ofertas con estos filtros” + [Limpiar filtros]; sin oferta, Contacto (ver HU-38).
Success
Tarjetas filtradas con horario CDMX/local y costo en la moneda correspondiente.
Error
“No se pudo cargar la oferta formativa” con opción de reintentar.

HU-16 — Ficha de detalle de una oferta formativa
Rol / actor: Visitante público / Participante
1. Historia de usuario
Como visitante o participante, quiero consultar la ficha completa de una oferta (docentes, temario, fechas, horario, costo, beca) y su acción, para decidir informado y dar el siguiente paso sin escribir al equipo.
Beneficio / valor: Reúne lo que el equipo carga (HU-27) y lo conecta con inscripción y pago (HU-22, HU-24), beca (HU-19) y convocatoria (HU-20); reduce consultas por WhatsApp.
2. Wireframe ilustrativo

Figura 16 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Encabezado, portada y docentes
Imágenes + tarjeta
—
Portada y al menos una persona docente para publicar
Nombre, tipo, estado, modalidad, badge de beca; docente con foto, semblanza y “Ver CV”
“¿Qué aprenderás?” y temario
Viñetas + acordeón
—
—
Módulos con título y descripción; carga horaria (ej. 9 módulos, 60 h + proyecto final)
Fechas y horario
Texto + tabla
—
Hora oficial siempre en hora CDMX
Inicio, fin, inscripciones y proyecto final; tabla de conversión con la zona del visitante (HU-11)
Costo y bloque de beca
Texto + bloque
—
MXN (México) o USD; beca solo en diplomados NAS
Cuotas: “hasta N cuotas sin recargo” (2–4); beca 10%–80%, >70% con entrevista Zoom (HU-19)
Modalidad, lugar y requisitos
Texto
Sí
Lugar obligatorio en talleres y programas por convocatoria
Convocatorias: cupo y elegibilidad (ej. Siembra de Agua: mujeres lideresas de Centroamérica y México)
Bloque de acciones (CTA)
Botones
—
Según tipo, estado, origen y situación de la persona
[Inscribirme y pagar] (HU-22), [Pagar en cuotas] (HU-24), [Postular a beca] (HU-19), [Postular] (HU-20)
4. Criterios de aceptación
	•	Dado que tengo sesión y la oferta es de origen NAS con inscripciones abiertas, cuando presiono [Inscribirme y pagar] o [Pagar en cuotas], entonces inicia el flujo de HU-22 o HU-24 en la moneda de mi país (MXN o USD).
	•	Dado que la oferta es un diplomado con beca habilitada, cuando reviso la ficha, entonces veo el bloque de beca con sus niveles y [Postular a beca]; en cursos, talleres, eventos y convocatorias ese bloque nunca aparece.
	•	Dado que la oferta es por convocatoria (Aprendices del Agua, Siembra de Agua) o de origen Moodle, cuando reviso sus acciones, entonces solo veo [Postular] (HU-20) o [Ya estoy inscrito: activar mi acceso] (HU-25), sin costo ni compra.
	•	Dado que no tengo sesión, cuando pulso cualquier acción, entonces voy al login (HU-04) o registro (HU-02) y, al autenticarme, regreso a la ficha con esa acción lista para continuar.
	•	Dado que ya estoy inscrito, cuando abro la ficha, entonces veo “Ya estás inscrito” y [Ir a mi aula] (HU-17); con una postulación a beca en curso veo su estado o [Pagar saldo] (HU-23).
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Ruta pública /escuela/oferta/[slug]; la portada es la vista previa al compartir en redes o WhatsApp.
	•	Desktop en dos columnas con panel fijo de resumen y acciones a la derecha; en mobile, CTA en barra inferior fija.
	•	Jerarquía: [Inscribirme y pagar] primario, [Pagar en cuotas] secundario (si hay cuotas), [Postular a beca] en su bloque; convocatorias solo [Postular].
5.2 Estados de la interfaz
Estado
Descripción
Default
Inscripciones abiertas: ficha completa con las acciones que corresponden.
Disabled
Próximamente: “Inscripciones abren el [fecha]”; cerradas o finalizada: sin acciones, con mensaje.
Enrolled
“Ya estás inscrito” y [Ir a mi aula] (ver HU-17) en lugar de las acciones.
Error
Oferta inexistente o despublicada: “Esta oferta ya no está disponible” y enlace al catálogo.

HU-17 — Aula: detalle de mi formación
Rol / actor: Participante inscrito
1. Historia de usuario
Como participante inscrito, quiero un aula con toda la información de mi formación (docente, progreso, grupo de WhatsApp, próxima sesión, módulos, grabaciones, asistencia y proyecto final), para seguir mi proceso desde un solo lugar.
Beneficio / valor: Destino de “Continuar” (ver HU-07): concentra lo que hoy llega por canales sueltos (WhatsApp, enlaces, recursos, grabaciones) y reduce consultas al equipo.
2. Wireframe ilustrativo

Figura 17 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Encabezado y progreso
Texto + barra
—
Progreso = sesiones con asistencia ÷ sesiones programadas (sin canceladas)
Portada, nombre, docente(s), “Ver ficha” (HU-16); distinto del “% de asistencia” de HU-30
“Antes de empezar” y WhatsApp
Tarjeta + enlace externo
—
Solo inscritos, desde la fecha del equipo (ver HU-27); https://chat.whatsapp.com/…
Bienvenida, primera sesión y [Unirme al grupo de WhatsApp]; nunca en ficha pública
Próxima sesión
Tarjeta
—
Solo si hay una sesión futura; hora local (ver HU-11)
[Entrar a sesión] 10 min antes (ver HU-12); presencial: lugar y “Cómo llegar”
Módulos
Acordeón
—
Orden del temario
Estado Próximo / En curso / Completado y [Ver recursos] (ver HU-08)
Sesiones pasadas
Tabla
—
Asistencia abierta 24 h tras la sesión (ver HU-18)
Fecha, módulo, [Ver grabación] o “Grabación pendiente” y estado: Pendiente / Registrada / No registrada
Proyecto final
Bloque + archivo
—
Solo diplomados; PDF, DOCX, PPTX o ZIP, máx. 20 MB
Fecha de presentación y lineamientos; entrega reemplazable hasta la fecha límite
4. Criterios de aceptación
	•	Dado que tengo inscripción activa y presiono “Continuar” en Mi Formación (HU-07), cuando carga el aula, entonces veo la formación, su docente, mi progreso, la próxima sesión y los módulos.
	•	Dado que el equipo publicó el enlace de WhatsApp y las clases no han iniciado, cuando entro al aula, entonces veo destacado “Antes de empezar” con la primera sesión y [Unirme al grupo de WhatsApp], que abre en nueva pestaña.
	•	Dado que no tengo inscripción activa en la oferta, cuando abro la ruta del aula, entonces se me niega el acceso sin exponer enlaces de WhatsApp, sesión ni grabaciones, y se me ofrece la ficha (HU-16).
	•	Dado que mi formación es un diplomado, cuando reviso el aula, entonces veo “Proyecto final” con su fecha de presentación; en cursos y talleres esa sección no aparece.
	•	Dado que falla la carga de un bloque del aula, cuando la pantalla se renderiza, entonces solo ese bloque muestra “No se pudo cargar esta información” con opción de reintentar.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Desktop: izquierda módulos y sesiones pasadas; derecha WhatsApp, próxima sesión y proyecto final. En mobile, WhatsApp y próxima sesión primero.
	•	“Antes de empezar” destacado hasta la primera sesión; luego bloque secundario “Grupo de WhatsApp” para quien se incorpore tarde.
	•	Con cobro fallido o “En mora” (ver HU-24), aviso hacia “Mis pagos” (ver HU-26) sin bloquear; solo el equipo suspende (ver HU-33).
5.2 Estados de la interfaz
Estado
Descripción
Pre-start
Antes de la primera sesión: “Antes de empezar” destacado con WhatsApp o aviso.
Success
Aula en curso con próxima sesión, módulos, sesiones pasadas y Progreso real.
Unauthorized
Sin inscripción activa: acceso denegado con enlace a la ficha (HU-16).
Error
Bloque con “No se pudo cargar esta información” y opción de reintentar.

HU-18 — Registro de asistencia a una sesión
Rol / actor: Participante inscrito
1. Historia de usuario
Como participante inscrito, quiero registrar mi asistencia al terminar cada sesión, con un comentario breve opcional, para que cuente en mi progreso y el equipo controle la asistencia sin formularios externos.
Beneficio / valor: Sustituye el link de asistencia hecho a mano: la plataforma genera el registro de cada sesión y alimenta el Progreso (HU-17) y el control (HU-30).
2. Wireframe ilustrativo

Figura 18 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Datos de la sesión
Solo lectura
—
—
Oferta, módulo, docente, fecha y hora en hora CDMX y local (HU-11)
Confirmación “Asistí a la sesión”
Checkbox
Sí
Debe marcarse para habilitar el envío
Declaración del propio participante
Comentario / aprendizaje breve
Área de texto
No
Máximo 500 caracteres, con contador
Pregunta guía: “¿Qué te llevas de esta sesión?”; lo consulta el equipo (HU-30)
Ventana de registro
Cuenta regresiva
—
Abre al terminar la sesión; 24 h (configurable en HU-30)
Ej.: “Puedes registrar hasta el lun 16 nov, 13:00 hora CDMX (14:00 tu hora)”
Botón “Registrar asistencia”
Acción
—
Con confirmación, dentro de la ventana y sin registro previo
Desde historial (HU-12), Aula (HU-17) o notificación (HU-13); bloquea el doble envío
Estado de asistencia
Badge
—
Pendiente / Registrada / No registrada
Registro no editable ni duplicable; se refleja en HU-12 y HU-17
4. Criterios de aceptación
	•	Dado que una sesión terminó, su ventana de 24 h sigue abierta y estoy inscrito, cuando marco “Asistí a la sesión” y presiono [Registrar asistencia], entonces veo “Asistencia registrada” y mi Progreso se recalcula en el aula.
	•	Dado que ya registré mi asistencia, cuando vuelvo a abrir el registro, entonces veo “Asistencia registrada el [fecha y hora]” sin formulario y no se crea un segundo registro.
	•	Dado que la ventana venció sin registro, cuando intento registrar, entonces veo “El registro de asistencia para esta sesión está cerrado”, el estado queda “No registrada” y puedo pedir corrección al equipo (HU-30).
	•	Dado que la sesión es de un taller presencial, cuando termina, entonces registro con el mismo formulario y, si el equipo ya la marcó en sitio (HU-30), veo “Asistencia registrada”.
	•	Dado que no estoy inscrito en la oferta de la sesión, cuando abro el enlace del registro, entonces se me niega el acceso y no se registra asistencia; sin sesión iniciada, primero voy al login (HU-04).
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Modal en desktop y pantalla completa en mobile; también ruta propia (/portal/asistencia/[sesión]) para abrirlo desde el correo o la notificación.
	•	Indicador visible del tiempo restante (“Cierra en 21 h 35 min”) para motivar el registro oportuno.
	•	Al registrar, el estado se actualiza en el aula (HU-17) y en el historial (HU-12) sin recargar la página.
5.2 Estados de la interfaz
Estado
Descripción
Disabled
Sesión no terminada o confirmación sin marcar: botón inactivo con el motivo.
Success
“Asistencia registrada el [fecha y hora]”; estado “Registrada”.
Closed
Ventana vencida sin registro: estado “No registrada”.
Error
Error al guardar con opción de reintentar, conservando el comentario.

Fase 2 — Postulaciones, becas y pagos
Postulación a becas y convocatorias, pagos con Stripe o transferencia, acceso desde Moodle e historial de pagos.
HU-19 — Postulación a beca de diplomado
Rol / actor: Participante (postulante a beca)
1. Historia de usuario
Como participante que no puede pagar completo un diplomado, quiero postularme a una beca con nivel, carta de intención y evidencia territorial, para que el equipo evalúe mi caso como “beca por confianza”.
Beneficio / valor: Reemplaza Google Forms y la hoja de cálculo: cada postulación queda con estado, nivel y archivos para revisión (HU-31) y seguimiento (HU-21).
2. Wireframe ilustrativo

Figura 19 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Diplomado y cohorte
Solo lectura
—
Diplomado NAS con beca y convocatoria de becas abierta (HU-27)
Precargado desde la ficha (HU-16) o “Becas disponibles”, con costo $10,200 MXN / $585 USD
Contacto, ubicación, edad y código
Texto precargado
Sí
Correo no editable; WhatsApp con indicativo; edad entera
Desde el perfil (HU-14); país define moneda y transferencia (HU-23); código de iniciativa aliada opcional
Nivel de beca solicitado
Tarjetas (opción única)
Sí
Solo niveles habilitados (HU-27); Beca especial muestra aviso de entrevista Zoom
Agua Viva 10%, Ríos Vivos 25%, Aguas Libres 50%, Cenotes Vivos 70%, Beca especial ≤80%
Carta de intención
Texto largo
Sí
800 a 4000 caracteres, con contador
Por qué la necesitas y cómo replicarás lo aprendido en tu territorio; propia, sin IA
Evidencia territorial
Archivos y enlaces
Sí
Mín. 1; JPG/PNG/HEIC ≤10 MB, MP4/MOV ≤100 MB; máx. 10 archivos
Fotos/videos de experiencia territorial; también hasta 5 enlaces (YouTube, Drive, redes)
Términos y envío
Checkbox + botones
Sí
Términos marcados y obligatorios válidos para “Enviar”
Veracidad, asistencia, proyecto final, datos y pago del saldo; una postulación por cohorte; borrador editable
4. Criterios de aceptación
	•	Dado que envío la postulación con todos los datos válidos, cuando se registra, entonces veo la confirmación con folio, queda “Enviada”, recibo correo y notificación (HU-13) y aparece en la revisión del equipo (HU-31).
	•	Dado que elijo un nivel de beca, cuando se aplica, entonces el resumen muestra el monto estimado en mi moneda (“el nivel final lo asigna el equipo”) y, si elijo Beca especial (>70%), el aviso de entrevista por Zoom.
	•	Dado que la oferta es curso, taller o evento, el diplomado no tiene beca o la convocatoria de becas está cerrada, cuando consulto su ficha o Becas, entonces no puedo postular y veo el motivo.
	•	Dado que ya envié una postulación para el mismo diplomado y cohorte, cuando intento postular de nuevo, entonces no se crea otra y voy a la existente en “Mis postulaciones” (HU-21).
	•	Dado que la carta no tiene entre 800 y 4000 caracteres, no adjunto evidencia o no acepto los términos, cuando reviso el formulario, entonces veo validaciones en línea y “Enviar postulación” sigue deshabilitado.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Una página mobile-first en 5 secciones (Contacto, Nivel, Carta, Evidencia, Términos); en desktop, resumen lateral fijo con diplomado, costo y cierre.
	•	Niveles como tarjetas con %, a quién se dirigen y monto estimado (ej. Aguas Libres 50% de $585 USD ≈ $292.50 USD).
	•	Autoguardado del borrador (“Borrador guardado · hh:mm”); Becas tiene pestañas “Becas disponibles” y “Mis postulaciones” (ver HU-21).
5.2 Estados de la interfaz
Estado
Descripción
Loading
Subida de archivos con progreso; botón “Enviando…”.
Disabled
Envío bloqueado por obligatorios pendientes; solo lectura si la convocatoria cerró.
Error
Archivo inválido o pesado, o fallo de red, sin perder lo capturado.
Success
Confirmación con folio, estado “Enviada” y acceso a “Mis postulaciones”.

HU-20 — Postulación a convocatoria de programa presencial
Rol / actor: Participante (postulante a una convocatoria)
1. Historia de usuario
Como participante interesado en programas presenciales, quiero ver las convocatorias abiertas y postularme en el portal, para participar en Aprendices del Agua o Siembra de Agua sin formularios externos.
Beneficio / valor: Centraliza las convocatorias que hoy llegan por Google Forms: la persona conoce desde el inicio requisitos, elegibilidad y entrevista por Zoom.
2. Wireframe ilustrativo

Figura 20 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Tarjeta de convocatoria
Tarjeta
—
Publicadas con cierre futuro (ver HU-27)
Programa, lugar, fechas, costo o “Gratuito”, cierre y elegibilidad
Confirmación de elegibilidad
Checkbox
Sí
País dentro de los elegibles
Siembra de Agua: mujeres lideresas de Centroamérica y México
Datos personales y organización
Texto precargado
Sí
Correo no editable; WhatsApp con indicativo
Nombre, correo, WhatsApp, país y territorio (ver HU-14); organización y rol
Experiencia y motivación
Textos largos
Sí
300 a 2000 caracteres cada uno
Proyectos en cuidado del agua; cómo replicará lo aprendido
Disponibilidad para viajar
Opción Sí/No
Sí
Debe ser “Sí” para enviar
Asistencia presencial completa (ej. 5 días en Aprendices del Agua)
Evidencia y términos
Archivos + checkbox
Sí
Evidencia opcional (límites de HU-19); términos obligatorios
Incluye aceptación de la entrevista por Zoom
4. Criterios de aceptación
	•	Dado que hay convocatorias abiertas, cuando entro a Convocatorias, entonces veo tarjetas con lugar, fechas, cierre en mi zona horaria y elegibilidad, ordenadas por cierre más próximo.
	•	Dado que envío la postulación con datos válidos, cuando se registra, entonces veo confirmación con folio y aviso de entrevista por Zoom, recibo correo y notificación (ver HU-13) y queda “Enviada” (ver HU-31).
	•	Dado que mi país no es elegible o respondo “No” a viajar, cuando lo selecciono, entonces veo el motivo (p. ej. “dirigida a mujeres lideresas de Centroamérica y México”) y no puedo enviar.
	•	Dado que ya postulé a esa convocatoria o su cierre pasó, cuando intento postular, entonces voy a mi postulación existente o veo la convocatoria “Cerrada”, sin botón para postular.
	•	Dado que dejo obligatorios vacíos o fuera del rango de caracteres, cuando reviso el formulario, entonces veo validaciones en línea sin perder lo escrito y no puedo enviar.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Pestañas “Convocatorias abiertas” y “Mis postulaciones” (ver HU-21); también se inicia desde [Postular] en la ficha pública (ver HU-16).
	•	Tarjetas con etiqueta “Presencial”, elegibilidad y cuenta regresiva de cierre (“Cierra en 5 días”).
	•	Detalle con el proceso: Formulario → Revisión en equipo → Entrevista por Zoom → Resultado; elegibilidad destacada al inicio del formulario.
5.2 Estados de la interfaz
Estado
Descripción
Empty
Sin convocatorias abiertas: mensaje orientador y aviso de notificación futura.
Disabled
Cerrada, no elegible o sin disponibilidad para viajar: envío bloqueado con motivo.
Success
Confirmación con folio y aviso de entrevista; postulación “Enviada”.
Error
Validaciones o fallo del servidor, sin perder lo capturado.

HU-21 — Seguimiento de mis postulaciones
Rol / actor: Participante con postulaciones a becas o convocatorias
1. Historia de usuario
Como participante que se postuló a una beca o convocatoria, quiero ver el estado, mi entrevista y el resultado, para saber qué hacer sin preguntar por WhatsApp.
Beneficio / valor: Hoy el seguimiento es por WhatsApp y solo ~50% termina inscrito; estados visibles con una acción por etapa reducen el seguimiento manual.
2. Wireframe ilustrativo

Figura 21 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Tarjeta de postulación
Tarjeta
—
Solo propias; pestaña “Mis postulaciones” en Becas y Convocatorias
Oferta, cohorte, folio, fecha de envío, estado y línea de tiempo
Estado
Badge
—
Estados globales de postulación (ver HU-31)
Borrador, Enviada, En revisión, Entrevista agendada, Aprobada – pendiente de pago, Inscrita, No seleccionada, Vencida
Detalle de la entrevista
Bloque
—
Solo en “Entrevista agendada”
Hora local con referencia CDMX (ver HU-11) y enlace de Zoom
Resultado de la beca
Bloque informativo
—
Solo becas aprobadas
Nivel solicitado y asignado, saldo en MXN o USD y fecha límite (7 días)
Acción contextual
Botón
—
Según el estado
“Continuar”, “Pagar saldo” (ver HU-23), “Confirmar mi participación”, “Ir a mi aula”
Ver mi postulación
Solo lectura
—
—
Respuestas, archivos e historial de estados con fecha y hora
4. Criterios de aceptación
	•	Dado que abro “Mis postulaciones” en Becas o Convocatorias, cuando carga, entonces veo solo mis postulaciones de ese tipo con estado y línea de tiempo; cada cambio me llega como notificación (ver HU-13).
	•	Dado que mi postulación está en “Entrevista agendada”, cuando la consulto, entonces veo fecha y hora en mi zona con referencia CDMX y el enlace de Zoom, habilitado 10 minutos antes.
	•	Dado que mi postulación fue aprobada, cuando la consulto, entonces veo nivel asignado, saldo en mi moneda y “Pagar saldo” (ver HU-23), o “Confirmar mi participación” si no tiene costo; al completar pasa a “Inscrita”.
	•	Dado que pasan 7 días desde la aprobación sin pago ni comprobante, cuando vence el plazo, entonces pasa a “Vencida” y desaparece “Pagar saldo”; con comprobante “Pendiente de validación” no vence.
	•	Dado que intento abrir la postulación de otra persona por URL, cuando se solicita la ruta, entonces el sistema me niega el acceso.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Línea de tiempo: Enviada → En revisión → Entrevista (si aplica) → Resultado → Pago o confirmación → Inscrita; vertical en mobile.
	•	Las postulaciones que requieren acción (entrevista, pago o confirmación) se destacan arriba con cuenta regresiva.
	•	En convocatorias sin costo no se muestran los bloques de beca ni de pago.
5.2 Estados de la interfaz
Estado
Descripción
Empty
Sin postulaciones: acceso a becas disponibles o convocatorias abiertas.
Pending
Acción requerida (entrevista, pago o confirmación) destacada con cuenta regresiva.
Success
Postulaciones listadas con estado, línea de tiempo y acción contextual.
Error
No se pudo cargar la información; opción de reintentar.

HU-22 — Inscripción y pago completo con Stripe
Rol / actor: Participante o visitante que se inscribe
1. Historia de usuario
Como participante interesado en una oferta, quiero inscribirme desde su ficha y pagar el costo completo con tarjeta, para quedar inscrito de inmediato sin esperar un link de pago.
Beneficio / valor: Automatiza el envío manual de links de Stripe: la inscripción se activa sola al confirmarse el pago. Solo ofertas de origen NAS.
2. Wireframe ilustrativo

Figura 22 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Botón “Inscribirme y pagar”
Acción
—
Solo origen NAS, inscripciones abiertas y con cupo
En la ficha (ver HU-16); “Pagar en cuotas” si aplica (ver HU-24)
Resumen de la inscripción
Solo lectura
—
—
Oferta, cohorte, fechas y horario en hora CDMX y local (ver HU-11)
Precio y moneda
Solo lectura
—
MXN si el país del perfil es México; USD en otro caso
Precio fijo por moneda (ver HU-27); ej. $10,200 MXN o $585 USD
Aceptación de términos
Checkbox
Sí
Debe estar marcado para pagar
Términos de inscripción y política de cancelación y reembolso
Botón “Pagar con tarjeta”
Acción
—
Habilitado con términos aceptados
Redirige a Stripe Checkout; el portal no guarda datos de tarjeta
Confirmación y comprobante
Página + correo
—
Solo cuando Stripe confirma el pago
Folio, monto, “Ir a mi aula” (ver HU-17) y comprobante (ver HU-26)
4. Criterios de aceptación
	•	Dado que una oferta NAS tiene inscripciones abiertas y cupo, cuando entro a su ficha (ver HU-16), entonces veo su precio en mi moneda ($10,200 MXN si mi país es México; $585 USD en otro caso).
	•	Dado que no he iniciado sesión, cuando hago clic en “Inscribirme y pagar”, entonces paso por inicio de sesión (ver HU-04) o registro (ver HU-02) y regreso al resumen de esa oferta.
	•	Dado que acepto los términos y pago en Stripe Checkout, cuando Stripe confirma el cobro, entonces se activa mi inscripción, recibo el comprobante por correo (ver HU-13) y la formación aparece en Mi Formación (ver HU-07).
	•	Dado que cancelo el pago o vuelvo sin confirmación de Stripe, cuando carga el portal, entonces veo “Pago cancelado: no se realizó ningún cargo” o “Procesando pago…”; solo la confirmación activa la inscripción.
	•	Dado que ya estoy inscrito en esa cohorte o el cupo se agotó, cuando intento pagar, entonces veo “Ya estás inscrito · Ir a mi aula” o “Cupo agotado” y no se cobra nada.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Tres pasos (Resumen → Pago con Stripe → Confirmación), centrado y sin menú lateral; en mobile el resumen se colapsa.
	•	Monto con moneda explícita (MXN o USD) y nota: “El pago se procesa en Stripe; la Escuela no guarda tu tarjeta”.
	•	Confirmación con folio, monto, “Ir a mi aula”, “Ver comprobante” y aviso: el grupo de WhatsApp está en el Aula.
5.2 Estados de la interfaz
Estado
Descripción
Loading
“Redirigiendo a Stripe…” al pagar y “Procesando pago…” al volver.
Success
Pago confirmado: inscripción activa y comprobante enviado por correo.
Error
Pago rechazado, cancelado o error de Stripe: mensaje y opción de reintentar.
Disabled
Cupo agotado, inscripciones cerradas, origen Moodle o ya inscrito: sin pago.

HU-23 — Pago del saldo tras beca (Stripe o transferencia México)
Rol / actor: Participante con beca parcial aprobada
1. Historia de usuario
Como participante con beca parcial aprobada, quiero ver cuánto me toca pagar y pagarlo con tarjeta o, si vivo en México, por transferencia, para confirmar mi lugar en el diplomado.
Beneficio / valor: Elimina el envío manual de links y datos bancarios: el saldo se calcula según el % asignado y las transferencias llegan con comprobante (ver HU-33).
2. Wireframe ilustrativo

Figura 23 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Desglose del saldo
Solo lectura
—
Saldo = monto original − % de beca asignado
Ej.: $10,200 MXN con Aguas Libres 50% → $5,100 MXN ($292.50 USD)
Fecha límite de pago
Cuenta regresiva
—
7 días naturales desde la aprobación
Vence sin pago ni comprobante → postulación “Vencida” (ver HU-21)
Método de pago
Opción única
Sí
Transferencia solo si el país del perfil es México
Tarjeta con Stripe: pago único o de 2 a 4 cuotas (ver HU-24)
Datos bancarios y referencia
Texto copiable
—
Solo con transferencia; referencia única por postulación
[Titular], [Banco], [CLABE] configurados en el panel; monto en MXN
Comprobante de transferencia
Archivo + datos
Sí
PDF/JPG/PNG ≤ 5 MB; monto, fecha y clave de rastreo
Reemplazable mientras esté “Pendiente de validación” (ver HU-33)
Estado del pago
Badge
—
—
Tarjeta: Pagado. Transferencia: Pendiente de validación → Validada o Rechazada
4. Criterios de aceptación
	•	Dado que mi beca fue aprobada, cuando hago clic en “Pagar saldo” (ver HU-21), entonces veo el monto original, el nivel y % asignado, el saldo en mi moneda y la fecha límite de 7 días.
	•	Dado que pago el saldo con tarjeta (único o en cuotas, ver HU-24), cuando Stripe confirma el cobro, entonces mi postulación pasa a “Inscrita” y accedo al Aula (ver HU-17).
	•	Dado que el país de mi perfil es México, cuando veo los métodos de pago, entonces aparece “Transferencia bancaria” con datos bancarios, monto en MXN y referencia única; en otros países no se muestra.
	•	Dado que subo el comprobante antes de la fecha límite, cuando lo envío, entonces queda “Pendiente de validación”, la postulación no vence y la inscripción se activa al validarlo el equipo (ver HU-33).
	•	Dado que el equipo rechaza mi transferencia, cuando se registra el rechazo, entonces veo “Rechazada” con el motivo y puedo subir un comprobante nuevo.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Indicadores arriba: monto original, beca asignada (nivel y %), saldo a pagar destacado y cuenta regresiva de la fecha límite.
	•	Métodos como tarjetas seleccionables; transferencia con etiqueta “Solo México”; el pago con tarjeta reutiliza el flujo de Stripe (ver HU-22).
	•	Transferencia: datos bancarios con “Copiar”, pasos (transfiere, sube comprobante, el equipo valida en 1–2 días hábiles) y formulario del comprobante.
5.2 Estados de la interfaz
Estado
Descripción
Pending
Transferencia “Pendiente de validación” hasta que el equipo concilie (ver HU-33).
Success
Saldo pagado o transferencia validada: postulación “Inscrita”.
Error
Tarjeta rechazada, comprobante inválido o transferencia “Rechazada”: motivo y reintento.
Disabled
Postulación “Vencida” o saldo ya pagado: pago deshabilitado.

HU-24 — Plan de pago en cuotas con cobro automático
Rol / actor: Participante que paga en cuotas
1. Historia de usuario
Como participante que no puede pagar el total de una vez, quiero un plan de cuotas cobrado automáticamente a mi tarjeta, para pagar de forma escalonada sin acordarme cada mes.
Beneficio / valor: Responde al cliente: cuotas “que se debiten directamente de la tarjeta”, para pago completo (ver HU-22) o saldo tras beca (ver HU-23).
2. Wireframe ilustrativo

Figura 24 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Número de cuotas
Selector (chips)
Sí
2 a 4 mensuales, hasta el máximo de la oferta (ver HU-27)
Monto por cuota en la moneda de la persona; sin recargo
Calendario de cobros
Solo lectura
—
Última cuota antes del fin de la oferta
Fecha, monto y estado; la 1.ª se cobra al confirmar y activa la inscripción
Autorización de débito automático
Checkbox
Sí
Obligatoria para continuar
“Autorizo a la Escuela a cobrar automáticamente en mi tarjeta las cuotas”
Tarjeta
Formulario de Stripe
Sí
Validada por Stripe, incluido 3-D Secure
Solo marca y últimos 4 dígitos; “Actualizar tarjeta” abre el portal de Stripe
Estado del plan
Badge
—
Al día, Cobro fallido, En mora, Completado, Cancelado
Mismos estados del panel (ver HU-33) y de “Mis pagos” (ver HU-26)
Aviso de cobro fallido
Banner
—
Desde el primer fallo hasta regularizar
Monto pendiente, 3 reintentos en 7 días; “En mora” a los 15 días
4. Criterios de aceptación
	•	Dado que la oferta tiene cuotas habilitadas, cuando elijo “Pagar en cuotas” (ver HU-22 o HU-23), entonces elijo de 2 a 4 cuotas según el máximo de la oferta y veo el calendario de cobros.
	•	Dado que autorizo el débito automático y registro mi tarjeta, cuando confirmo, entonces se cobra la 1.ª cuota, se activa mi inscripción (o la postulación pasa a “Inscrita”) y el plan queda “Al día”.
	•	Dado que faltan 7 días para una cuota, cuando se cumple el aviso, entonces lo veo en el Dashboard (ver HU-06) y recibo un recordatorio con monto, fecha y tarjeta (ver HU-13).
	•	Dado que falla el cobro de una cuota, cuando Stripe lo informa, entonces el plan pasa a “Cobro fallido”, recibo aviso con “Actualizar tarjeta” y Stripe reintenta hasta 3 veces en 7 días.
	•	Dado que un cobro fallido sigue sin regularizarse a los 15 días, cuando vence el plazo, entonces el plan pasa a “En mora” y el equipo puede suspender mi acceso manualmente (ver HU-33).
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Chips de número de cuotas con monto por cuota calculado en vivo (ej. $292.50 USD en 3 cuotas = $97.50 USD).
	•	Calendario con la 1.ª cuota marcada “Se cobra al confirmar” y el total del plan.
	•	Banner de cobro fallido en Dashboard, Aula y Mis pagos con “Actualizar tarjeta”; si se suspende por mora, el Aula lo explica.
5.2 Estados de la interfaz
Estado
Descripción
Success
Plan “Al día”, primera cuota pagada e inscripción activa.
Pending
Cobro fallido con reintento programado; banner de aviso visible.
Error
Tarjeta rechazada al activar el plan: opción de usar otra tarjeta.
Disabled
Autorización sin marcar, cuotas no habilitadas o acceso suspendido por mora.

HU-25 — Acceso de participantes inscritos por Moodle
Rol / actor: Participante inscrito vía Moodle
1. Historia de usuario
Como participante que ya pagó una formación en Moodle, quiero registrarme con mi correo y encontrarla vinculada automáticamente, para consultar materiales y sesiones sin pasar por un pago.
Beneficio / valor: Respeta el proceso actual: las ofertas Moodle ya están pagadas. Evita cobros duplicados y altas manuales: el equipo carga la lista de inscritos.
2. Wireframe ilustrativo

Figura 25 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Lista de inscritos Moodle
CSV o captura
—
Correos válidos por oferta y cohorte, sin duplicados
La carga el equipo en el paso “Origen y precio” (ver HU-27)
Correo de registro
Email
Sí
Sin distinguir mayúsculas ni espacios
Registro sin cambios (ver HU-02); se vincula al verificar el correo (ver HU-03)
Código de acceso
Texto
No
XXXX-XXXX; un solo uso; vigente hasta fin de cohorte
Para quien usó otro correo en Moodle; lo genera el equipo (ver HU-27)
Etiqueta “Vía Moodle”
Badge
—
Solo inscripciones de origen Moodle
En Mi Formación (ver HU-07) y el Aula (ver HU-17)
Elementos ocultos
Regla de visualización
—
Siempre en ofertas Moodle
Inscripción, pago, cuotas y beca; sin cobros en “Mis pagos” (ver HU-26)
Mensaje “Inscripción no encontrada”
Mensaje informativo
—
Correo sin coincidencia en listas Moodle
Ofrece código de acceso o contacto con la Escuela (correo y WhatsApp)
4. Criterios de aceptación
	•	Dado que mi correo está en la lista de una oferta Moodle, cuando verifico mi correo (ver HU-03) o el equipo carga la lista, entonces la formación aparece en Mi Formación sin pago y se me notifica (ver HU-13).
	•	Dado que la oferta es de origen Moodle, cuando veo su ficha (ver HU-16) o su Aula, entonces no hay botones de inscripción, pago ni beca; la ficha muestra “Ya estoy inscrito: activar mi acceso”.
	•	Dado que mi correo no está en ninguna lista, cuando busco mi formación, entonces veo “No encontramos una inscripción asociada a tu correo” con las opciones de código de acceso o contacto.
	•	Dado que ingreso un código de acceso, cuando lo confirmo, entonces, si es válido, la formación se vincula y el código queda usado; si es inválido, usado o vencido, veo un error específico.
	•	Dado que no estoy en la lista de una oferta Moodle, cuando intento abrir su Aula por URL, entonces el sistema me niega el acceso.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Banner de éxito descartable la primera vez que se vincula una formación.
	•	Panel “¿No ves tu formación?” en Mi Formación con correo, campo de código y contacto; tono orientador, no de error.
	•	En la ficha pública, el bloque de inscripción se reemplaza por “La inscripción se gestiona fuera de la plataforma” (ver HU-16).
5.2 Estados de la interfaz
Estado
Descripción
Success
Formación vinculada: banner de confirmación y tarjeta en Mi Formación.
Empty
Correo sin inscripciones Moodle: mensaje con código de acceso y contacto.
Error
Código inválido, usado o vencido: mensaje específico.
Unauthorized
Acceso por URL a una formación Moodle sin estar en la lista.

HU-26 — Mis pagos y comprobantes
Rol / actor: Participante
1. Historia de usuario
Como participante que ha pagado una o más formaciones, quiero consultar mis pagos, el estado de mi plan de cuotas y descargar comprobantes, para controlar lo pagado y lo pendiente.
Beneficio / valor: Da transparencia sobre pagos con tarjeta, cuotas y transferencias y reduce consultas al equipo. Pestaña “Mis pagos” del perfil (ver HU-14).
2. Wireframe ilustrativo

Figura 26 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Plan de cuotas activo
Tarjeta
—
Solo con un plan vigente
Estado, avance (“1 de 3 cuotas pagadas”), próximo cobro y tarjeta (ver HU-24)
Historial de pagos
Tabla
—
Solo pagos propios; del más reciente al más antiguo
Fecha, concepto, monto, moneda, método y estado
Estado del pago
Badge
—
—
Tarjeta: Pagado, Fallido, Reembolsado. Transferencia: Pendiente de validación, Validada, Rechazada (ver HU-33)
Descargar comprobante
Acción
—
Solo pagos “Pagado” o “Validada”
Recibo PDF con folio, fecha, concepto, monto, moneda y método; no es factura fiscal
Detalle del pago
Modal
—
—
Comprobante enviado y, si fue “Rechazada”, motivo y opción de reenviar (ver HU-23)
Actualizar método de pago
Acción
—
Solo con un plan vigente
Abre el portal de cliente de Stripe; no se guardan datos de tarjeta
4. Criterios de aceptación
	•	Dado que tengo pagos registrados, cuando abro Perfil > “Mis pagos”, entonces veo arriba mi plan de cuotas vigente (cuotas pagadas/total, próximo cobro, tarjeta) y el historial del más reciente al más antiguo.
	•	Dado que un pago está “Pagado” o “Validada”, cuando hago clic en “Descargar comprobante”, entonces descargo un PDF con folio, fecha, concepto, monto, moneda y método.
	•	Dado que mi transferencia fue “Rechazada”, cuando abro su detalle, entonces veo el comprobante enviado, el motivo y la opción de subir otro (ver HU-23).
	•	Dado que una cuota falló o el plan está “En mora”, cuando abro “Mis pagos”, entonces veo un aviso destacado con el monto pendiente y “Actualizar tarjeta” / “Pagar ahora” (ver HU-24).
	•	Dado que intento abrir un pago o comprobante ajeno mediante la URL, cuando se solicita la ruta, entonces el sistema me niega el acceso.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Tarjeta del plan activo arriba y tabla del historial debajo; en mobile, cada pago como tarjeta apilada.
	•	Montos siempre con moneda explícita (MXN o USD); avisos de cobro fallido, mora o “Rechazada” destacados arriba.
	•	Nota fija al pie: “Los comprobantes son recibos de pago, no facturas fiscales”.
5.2 Estados de la interfaz
Estado
Descripción
Empty
Sin pagos; si solo hay inscripciones Moodle, se explica que se pagaron fuera.
Success
Historial y plan de cuotas cargados con comprobantes disponibles.
Pending
Transferencia en validación o cuota fallida: aviso con la acción a realizar.
Error
No se pudo cargar el historial o generar el comprobante; opción de reintentar.

Fase 3 — Panel administrativo
Herramientas del equipo de la Escuela: ofertas, módulos, sesiones, asistencia, postulaciones, seguimiento y pagos.
HU-27 — Crear y editar una oferta formativa
Rol / actor: Equipo administrativo de la Escuela (Coordinación académica)
1. Historia de usuario
Como integrante de coordinación académica, quiero crear y editar ofertas (diplomado, curso, taller, evento o convocatoria) con un asistente de 7 pasos igual a nuestro proceso, para publicarlas sin depender de desarrollo.
Beneficio / valor: Convierte en flujo guiado los 7 pasos del cliente: datos e imágenes, contenido, horarios, origen NAS/Moodle, recursos, asistencia y WhatsApp, con reglas validadas por tipo.
2. Wireframe ilustrativo

Figura 27 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Tipo y modalidad
Selector
Sí
No editable con inscritos; lugar obligatorio si es presencial
Diplomado, Curso, Taller, Evento o Programa por convocatoria (ej. Aprendices del Agua)
Difusión y contenido
Texto + archivos
Sí
Nombre único; portada JPG/PNG/WebP ≤ 5 MB
Pasos 1–2: portada, carrusel, docente con CV, temario y “¿Qué aprenderás?”
Horario y duración
Regla de horario
Sí
Curso ≤ 9 h; Diplomado 60 h + fecha de proyecto final
Paso 3: días y hora CDMX (ej. sáb y dom 10:00–13:00); genera sesiones (ver HU-29)
Origen, precio y cuotas
Radio + montos
Sí
NAS: precio MXN y USD > 0; cuotas 2 a 4
Paso 4. $10,200 MXN / $585 USD. Moodle: lista de correos y códigos (ver HU-25)
Beca
Interruptor + niveles
No
Solo diplomados NAS; ≥1 nivel; especial requiere entrevista Zoom
Agua Viva 10%, Ríos Vivos 25%, Aguas Libres 50%, Cenotes Vivos 70%, especial hasta 80%
Asistencia y grupo WhatsApp
Horas + URL
No
Ventana 1–72 h (24 h por defecto); URL chat.whatsapp.com
Pasos 6–7: asistencia automática (ver HU-30); WhatsApp visible solo para inscritos
4. Criterios de aceptación
	•	Dado que completo los pasos 1 a 4 con datos válidos, cuando hago clic en “Publicar”, entonces la oferta pasa a “Publicado”, aparece en el catálogo (ver HU-15) y se abre la vista previa de sesiones (ver HU-29).
	•	Dado que la oferta es un Curso de más de 9 h, o un Diplomado sin 60 h o sin fecha de proyecto final, cuando intento avanzar o publicar, entonces el asistente lo impide y muestra la regla incumplida.
	•	Dado que elijo origen “Moodle”, cuando avanzo en “Origen y precio”, entonces se ocultan precio, cuotas y beca, y puedo cargar la lista de correos inscritos y generar códigos de acceso (ver HU-25).
	•	Dado que elijo “Programa por convocatoria” (p. ej. Aprendices del Agua o Siembra de Agua), cuando completo fechas de convocatoria y programa, lugar, cupo, elegibilidad y costo, entonces al publicar aparece con “Postular” (ver HU-20).
	•	Dado que un usuario sin rol administrativo intenta abrir Oferta formativa, cuando solicita la ruta, entonces el sistema le niega el acceso.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Asistente de 7 pasos con autoguardado: Datos e imágenes, Contenido, Horarios, Origen y precio, Recursos (ver HU-28), Asistencia, WhatsApp.
	•	Campos condicionales: lugar solo presencial, datos de convocatoria solo en su tipo, beca solo en diplomados, lista de inscritos solo en Moodle.
	•	Listado con estado (Borrador, Publicado, Inscripciones cerradas, Finalizado), “+ Nueva oferta”, “Duplicar” y “Vista previa”; en el sitio, “Próximamente” antes de abrir.
5.2 Estados de la interfaz
Estado
Descripción
Empty
Listado sin ofertas: “Aún no hay ofertas formativas. Crea la primera.”
Disabled
“Publicar” deshabilitado si faltan obligatorios de los pasos 1 a 4 o reglas del tipo.
Success
“Oferta publicada” con enlace a la ficha y a la vista previa de sesiones.
Error
Errores en línea por campo o fallo al guardar, con opción de reintentar.

HU-28 — Gestión de módulos y recursos pedagógicos
Rol / actor: Equipo administrativo de la Escuela (Coordinación académica)
1. Historia de usuario
Como integrante de coordinación académica, quiero crear y ordenar los módulos de cada oferta y cargar presentación, lecturas, actividades y grabación, para que los inscritos lo encuentren en su aula sin envíos por WhatsApp.
Beneficio / valor: Cubre el paso 5 del cliente con una estructura única por oferta; lo publicado es lo que ve el participante (ver HU-08 y HU-17).
2. Wireframe ilustrativo

Figura 28 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Módulo
Texto + orden
Sí
Título de 3–120 caracteres; numeración automática
Ej.: “Módulo 3 — Humedales construidos” (Diplomado: 9); cursos: un módulo “Contenido”
Presentación del módulo
Archivo o enlace
No
PDF/PPTX ≤ 50 MB o URL válida
Una por módulo; se conserva la versión más reciente
Lecturas previas
Archivos o enlaces
No
PDF/DOCX/EPUB ≤ 50 MB o URL; título obligatorio
Puede enlazar un recurso de la Biblioteca (ver HU-09)
Actividades
Lista
No
Título obligatorio; fecha dentro del periodo de la oferta
Consignas con instrucciones y archivo o enlace; sin entrega de tareas
Link de grabación
URL por sesión
No
URL https; una por sesión del módulo (ver HU-29)
Se carga tras la sesión; sin enlace, “Grabación pendiente” (ver HU-08)
Visibilidad y notificación
Interruptor + casilla
Sí
“Oculto” por defecto; publicación programada solo a futuro
Por módulo y recurso; “Notificar a inscritos” marcada por defecto (ver HU-13)
4. Criterios de aceptación
	•	Dado que selecciono una oferta, cuando agrego un módulo, entonces se crea al final con el número siguiente, en “Oculto” y con cuatro secciones vacías: Presentación, Lecturas previas, Actividades y Grabación.
	•	Dado que publico un recurso con “Notificar a inscritos” marcada, cuando guardo, entonces los inscritos activos lo ven en sus materiales (ver HU-08) y reciben notificación en el portal y por correo (ver HU-13).
	•	Dado que una sesión ya se realizó, cuando pego y publico su link de grabación, entonces los inscritos ven “Ver grabación” en el módulo y desaparece “Grabación pendiente”.
	•	Dado que un módulo o recurso está “Oculto”, cuando un inscrito abre los materiales, entonces no lo ve ni puede acceder a su enlace.
	•	Dado que cargo un archivo con formato no permitido o de más de 50 MB, cuando lo selecciono, entonces veo un error en ese ítem y no se guarda.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Dos columnas: lista de módulos reordenable (arrastrar y soltar) con insignia Publicado/Oculto; a la derecha, el detalle.
	•	Detalle con cuatro secciones fijas: Presentación, Lecturas previas, Actividades y Grabación (una fila por sesión; pasadas sin enlace resaltadas).
	•	Barra inferior fija con “Notificar a inscritos”, “Ver como participante” y “Guardar y publicar”.
5.2 Estados de la interfaz
Estado
Descripción
Empty
Oferta sin módulos: “Esta oferta aún no tiene módulos. Agrega el primero.”
Pending
Sesión realizada sin enlace: “Grabación pendiente” en el módulo.
Success
“Cambios publicados” y, si aplica, “Se notificó a [n] inscritos”.
Error
Archivo rechazado o falla de carga: reintento por ítem.

HU-29 — Generación automática de sesiones en el calendario
Rol / actor: Equipo administrativo de la Escuela (Coordinación académica)
1. Historia de usuario
Como integrante de coordinación académica, quiero que el sistema genere las sesiones de una oferta desde su horario, con color de categoría y enlace de Zoom o Meet, para dejar de crearlas a mano.
Beneficio / valor: Responde al cliente: las sesiones “deberían de generarse solas”. Una regla crea las 20 sesiones del diplomado, sus fechas importantes y su asistencia (ver HU-30).
2. Wireframe ilustrativo

Figura 29 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Regla de horario
Días + horas
Sí
Heredada de la oferta (ver HU-27); fin posterior a inicio
Ej.: sáb y dom 10:00–13:00 CDMX (diplomado); jue 18:00–21:00 CDMX (curso)
Rango y fechas excluidas
Fechas
Sí
Dentro del periodo de la oferta; sin duplicados
Festivos de México precargados y recesos manuales; se omiten sin reprogramar
Categoría de color
Selector
Sí
Heredada de la oferta; editable por sesión
Formación (azul), Territorio (verde), Comunidad (naranja), Eventos (morado), Fechas importantes (rojo)
Enlace de sesión
Radio + URL
Sí
Solo en línea; URL de zoom.us o meet.google.com
Recurrente o por sesión; el participante nunca ve el enlace de anfitrión (ver HU-12)
Fechas importantes automáticas
Casillas
No
La fecha debe existir en la oferta
Eventos rojos: cierre de inscripciones, inicio, límite de beca, proyecto final
Vista previa
Tabla
—
No se confirma con conflictos o curso mayor a 9 h
Fecha, horario CDMX, módulo y estado (Nueva / Excluida / Conflicto); total de horas
4. Criterios de aceptación
	•	Dado que el Diplomado en Ecotecnologías del Agua tiene la regla “sáb y dom 10:00–13:00 CDMX” del 07/11/2026 al 31/01/2027, cuando genero sesiones, entonces la vista previa muestra fechas excluidas y “20 sesiones · 60 h”.
	•	Dado que confirmo la vista previa sin conflictos, cuando pulso “Crear sesiones”, entonces se crean con su color y enlace, aparecen en el calendario de los inscritos (ver HU-10) y cada una lleva su registro de asistencia (ver HU-30).
	•	Dado que la oferta es un curso y la vista previa supera 9 h, cuando intento confirmar, entonces “Crear sesiones” queda deshabilitado con “Los cursos tienen una duración máxima de 9 horas”.
	•	Dado que reprogramo o cancelo una sesión con inscritos, cuando guardo con un motivo, entonces solo cambia esa sesión y los inscritos reciben la notificación con la nueva hora en su zona horaria (ver HU-13).
	•	Dado que creo un webinar con “+ Evento manual”, cuando lo guardo, entonces aparece en el calendario con el color de Eventos y solo lo ve la audiencia elegida (ver HU-10).
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Vista mensual (cinco colores con leyenda) y de lista, filtrable por oferta y categoría; botones “Generar sesiones” y “+ Evento manual”.
	•	Panel “Generar sesiones” en tres pasos: Regla → Excepciones → Vista previa, con resumen “20 sesiones · 60 h · 6 excluidas”.
	•	Horarios en hora CDMX con conversión a otras ciudades (ver HU-11); sesiones editadas, canceladas o sin enlace llevan ícono distintivo.
5.2 Estados de la interfaz
Estado
Descripción
Empty
Oferta sin sesiones: invitación a generarlas a partir de su horario.
Disabled
“Crear sesiones” deshabilitado por conflictos, datos faltantes o curso mayor a 9 h.
Success
“Se crearon 20 sesiones y 4 fechas importantes” con enlace al calendario.
Error
Fallo al crear: no se crea ninguna sesión parcialmente; opción de reintentar.

HU-30 — Control de asistencia por sesión
Rol / actor: Equipo administrativo de la Escuela (Coordinación académica)
1. Historia de usuario
Como integrante de coordinación académica, quiero que el registro de asistencia de cada sesión se abra solo al terminar y ver quién registró y su % de asistencia, para dar seguimiento sin crear formularios.
Beneficio / valor: Cubre el paso 6 del cliente sin formularios externos: el registro nace con cada sesión (ver HU-29), abre al terminar y cierra en 24 h.
2. Wireframe ilustrativo

Figura 30 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Oferta y sesión
Selectores
Sí
Solo ofertas con sesiones generadas (ver HU-29)
Estado: Programada / Registro abierto / Cerrada / Cancelada
Ventana de registro
Numérico (horas)
Sí
De 1 a 72 h; por defecto 24 h
Abre al fin de la sesión; se define por oferta (ver HU-27) y sesión
Lista de inscritos
Tabla
—
Inscritos activos (NAS y Moodle)
Registrada / Pendiente / No registrada, fecha, origen (Participante / Manual) y comentario
Marcar asistencia manual
Acción individual/masiva
No
Motivo obligatorio; no en sesiones Canceladas
Registra quién y cuándo; en presenciales, “Pasar lista en sitio”
% de asistencia
Calculado
—
Sesiones asistidas ÷ sesiones ya realizadas
Alerta bajo 80%; distinto del “Progreso” del aula (ver HU-17)
Exportar
CSV/Excel
—
Respeta los filtros aplicados
Filtros por estado, país o nombre
4. Criterios de aceptación
	•	Dado que una sesión del Diplomado en Ecotecnologías del Agua termina a las 13:00 CDMX, cuando llega esa hora, entonces su registro pasa a “Registro abierto” y los inscritos pueden registrar asistencia (ver HU-18) durante 24 h.
	•	Dado que vence la ventana de registro, cuando un inscrito intenta registrar su asistencia, entonces ya no puede; la sesión pasa a “Cerrada” y quienes seguían “Pendiente” quedan como “No registrada”.
	•	Dado que abro una sesión en “Por sesión”, cuando se carga, entonces veo cada inscrito con su estado y comentario, y el resumen “18 de 25 registraron asistencia (72%)”.
	•	Dado que marco a alguien manualmente con motivo, o uso “Pasar lista en sitio” en un taller presencial, cuando guardo, entonces queda “Registrada” con origen “Manual”, se registra quién y cuándo, y su % se recalcula.
	•	Dado que una sesión fue cancelada (ver HU-29), cuando consulto la asistencia de la oferta, entonces esa sesión no tiene registro y no cuenta para el % de nadie.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Chips de sesiones con su estado; pestañas “Por sesión” y “Por participante”.
	•	“Por sesión”: horario CDMX, cierre del registro, barra “18 de 25 · 72%” y botones “Copiar enlace” y “Recordar a pendientes”.
	•	Selección múltiple con modal de motivo; en mobile la tabla pasa a tarjetas, útil para pasar lista en el taller.
5.2 Estados de la interfaz
Estado
Descripción
Pending
Registro aún no abierto; muestra fecha y hora de apertura.
Enabled
Registro abierto; contador de registros en vivo.
Disabled
Registro cerrado o sesión cancelada; solo cambios manuales con motivo.
Error
Fallo al cargar o guardar la asistencia, con opción de reintentar.

HU-31 — Revisión de postulaciones en equipo
Rol / actor: Comité de revisión de becas y convocatorias
1. Historia de usuario
Como integrante del comité de becas y convocatorias, quiero revisar cada postulación con sus evidencias, evaluarla en equipo, agendar la entrevista y registrar la decisión, para dejar el Excel y responder más rápido.
Beneficio / valor: Reemplaza el Excel y los correos manuales: reúne becas (ver HU-19) y convocatorias (ver HU-20), exige entrevista por Zoom cuando aplica y notifica la decisión.
2. Wireframe ilustrativo

Figura 31 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Bandeja y estado
Pestañas + tabla
—
Pasa a “En revisión” al abrir el detalle por primera vez
Becas / Convocatorias; filtros por oferta, estado (ver HU-21), nivel, país y “Requiere entrevista”
Postulación
Solo lectura
—
—
Datos de contacto, carta de intención o respuestas, fotos/videos de experiencia territorial
Evaluación por integrante
Recomendación + comentario
No
Una evaluación editable por integrante
Aprobar / No seleccionar / Tengo dudas + nivel sugerido; nunca visible al postulante
Entrevista por Zoom
Fecha, hora, enlace
Sí
Obligatoria en Beca especial (>70%) y convocatorias; URL zoom.us
Invitación con hora en la zona del postulante (ver HU-11); se marca “Realizada”
Decisión y nivel asignado
Radio + selector
Sí
Nivel habilitado (ver HU-27); especial 71–80%; puede diferir del solicitado
Agua Viva 10%, Ríos Vivos 25%, Aguas Libres 50%, Cenotes Vivos 70%, Beca especial
Correo al postulante
Plantilla editable
Sí
Requiere vista previa confirmada
Aprobada: nivel, saldo en MXN/USD y link de pago a 7 días (ver HU-23)
4. Criterios de aceptación
	•	Dado que varias integrantes evaluaron una postulación, cuando abro el detalle, entonces veo sus datos y evidencias, el resumen (p. ej. “2 aprobar · 1 con dudas · nivel más sugerido: Aguas Libres 50%”) y los comentarios.
	•	Dado que la postulación es Beca especial (más de 70%) o de convocatoria, cuando intento aprobar sin entrevista “Realizada”, entonces el botón queda deshabilitado con “Esta postulación requiere entrevista por Zoom”.
	•	Dado que apruebo una beca Aguas Libres 50% sobre 10,200 MXN, cuando confirmo, entonces se envía el saldo (5,100 MXN) con link de pago a 7 días (ver HU-23) y el estado pasa a “Aprobada – pendiente de pago”.
	•	Dado que soy integrante sin permiso de decisión, cuando abro una postulación, entonces puedo evaluar y comentar, pero no veo “Registrar decisión”.
	•	Dado que la decisión se guarda pero falla el envío del correo, cuando ocurre el error, entonces la postulación muestra “Correo no enviado” con “Reintentar envío”, sin perder la decisión.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Vista dividida: bandeja a la izquierda y detalle a la derecha, con “Anterior / Siguiente” para revisar en secuencia.
	•	Insignias “Requiere entrevista” y “Sin mi evaluación” con número de evaluaciones; “Exportar a Excel” para la transición.
	•	Bloque de decisión con nivel, precio en moneda del postulante (MXN México, USD resto), saldo y vista previa del correo.
5.2 Estados de la interfaz
Estado
Descripción
Empty
“No hay postulaciones pendientes” o sin resultados con los filtros.
Disabled
Decisión bloqueada sin entrevista obligatoria “Realizada” o sin nivel válido.
Success
“Decisión registrada y correo enviado a [postulante]”.
Error
Decisión guardada pero correo no enviado: “Reintentar envío”.

HU-32 — Seguimiento de postulación a inscripción (embudo)
Rol / actor: Equipo administrativo de la Escuela (seguimiento de inscripciones)
1. Historia de usuario
Como integrante del equipo de seguimiento, quiero ver por oferta cuántas personas postularon, fueron aprobadas, iniciaron el pago y se inscribieron, y contactar a quienes no pagan, para aumentar la inscripción.
Beneficio / valor: ~50% de postulantes termina inscrito y el seguimiento vive en Excel y WhatsApp; la vista muestra dónde se pierden y prioriza plazos de 7 días.
2. Wireframe ilustrativo

Figura 32 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Oferta o convocatoria
Selector
Sí
Solo con postulaciones o inscripciones
Ej.: Diplomado en Ecotecnologías del Agua, Aprendices del Agua, Siembra de Agua
Embudo de conversión
Gráfico 4 etapas
—
—
Postulados → Aprobados (ver HU-31) → Con pago iniciado → Inscritos; % por etapa
Aprobados sin pagar
Tabla
—
“Aprobada – pendiente de pago”; plazo de 7 días naturales
Nombre, país, nivel, saldo (MXN/USD), plazo restante y último contacto; alerta ≤ 2 días
Recordatorio y WhatsApp
Botones
—
Máx. 1 recordatorio cada 24 h; WhatsApp requiere teléfono con indicativo
Correo con saldo, fecha límite y link de pago (ver HU-23); wa.me prellenado
Notas de seguimiento
Texto + resultado
No
Máx. 1.000 caracteres
Sin respuesta / Pagará pronto / Solicita cuotas / Desiste; historial con autor
Extender plazo y cerrar
Acciones con confirmación
No
Nueva fecha ≤ inicio de clases; motivo obligatorio
“Extender plazo” reactiva una “Vencida”; “Cerrar inscripciones” cambia la oferta (ver HU-27)
4. Criterios de aceptación
	•	Dado que selecciono el Diplomado en Ecotecnologías del Agua, cuando carga la vista, entonces veo el embudo con conteos y porcentajes (p. ej. 40 postulados → 30 aprobados → 24 con pago iniciado → 20 inscritos = 50%).
	•	Dado que hay personas en “Aprobada – pendiente de pago”, cuando consulto “Aprobados sin pagar”, entonces las veo por vencimiento más próximo, con saldo en MXN o USD y último contacto; al pagar salen de la lista.
	•	Dado que pasan 7 días desde la aprobación sin pago ni comprobante “Pendiente de validación”, cuando vence el plazo, entonces la postulación pasa a “Vencida”, cuenta como pérdida y la persona lo ve (ver HU-21).
	•	Dado que envío un recordatorio o contacto por WhatsApp, cuando se ejecuta, entonces se registra una nota automática; si ya hubo recordatorio en 24 h o no hay teléfono válido, el botón queda deshabilitado.
	•	Dado que un usuario del panel no tiene permiso de seguimiento, cuando entra a Seguimiento, entonces se le niega el acceso y no ve datos de contacto de los postulantes.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Tarjetas de resumen por etapa y embudo horizontal; clic en una etapa filtra la tabla inferior.
	•	Pestañas “Aprobados sin pagar” y “Vencidas”; quienes vencen en 2 días o menos se destacan al inicio.
	•	Panel lateral por persona con línea de tiempo (decisión, recordatorios, WhatsApp, notas, pagos) y plantillas editables con {nombre}, {saldo}, {link_pago}.
5.2 Estados de la interfaz
Estado
Descripción
Empty
“Aún no hay postulaciones” o “Todas las personas aprobadas completaron su pago”.
Pending
Personas con plazo por vencer (2 días o menos) destacadas al inicio.
Success
Recordatorio enviado, plazo extendido o nota registrada.
Unauthorized
Usuario sin permiso de seguimiento: acceso denegado.

HU-33 — Gestión de pagos, cuotas y transferencias
Rol / actor: Administración y finanzas de la Escuela
1. Historia de usuario
Como responsable de administración y finanzas, quiero ver todos los pagos, validar transferencias de México con su comprobante y seguir los planes de cuotas, para confirmar inscripciones sin cruzar correos ni hojas de cálculo.
Beneficio / valor: Los pagos Stripe se registran solos; las transferencias validadas activan la inscripción y los planes muestran quién está al día o en mora.
2. Wireframe ilustrativo

Figura 33 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Listado de pagos
Tabla + filtros
—
MXN y USD nunca se suman entre sí
Concepto (completo / saldo tras beca / cuota n de N), método, monto, moneda, estado
Comprobante y monto recibido
Visor + captura
Sí
Solo México (ver HU-23); monto > 0; fecha ≤ hoy
Junto al saldo esperado en MXN y los datos declarados (monto, fecha, rastreo)
Validar / Rechazar transferencia
Acciones con confirmación
—
Rechazo con motivo: ilegible, monto no coincide, no encontrado, otro
“Pendiente de validación” → Validada (activa inscripción) o Rechazada (puede reenviar)
Planes de cuotas
Tabla
—
—
Cuotas pagadas/total, próximo cobro y estado: Al día, Cobro fallido, En mora, Completado, Cancelado
Acciones sobre un plan
Botones
—
Reintentar en Cobro fallido/En mora; Suspender solo en En mora
Reintentar cobro, Contactar, Suspender/Restablecer acceso, Cancelar plan; suspensión siempre manual
Reembolso
Acción + monto
—
Monto ≤ pagado; motivo obligatorio
Stripe: se procesa en Stripe. Transferencia: se registra el reembolso hecho fuera
4. Criterios de aceptación
	•	Dado que un participante paga con Stripe (ver HU-22, HU-23 o HU-24), cuando consulto el listado, entonces el pago aparece como “Pagado” con concepto, moneda e ID de Stripe, sin intervención manual.
	•	Dado que un participante de México subió su comprobante (ver HU-23), cuando capturo monto y fecha que coinciden y valido, entonces pasa a “Validada”, se activa la inscripción y se notifica al participante (ver HU-13).
	•	Dado que el monto recibido es menor al saldo esperado, cuando intento validar, entonces no puedo y solo puedo rechazar con el motivo “Monto no coincide”, indicando la diferencia.
	•	Dado que falla un cobro de cuota, cuando Stripe lo informa, entonces el plan pasa a “Cobro fallido” (3 reintentos en 7 días); a los 15 días sin regularizar, “En mora”, y se habilita “Suspender acceso” (manual).
	•	Dado que un usuario del panel no tiene el rol de Administración y finanzas, cuando entra a Pagos, entonces solo puede consultar, sin validar, rechazar, reembolsar, suspender ni cancelar.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Pestañas: Pagos, Transferencias por conciliar (con contador), Planes de cuotas y Reembolsos; resumen separado por MXN y USD.
	•	Conciliación en vista dividida: comprobante junto al saldo esperado, con “Rechazar” y “Validar y activar inscripción”.
	•	Cada plan muestra una mini línea de cuotas y días desde el cobro fallido; acciones sensibles piden confirmación con su efecto.
5.2 Estados de la interfaz
Estado
Descripción
Pending
Transferencia “Pendiente de validación” o reembolso en proceso en Stripe.
Success
Transferencia validada e inscripción activada, reembolso o reintento exitoso.
Error
Fallo de Stripe o al cargar el comprobante, con opción de reintentar.
Unauthorized
Rol sin permisos de finanzas: solo lectura, sin botones de acción.

Sitio Público — Páginas completas
Páginas completas del sitio público con los textos literales del cliente.
HU-34 — Página Itinerantes del Agua / Escuela Itinerante del Agua
Rol / actor: Visitante público
1. Historia de usuario
Como visitante público que llega desde la landing (ver HU-01), quiero conocer Itinerantes del Agua y toda la oferta de la Escuela Itinerante del Agua, para elegir una formación y dar el siguiente paso.
Beneficio / valor: Presenta el texto literal del cliente y conecta cada ítem de la oferta con su ficha (ver HU-16) o el catálogo (ver HU-15).
2. Wireframe ilustrativo

Figura 34 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Textos de presentación
Texto fijo
—
Literales, completos y en este orden
Título: “Itinerantes del Agua” · Tagline: “Tecnologías regenerativas para las aguas vivas.”
“Combinamos educación, diseño, innovación tecnológica y acción territorial para desarrollar y compartir soluciones que permitan cuidar, tratar, captar, infiltrar y regenerar el agua desde una mirada basada en la naturaleza.”
“Creamos procesos de aprendizaje, desarrollamos tecnologías regenerativas y acompañamos a comunidades, escuelas y organizaciones en la construcción de soluciones adaptadas a sus territorios.”
Frase destacada: “Aprendemos del agua, diseñamos con la naturaleza y regeneramos desde el territorio.”
“NUESTROS CAMINOS” · subtítulo “(Las áreas de Itinerantes del Agua)”
“💧 ESCUELA ITINERANTE DEL AGUA: Aprender y compartir conocimiento para las aguas vivas.”
“Un espacio de aprendizaje donde compartimos conocimientos, herramientas y experiencias para comprender y regenerar los ciclos del agua.”
“A través de diplomados, talleres presenciales y procesos de formación en línea, acercamos conocimientos técnicos, saberes territoriales y prácticas de autoconstrucción a personas que quieren involucrarse en el cuidado y la regeneración de las aguas.”
Oferta y otras áreas
Listas + tarjetas
—
Todos los ítems, literales y en este orden
Formación especializada: Diplomado en Ecotecnologías del Agua · Diplomado de Ecopedagogías · Escuela de Aprendices del Agua
Cursos y talleres online: Introducción a los sistemas de tratamiento de aguas · Humedales construidos · Baños secos · Captación y cosecha de agua
Aprendizaje práctico: Laboratorios Itinerantes del agua · Prácticas territoriales · Visitas y experiencias de campo
Tarjetas: “DISEÑO Y ASESORÍA: Diseñar soluciones adaptadas a cada territorio.” (ver HU-35) · “TECNOLOGÍAS REGENERATIVAS: Desarrollar e implementar soluciones basadas en la naturaleza.” (ver HU-36)
Enlace de cada ítem
Enlace
—
Según la oferta publicada asociada (ver HU-27)
A su ficha (ver HU-16) o catálogo filtrado (ver HU-15); sin oferta, sin enlace
Etiqueta de disponibilidad
Badge
No
Según el estado de la oferta asociada
Inscripciones abiertas / Próximamente / Inscripciones cerradas / Programa por convocatoria / Sin fechas programadas
Botones finales
CTA
—
“Crear mi cuenta” solo sin sesión
“Ver toda la oferta formativa” (ver HU-15) y “Crear mi cuenta” (ver HU-02)
4. Criterios de aceptación
	•	Dado que hago clic en “Ver página completa” de “Itinerantes del Agua” en la landing (ver HU-01), cuando carga la página, entonces veo todos los textos literales del cliente, completos y en su orden.
	•	Dado que reviso la oferta de la Escuela, cuando miro sus tres grupos, entonces veo los 10 ítems del cliente (3 + 4 + 3) sin omitir, resumir ni reordenar ninguno.
	•	Dado que un ítem tiene oferta publicada, cuando hago clic, entonces llego a su ficha (ver HU-16) o, si hay varias, al catálogo filtrado (ver HU-15); sin oferta vigente muestra “Sin fechas programadas” sin enlace.
	•	Dado que falla la consulta de disponibilidad, cuando se renderiza la página, entonces textos e ítems se muestran igual, sin etiquetas, y cada ítem enlaza al catálogo general (ver HU-15).
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Orden exacto: encabezado → párrafos → frase destacada como cita → NUESTROS CAMINOS (Escuela y tarjetas de las otras áreas) → botones.
	•	Tres grupos de oferta en tres columnas en desktop y apilados en mobile; cada ítem con “›” y su etiqueta.
	•	El enlace ítem → ficha o catálogo se resuelve con la oferta publicada (ver HU-27), sin cambiar código al agregar ofertas.
5.2 Estados de la interfaz
Estado
Descripción
Default
Textos literales completos y tres grupos de oferta con sus enlaces.
Empty
Ítem sin oferta vigente: etiqueta “Sin fechas programadas” y sin enlace.
Error
Sin etiquetas de disponibilidad; ítems enlazan al catálogo general; textos intactos.
Authenticated
Con sesión iniciada, “Crear mi cuenta” cambia a “Ir a mi portal” (ver HU-06).

HU-35 — Página Diseño y Asesoría
Rol / actor: Visitante público
1. Historia de usuario
Como visitante público con un proyecto domiciliario, comercial, colectivo o productivo, quiero conocer qué diseña y asesora Itinerantes del Agua, para saber si pueden acompañar mi proyecto y solicitar una asesoría.
Beneficio / valor: Presenta el área con el texto literal del cliente y convierte el interés en una solicitud: “Solicitar asesoría” abre Contacto (ver HU-38) con asunto preseleccionado.
2. Wireframe ilustrativo

Figura 35 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Encabezado y párrafos
Texto fijo
—
Literales, completos y en este orden
Encabezado: “DISEÑO Y ASESORÍA: Diseñar soluciones adaptadas a cada territorio.”
“Implementación de soluciones basadas en la naturaleza para la transición climática a nivel domiciliario y comercial.”
“Acompañamos a espacios y proyectos colectivos, organizaciones o proyectos productivos que desean integrar los sistemas regenerativos de aguas ya sea para captación de agua de lluvia, rehidratación del paisaje o tratamiento de aguas residuales.”
“Partimos de las condiciones del territorio para crear soluciones que integren procesos naturales, conocimientos técnicos y tecnologías apropiadas.”
Bloque “¿Qué hacemos?”
Grilla de tarjetas
—
Los 5 ítems literales, en este orden
Diseño de sistemas de tratamiento de aguas residuales · Diseño de sistemas de captación de lluvias · Diseño de sistemas de infiltración y rehidratación del paisaje · Diagnósticos y estrategias para la resiliencia hídrica · Asesoría para implementación de tecnologías
Botones de solicitud
CTA + enlaces
—
Tras “¿Qué hacemos?” y al final; barra fija en mobile
“Solicitar asesoría” y “Me interesa” abren Contacto (ver HU-38) con asunto y servicio precargados
Proyectos realizados
Grilla de tarjetas
No
Se oculta si no hay proyectos cargados
Imagen, nombre, ubicación y tipo de solución; propuesta sin contenido aún del cliente
4. Criterios de aceptación
	•	Dado que hago clic en “Ver página completa” de “Diseño y asesoría” en la landing (ver HU-01), cuando carga la página, entonces veo el encabezado y los tres párrafos literales completos.
	•	Dado que llego a “¿Qué hacemos?”, cuando se renderiza, entonces veo los cinco servicios del cliente con su redacción literal y en su orden.
	•	Dado que hago clic en “Solicitar asesoría” o en “Me interesa” de un servicio, cuando se abre Contacto (ver HU-38), entonces el asunto “Diseño y asesoría” y, si aplica, el servicio ya están precargados.
	•	Dado que no hay proyectos cargados, cuando se renderiza la página, entonces “Proyectos realizados” no se muestra y no quedan espacios vacíos.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Orden: encabezado → tres párrafos → “¿Qué hacemos?” → “Solicitar asesoría” → Proyectos realizados (si hay) → enlace a tecnologías (ver HU-36).
	•	“¿Qué hacemos?” en grilla de cinco tarjetas con ícono y “Me interesa” (3 + 2 en pantallas medianas, una columna en mobile).
	•	Asunto, servicio y origen viajan como parámetros de URL hacia Contacto, para que funcionen también al compartir el enlace.
5.2 Estados de la interfaz
Estado
Descripción
Default
Textos literales, “¿Qué hacemos?” y botones de solicitud visibles.
Empty
Sin proyectos cargados: la sección “Proyectos realizados” se oculta.
Success
Llega a Contacto (ver HU-38) con asunto y servicio precargados.
Error
Falla la carga de imágenes: texto alternativo; los botones siguen funcionando.

HU-36 — Página Innovación y tecnologías regenerativas (incl. HAWA)
Rol / actor: Visitante público
1. Historia de usuario
Como visitante público (hogar, comunidad, escuela u organización), quiero conocer las líneas de innovación de Itinerantes del Agua y el biofiltro HAWA, para entender si aplican a mi espacio y manifestar mi interés.
Beneficio / valor: Da visibilidad a la investigación y a HAWA, su tecnología insignia, con el texto literal del cliente, y convierte el interés en contacto (ver HU-38).
2. Wireframe ilustrativo

Figura 36 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Encabezado, párrafos y líneas
Texto fijo
—
Literales, completos y en este orden
Encabezado: “🌀 TECNOLOGÍAS REGENERATIVAS: Desarrollar e implementar soluciones basadas en la naturaleza.”
Frase destacada: “Creamos tecnologías para que el agua vuelva a ser parte de los ciclos vivos.”
“En Itinerantes del Agua desarrollamos, probamos e implementamos soluciones basadas en la naturaleza para responder a los desafíos del agua en hogares, comunidades, escuelas y proyectos productivos.”
“Combinamos investigación, diseño, conocimientos locales y experimentación para desarrollar tecnologías que permitan captar, tratar, aprovechar y reintegrar el agua al territorio.”
“Nuestras líneas de innovación”:
1. Captación y manejo del agua — “Sistemas para captar, almacenar, infiltrar y aprovechar el agua de lluvia.”
2. Tratamiento de aguas — “Tecnologías vivas para el tratamiento descentralizado de aguas grises y negras.” (aquí va HAWA)
3. Regeneración del paisaje — “Soluciones que buscan recuperar los ciclos del agua y contribuir a la rehidratación de los territorios.”
Sección destacada HAWA
Bloque destacado (#hawa)
—
Literal; entre “Tratamiento de aguas” y “Regeneración del paisaje”
Título “HAWA” · subtítulo “Biofiltro para el tratamiento de aguas grises”
“HAWA es una tecnología desarrollada por Itinerantes del Agua para el tratamiento descentralizado de aguas grises, utilizando procesos naturales de filtración y depuración.”
“Diseñada para espacios domésticos, educativos y comunitarios, HAWA busca transformar las aguas que normalmente consideramos residuales en un recurso que pueda reincorporarse de manera segura a otros usos y procesos del territorio.”
“HAWA nace de una pregunta:” + cita “¿Cómo podemos tratar el agua dentro de nuestros propios espacios y devolverla al territorio de una manera regenerativa?”
“HAWA integra:” Procesos naturales de depuración · Filtración de aguas grises · Diseño para espacios descentralizados · Reutilización y aprovechamiento del agua · Investigación y experimentación · Adaptación a diferentes contextos territoriales
Imagen de HAWA
Imagen
No
Liviana (WebP/SVG) con texto alternativo
Pendiente del cliente; sin imagen, la sección se muestra solo con texto
CTA y enlaces cruzados
CTA + enlaces
—
—
“Me interesa HAWA” → Contacto (ver HU-38); “¿Quieres implementarlo?” (ver HU-35); “¿Quieres aprender?” (ver HU-34)
4. Criterios de aceptación
	•	Dado que hago clic en “Ver página completa” de “Innovación y tecnologías regenerativas” en la landing (ver HU-01), cuando carga la página, entonces veo el encabezado, la frase destacada, los dos párrafos y las tres líneas literales.
	•	Dado que reviso la línea “Tratamiento de aguas”, cuando continúo, entonces veo la sección HAWA completa (subtítulo, dos párrafos, pregunta como cita y seis ítems de “HAWA integra:”) antes de “Regeneración del paisaje”.
	•	Dado que hago clic en “Me interesa HAWA” o “Conversemos sobre tu proyecto”, cuando se abre Contacto (ver HU-38), entonces el asunto “Tecnologías regenerativas – HAWA” ya está preseleccionado.
	•	Dado que llego desde “Conocer HAWA” en la landing (ver HU-01) o desde un enlace con #hawa, cuando carga la página, entonces se desplaza directo a la sección HAWA.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Orden exacto: encabezado → párrafos → líneas (Captación → Tratamiento → HAWA destacada → Regeneración del paisaje) → bloque final con CTA.
	•	HAWA con fondo y borde propios e imagen; la pregunta como cita y “HAWA integra:” en tres columnas (una en mobile).
	•	La línea “Tratamiento de aguas” muestra la etiqueta “Destacado: HAWA”, que desplaza a la sección.
5.2 Estados de la interfaz
Estado
Descripción
Default
Textos literales, tres líneas de innovación y sección HAWA completas.
Empty
Sin imagen de HAWA cargada: la sección se muestra solo con texto.
Success
Llega a Contacto (ver HU-38) con el asunto preseleccionado.
Error
Falla la carga de imágenes: texto alternativo; textos y botones siguen funcionando.

HU-37 — Página Nuestra trayectoria (Quiénes somos)
Rol / actor: Visitante público
1. Historia de usuario
Como visitante público, quiero conocer la historia, los premios y el equipo de Itinerantes del Agua, para confiar en su trayectoria antes de inscribirme, pedir asesoría o proponer una alianza.
Beneficio / valor: Concentra la credibilidad institucional en una página propia, destino de “Ver página completa” (ver HU-01), y puede publicarse con contenido parcial sin mostrar bloques rotos.
2. Wireframe ilustrativo

Figura 37 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Encabezado
Título + subtítulo
—
Texto fijo
“Nuestra trayectoria” / “Quiénes somos”; texto introductorio pendiente del cliente
Historia
Texto + imagen
—
Extensión sugerida de 150 a 400 palabras
Relato de origen y evolución; línea de tiempo de hitos opcional (año + descripción)
Premios y reconocimientos
Grilla de tarjetas
No
Nombre (máx. 120), entidad y año AAAA obligatorios
Del más reciente al más antiguo; logo o enlace opcional; se oculta sin ítems
Equipo
Grilla de tarjetas
—
Nombre y rol obligatorios; semblanza máx. 300 caracteres
Foto opcional (avatar con iniciales si falta); requiere autorización de uso de imagen
Accesos finales
Enlaces
—
—
“Conoce la Escuela” (ver HU-34) y “Contáctanos” (ver HU-38, origen “página Nuestra trayectoria”)
4. Criterios de aceptación
	•	Dado que hago clic en “Ver página completa” de “Nuestra trayectoria” en la landing (ver HU-01), cuando carga la página, entonces veo en orden los bloques Historia, Premios y reconocimientos, y Equipo.
	•	Dado que existen premios cargados, cuando reviso el bloque, entonces veo cada uno con nombre, entidad otorgante y año, del más reciente al más antiguo.
	•	Dado que no hay premios cargados, cuando se renderiza la página, entonces el bloque se oculta por completo (título incluido) sin afectar Historia ni Equipo.
	•	Dado que un integrante no tiene foto o semblanza, cuando se muestra su tarjeta, entonces aparece un avatar con iniciales o solo foto, nombre y rol, sin espacios vacíos.
	•	Dado que Historia y Equipo aún no tienen contenido, cuando un visitante navega el sitio, entonces no hay enlaces a esta página y la ruta directa responde “no encontrado”.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Orden fijo Historia → Premios y reconocimientos → Equipo, con anclas #historia, #premios y #equipo.
	•	Premios en 3 columnas y Equipo en 4 (2 en tablet, 1 en mobile) con foto circular; hitos en vertical en mobile.
	•	Sin ítem propio en el menú principal: se accede desde la landing (ver HU-01) y el pie de página.
5.2 Estados de la interfaz
Estado
Descripción
Default
Tres bloques con contenido real.
Empty
Sin premios: el bloque se oculta sin afectar Historia ni Equipo.
Pending
Historia y Equipo sin contenido: página sin enlaces y ruta “no encontrado”.
Error
Falla la carga de imágenes: avatar con iniciales o texto alternativo.

HU-38 — Página Contacto
Rol / actor: Visitante público
1. Historia de usuario
Como visitante público (interesado en formación, asesoría o HAWA), quiero un formulario de contacto claro y los canales directos del equipo, para enviar mi consulta con certeza de que fue recibida.
Beneficio / valor: Centraliza las solicitudes en un único formulario, compartido con la landing (ver HU-01), con asunto y canal de origen para priorizar sin perder mensajes.
2. Wireframe ilustrativo

Figura 38 — boceto esquemático de baja fidelidad. NO es el diseño final; el diseño final se construye en Figma.
3. Descripción de campos
Campo
Tipo
Obligatorio
Validación
Notas
Datos de contacto
Texto
Sí
Nombre mín. 3 caracteres; correo válido; teléfono con indicativo
Nombre y correo obligatorios; organización y teléfono/WhatsApp opcionales
Asunto
Selector
Sí
Una opción de la lista
Escuela, Diseño y asesoría, Tecnologías regenerativas – HAWA, Becas y convocatorias, Otro; preseleccionable (ver HU-35/HU-36)
Datos del proyecto
Grupo condicional
Sí
Solo si el asunto es “Diseño y asesoría”
Tipo de proyecto, ubicación y servicio de interés (ver HU-35) o “Aún no lo sé”
Mensaje y política de datos
Texto + checkbox
Sí
Mensaje de 10 a 2.000 caracteres; política marcada para enviar
Contador de caracteres; enlace a la política en pestaña nueva
Anti-spam y canal de origen
Automático (oculto)
—
Captcha invisible + honeypot; máx. 5 envíos por IP por hora
Origen: página de Contacto, landing, Diseño y Asesoría, Tecnologías regenerativas o Nuestra trayectoria
Canales directos y redes
Enlaces
—
WhatsApp abre wa.me con mensaje inicial
WhatsApp, correo y redes oficiales (datos pendientes del cliente); no se muestra en la landing
4. Criterios de aceptación
	•	Dado que completo los obligatorios con datos válidos y acepto la política, cuando envío, entonces veo “¡Gracias! Recibimos tu mensaje.”, recibo acuse por correo y el mensaje queda registrado con asunto, origen y estado “Nuevo”.
	•	Dado que llego desde “Solicitar asesoría” (ver HU-35) o “Me interesa HAWA” (ver HU-36), cuando se muestra el formulario, entonces el asunto ya está preseleccionado y el origen registra esa página.
	•	Dado que elijo el asunto “Diseño y asesoría”, cuando el formulario se actualiza, entonces tipo de proyecto, ubicación y servicio de interés aparecen como obligatorios; con otro asunto se ocultan.
	•	Dado que envío desde la sección Contacto de la landing (ver HU-01), cuando se registra, entonces aplican los mismos campos, validaciones y anti-spam, y solo cambia el canal de origen a “landing”.
	•	Dado que dejo un obligatorio vacío o inválido, o el servidor o el anti-spam rechaza el envío, cuando intento enviar, entonces veo el error (en línea o genérico con reintentar) y conservo lo escrito.
5. Descripción completa de la tarea
5.1 Interfaz (frontend / experiencia)
	•	Dos columnas en desktop (formulario | canales directos); una en mobile, con el formulario primero.
	•	Componente único compartido con la landing (ver HU-01); lee parámetros de URL (asunto, servicio, origen) para precargar e ignora valores no válidos.
	•	“Datos del proyecto” aparece bajo el asunto solo con “Diseño y asesoría”; confirmación en la misma página con “Enviar otro mensaje”.
5.2 Estados de la interfaz
Estado
Descripción
Default
Formulario vacío o con asunto preseleccionado; botón deshabilitado.
Loading
Botón en carga y campos bloqueados durante el envío.
Success
“¡Gracias! Recibimos tu mensaje.”, formulario limpio y acuse enviado.
Error
Validación, error del servidor o anti-spam (“Intenta de nuevo más tarde”); se conservan los datos.

Anexo A — Supuestos y puntos por confirmar por HU
Cada fila es un supuesto tomado al redactar la HU correspondiente. Validar con el cliente antes de desarrollo.
HU
Supuesto / pregunta abierta
General
Fuera de alcance: CMS del sitio público, bandeja de mensajes de contacto, cursos grabados, facturación fiscal (CFDI), PayPal e integración por API con Zoom y Moodle.
HU-01
“Nuestra trayectoria” no está en el último requerimiento de landing; se mantiene antes de Itinerantes del Agua solo si tiene contenido. Confirmar.
HU-01
El texto de invitación de Contacto y el contenido de “Nuestra trayectoria” (historia, premios, equipo) siguen pendientes del cliente.
HU-02
Solo México (y Centroamérica, si el cliente lo pide) tendrá catálogo de divisiones y municipios; los demás países usan texto libre.
HU-02
El teléfono registrado se asume como número de WhatsApp para el seguimiento; confirmar si se necesita un campo separado.
HU-06
El aviso de cuota próxima se muestra desde 7 días antes de la fecha de cobro; confirmar la anticipación deseada.
HU-07
“NAS” se asume como la nueva plataforma (inscripción y pago); solo las inscripciones de origen Moodle llevan etiqueta.
HU-08
Las actividades solo se consultan o descargan; la entrega de actividades por el portal no está en el alcance (confirmar).
HU-08
La grabación es un enlace externo (Zoom, YouTube no listado o Drive) cargado por el equipo, no un archivo alojado; una por sesión.
HU-10
Formación y Territorio solo para inscritos; Eventos y Fechas importantes de inscripciones, becas y convocatorias, visibles para todos los registrados. Confirmar.
HU-10
Encuentros de Comunidad y Eventos (webinars, paneles, masterclasses) los carga el equipo manualmente; no se derivan del horario de una oferta.
HU-11
Hora oficial de las actividades en línea: hora CDMX (America/Mexico_City, UTC−6 todo el año, sin horario de verano).
HU-11
Ciudades de la tabla propuestas según el público (México, Centroamérica, Sudamérica y España); confirmar si falta algún país.
HU-12
Los talleres presenciales no aparecen aquí (sin enlace); se consultan en Calendario (HU-10) y Aula (HU-17), donde también se registra su asistencia.
HU-13
Todos los eventos van al portal y por correo, salvo “En revisión” (solo portal); se propone recordatorio 48 h antes de vencer el saldo.
HU-13
La plataforma no envía WhatsApp ni SMS; el seguimiento por WhatsApp sigue siendo manual del equipo.
HU-14
El username no se puede cambiar desde el perfil; si el cliente lo requiere, se definiría un flujo aparte.
HU-14
La pestaña “Mis pagos” se muestra aunque no haya pagos (estado vacío definido en HU-26).
HU-15
Sin sesión, la moneda se deduce de la zona horaria del navegador (México → MXN; resto → USD); el cobro usa el país del perfil.
HU-15
Las ofertas de origen Moodle se muestran solo como difusión, sin precio ni venta (ver HU-16, HU-25).
HU-16
NAS = la nueva plataforma: solo las ofertas NAS se venden en la ficha; las de Moodle se muestran sin compra (confirmar si deben ocultarse).
HU-16
El costo por módulo es solo informativo (no se venden módulos sueltos); cupo opcional, con “Cupo agotado” al llenarse. Confirmar.
HU-17
Entrega del proyecto final como carga opcional de archivo, habilitable por diplomado; confirmar si basta con la presentación en vivo.
HU-17
Tras finalizar, acceso de consulta indefinido a recursos y grabaciones; no incluye constancia ni certificado. Confirmar.
HU-18
Registro autodeclarado, sin cruce automático con el reporte de Zoom; las correcciones las hace el equipo (HU-30).
HU-18
Ver la grabación no cuenta como asistencia; confirmar si el equipo necesita otras preguntas (p. ej. evaluación de la sesión).
HU-19
Carta como texto (800–4000 caracteres), no PDF; en Beca especial el comité asigna entre 71% y 80% tras la entrevista. Confirmar.
HU-19
El código de iniciativa aliada solo identifica qué iniciativa difundió la convocatoria y no aplica descuento. Confirmar.
HU-20
Sin acceso al Google Forms actual: campos propuestos como base común para todas las convocatorias, a validar con el equipo.
HU-20
Se desconoce si los programas tienen costo: si es gratuito, la persona confirma su participación (HU-21); si no, queda “Aprobada – pendiente de pago”.
HU-21
Se propone el mismo plazo de 7 días para “Confirmar mi participación” en convocatorias sin costo; al vencer, la plaza podría liberarse. Confirmar.
HU-21
Se desconoce si algún programa presencial tiene costo; si lo tiene, la postulación aprobada pasa a “Aprobada – pendiente de pago”. Confirmar.
HU-22
Precio fijo en MXN y USD sin conversión: país México paga en MXN, el resto en USD; sin sesión se estima por zona horaria. Confirmar.
HU-22
Solo se acepta tarjeta vía Stripe; confirmar si en México el pago completo también acepta transferencia y enviar la política de cancelación y reembolso.
HU-23
Plazo: 7 días desde la aprobación, sin superar el inicio del diplomado; el equipo puede extenderlo (ver HU-32). Transferencia: MXN y pago único.
HU-23
Los datos bancarios ([Titular], [Banco], [CLABE]) se configuran en el panel; el cliente confirma la cuenta. Este documento no incluye datos reales.
HU-24
Cuotas iguales, mensuales y sin recargo; los centavos de ajuste van en la última. Solo con tarjeta, no por transferencia.
HU-24
Mora a los 15 días de un cobro fallido; la suspensión la decide el equipo. Confirmar si debe ser automática y si afecta la constancia.
HU-25
Sin integración técnica con Moodle: el equipo carga la lista de correos inscritos por oferta y cohorte (ver HU-27). Confirmar.
HU-25
Los materiales y grabaciones de ofertas Moodle también se publican en el portal (no se sincronizan); confirmar si el portal debe enlazar a Moodle.
HU-26
La facturación fiscal (CFDI) queda fuera del alcance; confirmar cómo la atenderá la Escuela.
HU-26
El historial incluye solo pagos hechos en la plataforma; no se migran pagos anteriores (PayPal, transferencias previas o Moodle).
HU-27
La regla de 60 h de los diplomados se valida como exacta; confirmar si se admiten variaciones (p. ej. 58–64 h).
HU-27
Confirmar si las cuotas aplican también a cursos o solo a diplomados, y si algún programa por convocatoria tiene costo.
HU-28
Las grabaciones se alojan fuera (Zoom Cloud, YouTube no listado, Vimeo o Drive) y el portal solo guarda el enlace; confirmar.
HU-28
Solo el equipo carga materiales; confirmar si las docentes deben tener acceso propio para cargar los de su módulo.
HU-29
Los enlaces de Zoom/Meet se capturan a mano; la creación automática vía API de Zoom queda como mejora futura.
HU-29
Las fechas excluidas se omiten sin recorrerse y solo se precargan festivos de México; confirmar ambas reglas.
HU-30
El registro de asistencia es propio de la plataforma y reemplaza el formulario externo actual; ventana por defecto de 24 h, confirmar.
HU-30
Umbral de 80% solo como alerta visual; el cliente no definió un mínimo de asistencia para certificación.
HU-31
La decisión la registra un rol con permiso (p. ej. Coordinación) sin mínimo de evaluaciones; confirmar si el comité requiere al menos dos.
HU-31
El contenido del formulario de convocatorias (hoy Google Forms) no se conoce; los enlaces de Zoom se capturan manualmente.
HU-32
WhatsApp se usa con enlaces wa.me desde el dispositivo del equipo; sin API de WhatsApp Business ni mensajes automáticos.
HU-32
“Con pago iniciado” = abrió su link de Stripe, subió comprobante o creó plan de cuotas sin primer cobro; confirmar la definición.
HU-33
La validación de transferencias es manual (sin integración bancaria) y aplica solo a México y al pago del saldo en una exhibición.
HU-33
No hay política de reembolsos definida; la acción se habilita sin reglas de plazo hasta que el cliente la defina.
HU-34
Los ítems de cursos y aprendizaje práctico son temáticas que no coinciden 1 a 1 con los cursos del cuestionario; confirmar la correspondencia.
HU-34
“Escuela de Aprendices del Agua” se asumió como el programa por convocatoria “Aprendices del Agua” (ver HU-20); confirmar.
HU-35
El requerimiento dice “DISEÑO Y ASESO.ÍA”; se asumió error tipográfico de “DISEÑO Y ASESORÍA”.
HU-35
“Solicitar asesoría”, “Proyectos realizados” y no publicar precios son propuesta; el cliente no definió cómo se solicita una asesoría.
HU-36
HAWA se ubicó como tecnología destacada de “Tratamiento de aguas”, como en el requerimiento; confirmar si prefieren una sección independiente.
HU-36
HAWA solo se presenta y se gestiona por contacto (sin precio ni venta en línea); fotos y ficha técnica pendientes del cliente.
HU-37
El cliente no ha entregado historia, premios ni datos del equipo; esta HU define la estructura y los estados vacíos.
HU-37
“Nuestra trayectoria” no aparece en el último requerimiento de la landing; se muestra solo con contenido (ver HU-01). Confirmar si se conserva.
HU-38
El cliente no entregó copy ni datos de contacto (WhatsApp, correo, redes); las opciones de asunto y los campos del proyecto son propuesta.
HU-38
Sin bandeja en el panel admin (fuera de alcance): notificación por correo a un buzón del equipo y registro con origen y estado.
