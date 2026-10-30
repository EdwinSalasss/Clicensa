---
name: coding-best-practices
description: Aplica buenas prácticas de programación al escribir o editar código (nombres, estructura, errores, tipos, tests, seguridad). Usar cuando el usuario nombre esta skill, pida seguir buenas prácticas de código, o pida implementar con coding best practices.
disable-model-invocation: true
---

# Buenas prácticas de código

Aplica estas reglas al **escribir y editar** código. No las uses como checklist de review salvo que el usuario pida una revisión. Prefiere el estilo y las convenciones del archivo y del repositorio cuando existan; estas reglas cubren lo que el código local no deja claro.

## Cómo aplicarlas

1. Lee el código alrededor y copia su estilo (indentación, imports, naming, capas).
2. Cambia solo lo necesario para la tarea. No refactorices “de paso”.
3. Si una regla choca con una convención del proyecto, gana el proyecto.
4. Si una regla choca con otra, prioriza: correcto > seguro > claro > breve.

## Principios

- **Claridad sobre ingenio.** El código se lee más veces de las que se escribe.
- **Una responsabilidad por función/módulo.** Si el nombre necesita “y”, divide.
- **Nombres que dicen qué es.** Evita `data`, `info`, `temp`, `handle`, `manager` genéricos.
- **Comenta el porqué**, no el qué. El código ya dice el qué.
- **No abstraigas a la primera.** Duplicar dos veces es aceptable; la tercera pide extraer.
- **Fallos visibles.** No tragues excepciones ni devuelvas valores mágicos que oculten el error.
- **Datos explícitos.** Prefiere tipos, validación en bordes (I/O, HTTP, UI) y contratos claros.

## Estructura

- Funciones cortas y con un nivel de abstracción. Extrae helpers con nombre, no comentarios de sección.
- Parámetros: pocos y con significado. Si pasas más de ~4, agrupa en un objeto/struct con nombre.
- Evita efectos colaterales ocultos. Una función que “parece pura” no debe escribir disco, red ni estado global.
- Dependencias hacia adentro: UI → aplicación → dominio → infra. No mezcles SQL/HTTP dentro de reglas de negocio si el proyecto ya tiene capas.
- Early return para reducir anidación. Evita `else` después de `return`.
- Colecciones: usa las primitivas del lenguaje (`map`/`filter`, list comprehensions, iterators) cuando mejoren la lectura; un `for` claro gana a una cadena opaca.

## Nombres y APIs

- Funciones: verbo + objeto (`fetchOrder`, `validateEmail`). Booleanos: `is`/`has`/`can`/`should`.
- Evita abreviaciones salvo las del dominio (`id`, `url`, `http`).
- No mientas con el nombre: `getX` no debe mutar; `createX` no debe ser idempotente a menos que lo documentes.
- APIs públicas: estables, mínimas, documentadas por tipos y nombres. Internals pueden ser más estrictos.
- Errores: mensajes accionables (qué falló + dato relevante). No filtres secretos (tokens, passwords, PII).

## Errores, bordes y concurrencia

- Valida entrada en el borde. Confía en invariantes en el interior.
- Distingue errores recuperables (respuesta al usuario, retry) de bugs (no deberían ocurrir).
- Timeouts, cancelación y tamaño de payload en I/O. No dejes fetches/queries sin límite.
- En código concurrente: no compartas estado mutable sin sincronización; prefiere inmutabilidad o un solo dueño del estado.
- Idempotencia en operaciones que pueden reintentarse (pagos, webhooks, jobs).

## Tipos, datos y persistencia

- Usa el sistema de tipos del lenguaje. Evita `any`/`Object`/`Map<String, Object>` salvo bordes temporales y márcalos.
- Null/undefined: maneja ausencia de forma explícita. No encadenes fallbacks silenciosos que escondan bugs.
- Fechas: UTC en almacenamiento y transporte; zona horaria solo en presentación.
- Dinero y decimales: tipos/enteros adecuados, nunca float para moneda.
- Migraciones y esquemas: aditivas y reversibles cuando el proyecto las use. No “arregles” datos a mano en código de aplicación.

## Seguridad (mínimo al implementar)

- Nunca hardcodees secretos. No los registres ni los mandes al cliente.
- Autoriza en servidor. El cliente no es de confianza.
- Parametriza queries. No concatenes SQL/shell/HTML con datos de usuario.
- Escapa/serializa según el contexto (HTML, URL, headers).
- Principio de mínimo privilegio en tokens, archivos y scopes.

## Tests y cambios

- Cubre el comportamiento que acabas de introducir o arreglar: caso feliz + un borde + un fallo.
- Nombres de test: escenario + resultado esperado.
- Tests deterministas: sin red real, reloj real ni orden de ejecución frágil, salvo tests de integración deliberados.
- No añadas tests que solo duplican la implementación.

## Qué no hacer

- No dejes código comentado “por si acaso”.
- No introduzcas flags eternos (`legacyMode`) sin plan de borrar.
- No optimices sin evidencia (medida o requisito).
- No añadas frameworks, linters o dependencias nuevas si no hacen falta para la tarea.
- No reformatees archivos enteros ni “arregles” estilo no pedido.
- No inventes TODOs que el usuario no pidió.

## Al terminar un cambio

- El diff debe explicar la tarea sin ruido.
- Compila/tipa/linta en lo que ya use el proyecto.
- Si tocaste UI, verifica el flujo, no solo que “se vea”.
- Si no pudiste verificar, dilo.
