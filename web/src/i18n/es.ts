import type { Translations } from "./types";

export const es: Translations = {
  common: {
    save: "Guardar",
    saving: "Guardando...",
    cancel: "Cancelar",
    close: "Cerrar",
    confirm: "Confirmar",
    delete: "Eliminar",
    refresh: "Actualizar",
    retry: "Reintentar",
    search: "Buscar...",
    loading: "Cargando...",
    create: "Crear",
    creating: "Creando...",
    set: "Establecer",
    replace: "Reemplazar",
    clear: "Limpiar",
    live: "En vivo",
    off: "Apagado",
    enabled: "habilitado",
    disabled: "deshabilitado",
    active: "activo",
    inactive: "inactivo",
    unknown: "desconocido",
    untitled: "Sin título",
    none: "Ninguno",
    form: "Formulario",
    noResults: "Sin resultados",
    of: "de",
    page: "Página",
    msgs: "msjs",
    tools: "herramientas",
    match: "coincidencia",
    other: "Otros",
    configured: "configurado",
    removed: "eliminado",
    failedToToggle: "No se pudo alternar",
    failedToRemove: "No se pudo eliminar",
    failedToReveal: "No se pudo mostrar",
    collapse: "Contraer",
    expand: "Expandir",
    general: "General",
    messaging: "Mensajería",
    pluginLoadFailed:
      "No se pudo cargar el script de este complemento. Revisa la pestaña Network (dashboard-plugins/…) y la ruta del complemento del servidor.",
    pluginNotRegistered:
      "El script del complemento no llamó a register(), o falló. Abre la consola del navegador para más detalles.",
  },

  app: {
    brand: "Hermes Agent",
    brandShort: "HA",
    closeNavigation: "Cerrar navegación",
    closeModelTools: "Cerrar modelo y herramientas",
    footer: {
      org: "Nous Research",
    },
    activeSessionsLabel: "Sesiones activas:",
    gatewayStatusLabel: "Estado del Gateway:",
    gatewayStrip: {
      failed: "Inicio fallido",
      off: "Apagado",
      running: "En ejecución",
      starting: "Iniciando",
      stopped: "Detenido",
    },
    nav: {
      analytics: "Analíticas",
      chat: "Chat",
      config: "Configuración",
      cron: "Cron",
      documentation: "Documentación",
      keys: "Claves",
      logs: "Registros",
      models: "Modelos",
      profiles: "perfiles : multi agentes",
      plugins: "Complementos",
      services: "Servicios",
      sessions: "Sesiones",
      skills: "Habilidades",
    },
    modelToolsSheetSubtitle: "y herramientas",
    modelToolsSheetTitle: "Modelo",
    navigation: "Navegación",
    openDocumentation: "Abrir documentación en una nueva pestaña",
    openNavigation: "Abrir navegación",
    pluginNavSection: "Complementos",
    sessionsActiveCount: "{count} activas",
    statusOverview: "Resumen de estado",
    system: "Sistema",
    webUi: "Web UI",
  },

  services: {
    backToServices: "Volver a Servicios",
    backToHome: "Inicio",
    exploreService: "Explorar servicio",
    prevService: "Servicio Anterior",
    nextService: "Siguiente Servicio",
    overview: {
      title: "Servicios de Hermes Agent",
      subtitle: "Tres pilares fundamentales que hacen a Hermes único",
      description: "Descubre las capacidades centrales que convierten a Hermes en el agente de IA más completo y autoconsciente del mercado.",
      badge: "Tres Pilares Fundamentales",
      viewAll: "Ver todos",
      comparisonTitle: "Comparación Rápida",
      comparisonDesc: "Qué ofrece cada servicio de un vistazo",
      comparisonPlatforms: "Plataformas",
      comparisonLearning: "Aprendizaje",
      comparisonMemory: "Memoria",
      comparisonTerminal: "Terminal",
      comparisonSecurity: "Seguridad",
      comparisonExtensibility: "Extensibilidad",
      ctaTitle: "¿Listo para empezar?",
      ctaDesc: "Instala Hermes Agent y experimenta el poder de un agente autoconsciente que aprende, recuerda y se adapta a ti.",
      startWithMessaging: "Empezar con Mensajería",
      exploreLearning: "Explorar Aprendizaje",
      tryDesktop: "Probar Desktop",
      services: [
        {
          id: "servicio-1",
          title: "Gateway de Mensajería Multi-plataforma",
          shortDesc: "Un solo proceso conecta tu agente a 7 plataformas con continuidad total",
          description: "Conecta tu agente a Telegram, Discord, Slack, WhatsApp, Signal, Email/Webhooks y CLI nativa. Una conversación que empieza en Telegram continúa en Discord o CLI sin perder contexto. El gateway unificado maneja todas las plataformas simultáneamente con adapteres extensibles, transcripción de voz automática (STT), streaming en tiempo real, y seguridad granular por plataforma.",
          badge: "Multi-plataforma",
          features: [
            "7 plataformas nativas",
            "Continuidad cross-platform",
            "STT automático (voz → texto)",
            "Streaming tiempo real",
            "Aprobación comandos peligrosos",
            "Arquitectura extensible"
          ]
        },
        {
          id: "servicio-2",
          title: "Bucle de Aprendizaje & Memoria Persistente",
          shortDesc: "El único agente que aprende de verdad — crea skills, se auto-mejora y te modela",
          description: "Hermes es el único agente con un bucle de aprendizaje integrado sin supervisión. Tras tareas complejas, detecta patrones y genera skills automáticas. Las skills se auto-mejoran durante el uso. Memoria curada con SQLite FTS5, búsqueda semántica, compresión de contexto inteligente, y modelado dialéctico de usuario (Honcho). 6 proveedores de memoria intercambiables: Honcho, mem0, supermemory, byterover, hindsight, holographic.",
          badge: "Aprendizaje Automático",
          features: [
            "Creación automática de skills",
            "Auto-mejora continua",
            "Memoria persistente curada",
            "Búsqueda FTS5 + semántica",
            "Compresión contexto inteligente",
            "6 proveedores de memoria"
          ]
        },
        {
          id: "servicio-3",
          title: "App de Escritorio & Terminal Real",
          shortDesc: "Electron + React con terminal PTY real, chat persistente, y bots con personalidad",
          description: "Hermes Desktop trae toda la potencia a tu escritorio. Terminal PTY real (xterm.js + WebGL) — no un widget. Chat con streaming token-by-token, slash commands, picker de sesiones visual. Modo Bots único: cada bot es un perfil completo (config, memoria, skills, SOUL.md, modelo) con chat canónico 'Bot Chat'. Bots se @mencionan entre sí para delegar. 6 backends terminal: Local, Docker, SSH, Singularity, Modal, Daytona (serverless persistente). Dashboard web embebe el TUI real.",
          badge: "App Nativa",
          features: [
            "Terminal PTY real (WebGL)",
            "Chat streaming + slash commands",
            "Modo Bots con personalidad",
            "6 backends terminal",
            "Modal/Daytona serverless",
            "Dashboard web con TUI real"
          ]
        }
      ]
    },
    messagingGateway: {
      title: "Gateway de Mensajería Multi-plataforma",
      subtitle: "Un solo proceso, siete plataformas, continuidad total",
      description: "El gateway de Hermes es un proceso único que conecta tu agente a múltiples plataformas de mensajería simultáneamente. No hay procesos separados por canal — uno solo, con toda la lógica centralizada.",
      badge: "Gateway Multi-plataforma",
      platformsTitle: "Plataformas Soportadas",
      platformsDesc: "Conecta tu agente a donde estén tus usuarios",
      platformBadge: "Plataforma",
      featuresTitle: "Características Principales",
      featuresDesc: "Potencia tu agente con capacidades nativas multi-plataforma",
      techTitle: "Detalles Técnicos",
      techDesc: "Arquitectura interna y funcionamiento profundo",
      features: [
        {
          title: "Continuidad Cross-Platform",
          description: "Una conversación que empieza en Telegram continúa en Discord o CLI sin perder contexto. El agente modela quién eres — no importa cómo te comuniques."
        },
        {
          title: "Gateway Unificado",
          description: "Un solo proceso maneja todas las plataformas simultáneamente. Adapteres por plataforma bajo gateway/platforms/ — nuevas plataformas se agregan sin tocar el core."
        },
        {
          title: "Transcripción de Voz (STT)",
          description: "Notas de voz en Telegram y WhatsApp se transcriben automáticamente antes de llegar al agente — el agente \"escucha\" lo que dijiste."
        },
        {
          title: "Streaming en Tiempo Real",
          description: "En plataformas que lo soportan (Discord, Slack), las respuestas se envían parcialmente en tiempo real, no de golpe al final."
        },
        {
          title: "Seguridad y Controles",
          description: "Aprobación de comandos peligrosos, emparejamiento por DM, aislamiento en contenedor, y permisos granulares por plataforma."
        },
        {
          title: "Arquitectura Extensible",
          description: "Cada plataforma tiene su adaptador bajo gateway/platforms/. Nuevas plataformas se agregan sin tocar el core del agente."
        }
      ],
      techDetails: [
        {
          title: "Arquitectura del Gateway",
          content: "El gateway es un proceso Python único (gateway/run.py) que usa asyncio para manejar múltiples conexiones WebSocket/long-polling concurrentes. Cada plataforma tiene un adapter que implementa la interfaz BaseAdapter con métodos connect(), disconnect(), send(), y manejadores de eventos específicos de la plataforma."
        },
        {
          title: "Sistema de Sesiones Unificado",
          content: "Todas las plataformas comparten el mismo SessionDB (SQLite con FTS5). Cada conversación tiene un session_id único que persiste cross-platform. El agente mantiene el contexto completo gracias a este sistema unificado — no hay duplicación de estado por canal."
        },
        {
          title: "Delivery y Routing",
          content: "Los mensajes se enrutan al agente activo mediante un sistema de colas por sesión. El gateway trackea active_sessions y encola mensajes entrantes en _pending_messages cuando el agente está ocupado. Control verbs (/stop, /new, /approve) bypassean ambas colas para respuesta inmediata."
        }
      ]
    },
    learningMemory: {
      title: "Bucle de Aprendizaje Cerrado & Memoria Persistente",
      subtitle: "El único agente que aprende de verdad — crea skills, se auto-mejora y construye un modelo de ti",
      description: "Hermes es el único agente con un bucle de aprendizaje integrado que funciona sin supervisión. Tras tareas complejas, detecta patrones y genera habilidades automáticas — scripts reutilizables, knowledge que agrega a su base, y prompts especializados.",
      badge: "Aprendizaje Automático",
      featuresTitle: "Capacidades Principales",
      featuresDesc: "El bucle de aprendizaje que hace a Hermes único",
      providersTitle: "Proveedores de Memoria Disponibles",
      providersDesc: "Elige el backend de memoria que mejor se adapte a tus necesidades",
      techTitle: "Arquitectura Técnica",
      techDesc: "Cómo funciona el aprendizaje y la memoria bajo el capó",
      features: [
        {
          title: "Creación Automática de Habilidades",
          description: "Tras tareas complejas, el agente detecta patrones y genera habilidades automáticas — scripts reutilizables, knowledge que agrega a su base, y prompts especializados. Para verlas: /skills."
        },
        {
          title: "Auto-mejora Continua",
          description: "Las habilidades no son estáticas. Durante el uso, el agente identifica mejoras, optimiza prompts, y refina sus respuestas. Cada sesión es una iteración más."
        },
        {
          title: "Memoria Persistente Curada",
          description: "Información relevante se guarda en bases de datos (SQLite con FTS5) y en memorias semi-estructuradas. El agente construye un modelo cada vez más profundo de quién eres."
        },
        {
          title: "Búsqueda FTS5 de Sesiones",
          description: "Busca en conversaciones pasadas con consultas booleanas, frases exactas, y wildcards. El agente puede recuperar contexto de sesiones antiguas automáticamente."
        },
        {
          title: "Compresión de Contexto Inteligente",
          description: "Cuando el contexto se vuelve muy largo, el agente puede comprimirlo manteniendo lo relevante — sin perder información importante."
        },
        {
          title: "Modelado de Usuario Dialéctico (Honcho)",
          description: "Compatible con Honcho para modelado de usuario avanzado. El agente no solo recuerda hechos — construye un modelo dialéctico de tus preferencias, estilo de trabajo y patrones."
        }
      ],
      memoryProviders: [
        {
          name: "Honcho (Built-in)",
          description: "Modelado dialéctico de usuario — el agente construye un modelo profundo de quién eres a través de diálogo estructurado.",
          features: ["Modelado de usuario", "Memoria semántica", "Recuerdos episódicos", "Inferencia de preferencias"]
        },
        {
          name: "mem0",
          description: "Memoria a largo plazo con recuperación semántica y grafo de conocimiento.",
          features: ["Grafo de conocimiento", "Recuperación semántica", "Memoria jerárquica", "API REST"]
        },
        {
          name: "supermemory",
          description: "Memoria persistente con búsqueda vectorial y organización automática.",
          features: ["Búsqueda vectorial", "Organización automática", "Contexto cruzado", "Escalable"]
        },
        {
          name: "byterover",
          description: "Memoria ligera optimizada para agentes de código con enfoque en patrones de desarrollo.",
          features: ["Patrones de código", "Contexto de desarrollo", "Ligero", "Rápido"]
        },
        {
          name: "hindsight",
          description: "Memoria retrospectiva que aprende de errores y éxitos pasados.",
          features: ["Aprendizaje de errores", "Retrospectiva", "Mejora continua", "Contexto histórico"]
        },
        {
          name: "holographic",
          description: "Memoria holográfica con codificación distribuida y recuperación asociativa.",
          features: ["Codificación distribuida", "Recuperación asociativa", "Resistente a ruido", "Alta capacidad"]
        }
      ],
      techDetails: [
        {
          title: "Skill Curator - Sistema de Mantenimiento Automático",
          content: "El curator (agent/curator.py) es un sistema en segundo plano que rastrea el uso de habilidades creadas por el agente (created_by: \"agent\"). Métricas: use_count, view_count, patch_count, last_activity_at. Transiciones automáticas: active → stale (después de curator.stale_after_days días sin uso) → archived (después de curator.archive_after_days). Skills archivados van a ~/.hermes/skills/.archive/ y son restaurables. Skills pincelados (pinned) son inmunes a todas las transiciones automáticas y al pase de revisión LLM."
        },
        {
          title: "SessionDB con FTS5",
          content: "La base de datos de sesiones (hermes_state.py) usa SQLite con extensión FTS5 para búsqueda full-text. Cada sesión tiene: id único, título auto-generado, historial completo de mensajes (role: user/assistant/system/tool), metadata (modelo, tokens, herramientas usadas). FTS5 permite consultas booleanas, frases exactas (\"comillas\"), wildcards (*), y ranking por relevancia. El agente usa session_search tool para recuperar contexto relevante de sesiones pasadas."
        },
        {
          title: "Compresión de Contexto",
          content: "Cuando el contexto excede el límite (configurable via compression.max_tokens), el agente invoca compresión: resume segmentos antiguos manteniendo decisiones clave, preferencias del usuario, y estado actual del task. La compresión usa un modelo auxiliar (auxiliary.compression) separado del modelo principal para no consumir tokens del contexto principal. Resultado: contexto comprimido + mensajes recientes intactos."
        },
        {
          title: "Integración agentskills.io",
          content: "Hermes es compatible con el estándar abierto agentskills.io. Las habilidades exportadas incluyen metadatos estandarizados: name, description, version, author, license, platforms, metadata.hermes.tags, category, related_skills, config. Esto permite compartir skills entre agentes Hermes y otros frameworks compatibles. El Skills Hub (agentskills.io) sirve como registro centralizado."
        }
      ]
    },
    desktopTerminal: {
      title: "App de Escritorio & Terminal Real",
      subtitle: "Hermes Desktop — Electron + React con terminal integrado, chat en vivo, y bots con personalidad",
      description: "Hermes Desktop es una app Electron completa que trae toda la potencia del agente a tu escritorio. Terminal real (no un widget), chat persistente, slash commands, pickers de sesión, y un modo Bots único donde cada agente es un perfil completo con su propia personalidad, memoria y herramientas.",
      badge: "App de Escritorio Nativa",
      featuresTitle: "Características Principales",
      featuresDesc: "Todo lo que necesitas en tu escritorio",
      deepTitle: "Arquitectura en Profundidad",
      deepDesc: "Detalles técnicos de la app de escritorio y terminal",
      techTitle: "Detalles de Implementación",
      techDesc: "Cómo funciona todo bajo el capó",
      backendsTitle: "Backends de Terminal Disponibles",
      backendsDesc: "Elige el entorno de ejecución que necesitas",
      tabArchitecture: "Arquitectura",
      tabTerminal: "Terminal PTY",
      tabBots: "Modo Bots",
      tabWeb: "Dashboard Web",
      features: [
        {
          title: "Terminal Real Integrado",
          description: "No es un widget — es un terminal PTY real (xterm.js + WebGL) que corre en el proceso backend. Ejecuta comandos, scripts, y herramientas mientras chateas. Streaming de output en tiempo real."
        },
        {
          title: "Chat Persistente con Streaming",
          description: "Composer rico con autocompletado de slash commands, streaming de respuestas token-by-token, historial de conversaciones con búsqueda, y reanudación de sesiones desde cualquier punto."
        },
        {
          title: "Modo Bots - Agentes con Personalidad",
          description: "Cada bot es un perfil completo de Hermes: su propio config.yaml, memoria, skills, SOUL.md, modelo, y chat canónico (Bot Chat). Los bots se @mencionan entre sí para delegar trabajo cross-bot."
        },
        {
          title: "6 Backends de Terminal",
          description: "Local, Docker, SSH, Singularity, Modal, Daytona. Modal y Daytona ofrecen persistencia serverless — el entorno hiberna cuando idle y despierta bajo demanda, costando casi nada entre sesiones."
        },
        {
          title: "Picker de Sesiones Visual",
          description: "Navegador visual de sesiones con preview, búsqueda, filtros por origen (chat/automation), y reanudación one-click. Sesiones canónicas de bots ocultas del sidebar global por diseño."
        },
        {
          title: "Aprobación Visual de Comandos",
          description: "Microcontroller de aprobación para comandos peligrosos — UI nativa que muestra el comando, working directory, y riesgos antes de ejecutar. Configurable por toolset y perfil."
        }
      ],
      desktopFeatures: [
        {
          title: "Arquitectura Electron + tui_gateway",
          description: "La app Electron (apps/desktop/) es un renderer React + nanostore que habla JSON-RPC con un backend tui_gateway (Python) vía WebSocket. El backend spawnea el agente y maneja herramientas, terminal, y sesión. El renderer es puramente UI — sin lógica de agente."
        },
        {
          title: "WebSocket JSON-RPC Transport",
          description: "Comunicación bidireccional: renderer → backend (prompt.submit, slash.exec, approval.respond, tool.start/progress/complete) y backend → renderer (message.delta/complete, tool.start/progress/complete, approval.request, session.list). Protocolo simple, tipado, extensible."
        },
        {
          title: "Terminal PTY Real (xterm.js + WebGL)",
          description: "El terminal usa xterm.js con renderizador WebGL (@xterm/addon-webgl), addon-fit para resize automático, y unicode11 para caracteres anchos modernos. Backend usa ptyprocess (POSIX) — WSL funciona, Windows nativo no (usa el shim). Frames: bytes PTY crudos bidireccionales."
        },
        {
          title: "Persistencia Serverless (Modal/Daytona)",
          description: "Modal y Daytona: entornos cloud con persistencia. El entorno hiberna cuando está inactivo (costo ~$0) y despierta en segundos bajo demanda. Ideal para agentes que corren tareas periódicas (cron) o bajo demanda sin mantener infraestructura 24/7."
        },
        {
          title: "Perfiles Completamente Aislados",
          description: "Cada perfil (incluyendo bots) tiene su propio HERMES_HOME: config.yaml, .env, memoria, sesiones, skills, skins, logs, cron. _apply_profile_override() setea HERMES_HOME antes de imports. get_hermes_home() para código, display_hermes_home() para UI. Cero leakage entre perfiles."
        },
        {
          title: "Dashboard Web Embebido (hermes dashboard)",
          description: "hermes dashboard sirve el mismo tui_gateway + SPA React. El chat web embebe el real hermes --tui vía PTY WebSocket (/api/pty?token=...). No es una reimplementación — es el TUI real en el navegador. xterm.js WebGL, fit, unicode11. Auth vía _SESSION_TOKEN efímero en query param."
        }
      ],
      techDetails: [
        {
          title: "Apps/desktop Architecture",
          content: "apps/desktop/src/ — renderer React 19 + nanostore (@assistant-ui/react para chat UI). apps/shared/ — @hermes/shared package con JsonRpcGatewayClient + WS URL helpers (compartido con web dashboard). electron/main.ts — main process, spawnea backend via hermes serve (headless). electron/backend-command.ts — detecta si runtime soporta 'serve' subcommand, fallback a 'dashboard --no-open' para compatibilidad. No hay dependencia build-time del dashboard web."
        },
        {
          title: "tui_gateway Server",
          content: "tui_gateway/server.py — JSON-RPC sobre stdio (para Ink TUI) y WebSocket (para Electron/Web). Métodos: prompt.submit, slash.exec, command.dispatch, session.list/resume, tool.start/progress/complete, approval.request/respond, complete.slash, commands.catalog. Eventos: message.delta/complete, tool.start/progress/complete, approval.request, session.updated. Slash worker persistente (_SlashWorker subprocess) para comandos lentos."
        },
        {
          title: "Bot Mode - Invariant: One Bot = One Canonical Chat",
          content: "Diseño inmutable: Un bot = UN chat canónico para siempre, identificado por NOMBRE. La chat's única identidad es (perfil, sesión titulada exactamente 'Bot Chat') — UNIQUE(title) index en state DB hace que ese par sea un registro exacto de máximo una fila. Lifecycle al click en bot row: 1) Resolve registry SIEMPRE — busca sesión 'Bot Chat' del perfil por título exacto via session.list {title, include_hidden: true}. Existe → ábrela. 2) No existe → créala, titulada 'Bot Chat', nascidad hidden, con intro del bot. Adopt-before-mint: re-ejecuta lookup primero, así row concurrente/pre-existente se abre, nunca se forkea. NO hay session-id pin. Name-as-identity elimina la clase de fallo: un nombre no puede dangling, y un pointer histórico corrupto simplemente nunca se lee."
        },
        {
          title: "Cross-Platform PTY (Web Dashboard)",
          content: "hermes dashboard → /chat embedde hermes --tui real. Browser carga web/src/pages/ChatPage.tsx → xterm.js Terminal con WebGL renderer, @xterm/addon-fit (resize container-driven), @xterm/addon-unicode11. /api/pty?token=... upgrade a WebSocket; auth usa mismo _SESSION_TOKEN efímero que REST, via query param (browsers no pueden set Authorization en WS upgrade). Server spawnea lo que hermes --tui spawnearía, via ptyprocess (POSIX PTY — WSL works, native Windows no). Frames: raw PTY bytes each direction; resize via \\x1b[RESIZE:<cols>;<rows>] interceptado en server y aplicado con TIOCSWINSZ."
        }
      ]
    }
  },

  status: {
    actionFailed: "Acción fallida",
    actionFinished: "Finalizado",
    actions: "Acciones",
    agent: "Agente",
    activeSessions: "Sesiones activas",
    connected: "Conectado",
    connectedPlatforms: "Plataformas conectadas",
    disconnected: "Desconectado",
    error: "Error",
    failed: "Fallido",
    gateway: "Gateway",
    gatewayFailedToStart: "El Gateway no pudo iniciarse",
    lastUpdate: "Última actualización",
    noneRunning: "Ninguno",
    notRunning: "No en ejecución",
    pid: "PID",
    platformDisconnected: "desconectado",
    platformError: "error",
    recentSessions: "Sesiones recientes",
    restartGateway: "Reiniciar Gateway",
    restartingGateway: "Reiniciando gateway…",
    running: "En ejecución",
    runningRemote: "En ejecución (remoto)",
    startFailed: "Inicio fallido",
    starting: "Iniciando",
    startedInBackground: "Iniciado en segundo plano — revisa los registros para ver el progreso",
    stopped: "Detenido",
    updateHermes: "Actualizar Hermes",
    updatingHermes: "Actualizando Hermes…",
    waitingForOutput: "Esperando salida…",
  },

  sessions: {
    title: "Sesiones",
    history: "Historial",
    overview: "Resumen",
    filterChats: "Chats",
    filterAutomation: "Automatización",
    filterAll: "Todas",
    sourceFilter: "Origen de la sesión",
    anySource: "Cualquier origen",
    searchPlaceholder: "Buscar contenido de mensajes...",
    noSessions: "Aún no hay sesiones",
    noSessionsInFilter: "No hay sesiones en este filtro",
    noMatch: "Ninguna sesión coincide con tu búsqueda",
    startConversation: "Inicia una conversación para verla aquí",
    noMessages: "Sin mensajes",
    untitledSession: "Sesión sin título",
    deleteSession: "Eliminar sesión",
    confirmDeleteTitle: "¿Eliminar sesión?",
    confirmDeleteMessage:
      "Esto elimina permanentemente la conversación y todos sus mensajes. No se puede deshacer.",
    sessionDeleted: "Sesión eliminada",
    failedToDelete: "No se pudo eliminar la sesión",
    deleteEmpty: "Eliminar vacías",
    deleteEmptyConfirmTitle: "¿Eliminar sesiones vacías?",
    deleteEmptyConfirmMessage:
      "Esto elimina permanentemente {count} sesiones que no tienen mensajes. Se omiten las sesiones activas y archivadas. Esta acción no se puede deshacer.",
    emptySessionsDeleted: "{count} sesiones vacías eliminadas",
    failedToDeleteEmpty: "No se pudieron eliminar las sesiones vacías",
    selectSession: "Seleccionar sesión",
    selectAllOnPage: "Seleccionar todas en esta página",
    clearSelection: "Limpiar selección",
    selectedCount: "{count} seleccionadas",
    deleteSelected: "Eliminar {count}",
    deleteSelectedConfirmTitle: "¿Eliminar {count} sesiones?",
    deleteSelectedConfirmMessage:
      "Esto elimina permanentemente {count} sesiones seleccionadas y todos sus mensajes. No se puede deshacer.",
    selectedSessionsDeleted: "{count} sesiones eliminadas",
    failedToDeleteSelected: "No se pudieron eliminar las sesiones seleccionadas",
    resumeInChat: "Reanudar en el chat",
    newChat: "Nuevo chat",
    previousPage: "Página anterior",
    nextPage: "Página siguiente",
    roles: {
      user: "Usuario",
      assistant: "Asistente",
      system: "Sistema",
      tool: "Herramienta",
    },
  },

  analytics: {
    period: "Período:",
    totalTokens: "Tokens totales",
    totalSessions: "Sesiones totales",
    apiCalls: "Llamadas API",
    dailyTokenUsage: "Uso diario de tokens",
    dailyBreakdown: "Desglose diario",
    perModelBreakdown: "Desglose por modelo",
    topSkills: "Habilidades principales",
    skill: "Habilidad",
    loads: "Agente cargó",
    edits: "Agente gestionó",
    lastUsed: "Último uso",
    input: "Entrada",
    output: "Salida",
    total: "Total",
    noUsageData: "No hay datos de uso para este período",
    startSession: "Inicia una sesión para ver analíticas aquí",
    date: "Fecha",
    model: "Modelo",
    tokens: "Tokens",
    perDayAvg: "/día prom.",
    acrossModels: "en {count} modelos",
    inOut: "{input} entrada / {output} salida",
  },

  models: {
    modelsUsed: "Modelos utilizados",
    estimatedCost: "Coste est.",
    tokens: "tokens",
    sessions: "sesiones",
    avgPerSession: "prom./sesión",
    apiCalls: "llamadas API",
    toolCalls: "llamadas de herramientas",
    noModelsData: "No hay datos de uso de modelos para este período",
    startSession: "Inicia una sesión para ver datos de modelos aquí",
  },

  logs: {
    title: "Registros",
    autoRefresh: "Actualización automática",
    file: "Archivo",
    level: "Nivel",
    component: "Componente",
    lines: "Líneas",
    noLogLines: "No se encontraron líneas de registro",
  },

  cron: {
    confirmDeleteMessage:
      "Esto elimina la tarea de la programación. No se puede deshacer.",
    confirmDeleteTitle: "¿Eliminar tarea programada?",
    newJob: "Nueva tarea Cron",
    nameOptional: "Nombre (opcional)",
    namePlaceholder: "p. ej. Resumen diario",
    prompt: "Prompt",
    promptPlaceholder: "¿Qué debe hacer el agente en cada ejecución?",
    schedule: "Programación (expresión cron)",
    schedulePlaceholder: "0 9 * * *",
    scheduleMode: "Programación",
    scheduleModes: {
      interval: "Cada intervalo",
      daily: "Diariamente",
      weekly: "Semanalmente",
      monthly: "Mensualmente",
      once: "Una vez",
      custom: "Personalizado (expresión cron)",
      intervalEvery: "Cada",
      intervalUnit: "Unidad",
      unitMinutes: "minutos",
      unitHours: "horas",
      unitDays: "días",
      timeOfDay: "Hora del día",
      weekdays: "Días de la semana",
      weekdaysShort: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
      dayOfMonth: "Día del mes",
      onceAt: "Ejecutar el",
      customLabel: "Expresión cron",
      customPlaceholder: "0 9 * * *",
      customHint:
        "Expresión cron de cinco campos (minuto, hora, día, mes, día de la semana).",
      preview: "Se envía como",
      previewEmpty: "(incompleta)",
    },
    scheduleDescribe: {
      none: "—",
      everyMinutes: "Cada {n} min",
      everyHours: "Cada {n} h",
      everyDays: "Cada {n} d",
      dailyAt: "Diariamente a las {time}",
      weeklyAt: "Semanalmente los {days} a las {time}",
      monthlyAt: "Mensualmente el {day} a las {time}",
      onceAt: "Una vez el {time}",
    },
    deliverTo: "Entregar a",
    scheduledJobs: "Tareas programadas",
    noJobs: "No hay tareas cron configuradas. Crea una arriba.",
    last: "Última",
    next: "Próxima",
    pause: "Pausar",
    resume: "Reanudar",
    triggerNow: "Ejecutar ahora",
    delivery: {
      local: "Local",
      telegram: "Telegram",
      discord: "Discord",
      slack: "Slack",
      email: "Email",
    },
  },

  profiles: {
    newProfile: "Nuevo perfil",
    name: "Nombre",
    namePlaceholder: "p. ej. coder, writer, etc.",
    nameRequired: "El nombre es obligatorio",
    nameRule:
      "Solo letras minúsculas, dígitos, _ y -; debe comenzar con una letra o dígito; hasta 64 caracteres.",
    invalidName: "Nombre de perfil no válido",
    cloneFrom: "Clonar desde el perfil",
    cloneFromNone: "Ninguno (vacío)",
    allProfiles: "Perfiles",
    noProfiles: "No se encontraron perfiles.",
    defaultBadge: "predeterminado",
    hasEnv: "env",
    model: "Modelo",
    skills: "Habilidades",
    rename: "Renombrar",
    editSoul: "Editar SOUL.md",
    soulSection: "SOUL.md (personalidad / prompt del sistema)",
    soulPlaceholder: "# Cómo debe comportarse este agente…",
    saveSoul: "Guardar SOUL",
    soulSaved: "SOUL.md guardado",
    openInTerminal: "Copiar comando CLI",
    commandCopied: "Copiado al portapapeles",
    copyFailed: "No se pudo copiar",
    confirmDeleteTitle: "¿Eliminar perfil?",
    confirmDeleteMessage:
      "Esto elimina permanentemente el perfil '{name}' — configuración, claves, memorias, sesiones, habilidades, tareas cron. No se puede deshacer.",
    created: "Creado",
    deleted: "Eliminado",
    renamed: "Renombrado",
  },

  pluginsPage: {
    contextEngineLabel: "Motor de contexto",
    dashboardSlots: "Slots del panel",
    disableRuntime: "Deshabilitar",
    enableAfterInstall: "Habilitar tras instalar",
    enableRuntime: "Habilitar",
    forceReinstall: "Forzar reinstalación (eliminar carpeta existente primero)",
    headline:
      "Descubre, instala, habilita y actualiza complementos de Hermes (equivalente a `hermes plugins`).",
    identifierLabel: "URL de Git u owner/repo",
    inactive: "inactivo",
    installBtn: "Instalar",
    installHeading: "Instalar desde GitHub / URL de Git",
    installHint: "Usa la forma corta owner/repo o una URL de clonación https:// o git@ completa.",
    memoryProviderLabel: "Proveedor de memoria",
    missingEnvWarn: "Configura estos en Claves antes de que el complemento pueda ejecutarse:",
    noDashboardTab: "Sin pestaña de panel",
    openTab: "Abrir",
    orphanHeading: "Extensiones solo del panel (sin coincidencia de plugin.yaml del agente)",
    pluginListHeading: "Complementos instalados",
    providerDefaults: "incorporado / predeterminado",
    providersHeading: "Complementos de proveedor en tiempo de ejecución",
    providersHint:
      "Escribe memory.provider (vacío = incorporado) y context.engine en config.yaml. Surte efecto en la próxima sesión.",
    refreshDashboard: "Volver a escanear extensiones del panel",
    removeConfirm: "¿Eliminar este complemento de ~/.hermes/plugins/?",
    removeHint: "Solo se pueden eliminar complementos instalados por el usuario en ~/.hermes/plugins.",
    rescanHeading: "Registro de complementos SPA",
    rescanHint: "Vuelve a escanear tras añadir archivos en disco para que la barra lateral del panel detecte nuevos manifiestos.",
    runtimeHeading: "Tiempo de ejecución del Gateway (complementos YAML)",
    saveProviders: "Guardar configuración del proveedor",
    savedProviders: "Configuración del proveedor guardada.",
    sourceBadge: "Fuente",
    authRequired: "Autenticación requerida",
    authRequiredHint: "Ejecuta este comando para autenticarte:",
    updateGit: "Git pull",
    versionBadge: "Versión",
    showInSidebar: "Mostrar en barra lateral",
    hideFromSidebar: "Ocultar de la barra lateral",
  },

  skills: {
    title: "Habilidades",
    searchPlaceholder: "Buscar habilidades y conjuntos de herramientas...",
    enabledOf: "{enabled}/{total} habilitados",
    all: "Todas",
    categories: "Categorías",
    filters: "Filtros",
    noSkills: "No se encontraron habilidades. Las habilidades se cargan desde ~/.hermes/skills/",
    noSkillsMatch: "Ninguna habilidad coincide con tu búsqueda o filtro.",
    skillCount: "{count} habilidad{s}",
    resultCount: "{count} resultado{s}",
    noDescription: "No hay descripción disponible.",
    toolsets: "Conjuntos de herramientas",
    toolsetLabel: "conjunto de herramientas {name}",
    noToolsetsMatch: "Ningún conjunto de herramientas coincide con la búsqueda.",
    setupNeeded: "Configuración necesaria",
    disabledForCli: "Deshabilitado para CLI",
    more: "+{count} más",
  },

  config: {
    configPath: "~/.hermes/config.yaml",
    filters: "Filtros",
    sections: "Secciones",
    exportConfig: "Exportar configuración como JSON",
    importConfig: "Importar configuración desde JSON",
    resetDefaults: "Restablecer valores predeterminados",
    resetScopeTooltip: "Restablecer {scope} a los valores predeterminados",
    confirmResetScope: "¿Restablecer todos los ajustes de {scope} a sus valores predeterminados? Esto solo actualiza el formulario — los cambios no se escriben en config.yaml hasta que pulses Guardar.",
    resetScopeToast: "{scope} restablecido a los valores predeterminados — revisa y guarda para que persista",
    rawYaml: "Configuración YAML en bruto",
    searchResults: "Resultados de búsqueda",
    fields: "campo{s}",
    noFieldsMatch: 'Ningún campo coincide con "{query}"',
    configSaved: "Configuración guardada",
    yamlConfigSaved: "Configuración YAML guardada",
    failedToSave: "No se pudo guardar",
    failedToSaveYaml: "No se pudo guardar YAML",
    failedToLoadRaw: "No se pudo cargar la configuración en bruto",
    configImported: "Configuración importada — revisa y guarda",
    invalidJson: "Archivo JSON no válido",
    categories: {
      general: "General",
      agent: "Agente",
      terminal: "Terminal",
      display: "Pantalla",
      delegation: "Delegación",
      memory: "Memoria",
      compression: "Compresión",
      security: "Seguridad",
      browser: "Navegador",
      voice: "Voz",
      tts: "Texto a voz",
      stt: "Voz a texto",
      logging: "Registro",
      discord: "Discord",
      auxiliary: "Auxiliar",
    },
  },

  env: {
    changesNote: "Los cambios se guardan en disco inmediatamente. Las sesiones activas adoptan las nuevas claves automáticamente.",
    confirmClearMessage:
      "El valor almacenado para esta variable se eliminará de tu archivo .env. Esto no se puede deshacer desde la UI.",
    confirmClearTitle: "¿Limpiar esta clave?",
    description: "Gestiona claves API y secretos almacenados en",
    hideAdvanced: "Ocultar avanzado",
    showAdvanced: "Mostrar avanzado",
    showLess: "Mostrar menos",
    showMore: "Mostrar más",
    llmProviders: "Proveedores LLM",
    providersConfigured: "{configured} de {total} proveedores configurados",
    getKey: "Obtener clave",
    notConfigured: "{count} no configurados",
    notSet: "No establecido",
    keysCount: "{count} clave{s}",
    enterValue: "Introduce un valor...",
    replaceCurrentValue: "Reemplazar valor actual ({preview})",
    showValue: "Mostrar valor real",
    hideValue: "Ocultar valor",
    customTitle: "Claves personalizadas",
    customHint: "Variables de entorno arbitrarias almacenadas en tu .env que Hermes no reconoce. Úsalas para inyectar variables de entorno para skills, servidores MCP o tus propias herramientas.",
    customConfigured: "{count} clave(s) personalizada(s) configurada(s)",
    addCustomKey: "Añadir una clave personalizada",
    customKeyName: "Nombre de la variable",
    customKeyNamePlaceholder: "p. ej. MY_SERVICE_API_KEY",
    add: "Añadir",
    invalidKeyName: "Usa solo letras, números y guiones bajos (debe empezar por una letra o un guion bajo).",
  },

  oauth: {
    title: "Inicios de sesión de proveedores (OAuth)",
    providerLogins: "Inicios de sesión de proveedores (OAuth)",
    description:
      "{connected} de {total} proveedores OAuth conectados. Usa Iniciar sesión para los flujos compatibles con el panel; los comandos CLI siguen disponibles para configuración externa o de respaldo.",
    connected: "Conectado",
    expired: "Caducado",
    notConnected: "No conectado. Usa Iniciar sesión si está disponible, o ejecuta {command} en una terminal.",
    runInTerminal: "en una terminal.",
    noProviders: "No se han detectado proveedores compatibles con OAuth.",
    login: "Iniciar sesión",
    disconnect: "Desconectar",
    managedExternally: "Gestionado externamente",
    copied: "Copiado ✓",
    copyCode: "Copiar código",
    copyFailed: "No se pudo copiar automáticamente. Selecciona el código y cópialo manualmente.",
    cli: "Copiar",
    copyCliCommand: "Copiar comando CLI (para externo / alternativa)",
    connect: "Conectar",
    sessionExpires: "La sesión caduca en {time}",
    initiatingLogin: "Iniciando flujo de inicio de sesión…",
    exchangingCode: "Intercambiando código por tokens…",
    connectedClosing: "¡Conectado! Cerrando…",
    loginFailed: "Inicio de sesión fallido.",
    sessionExpired: "Sesión caducada. Haz clic en Reintentar para iniciar un nuevo inicio de sesión.",
    reOpenAuth: "Reabrir página de autenticación",
    reOpenVerification: "Reabrir página de verificación",
    submitCode: "Enviar código",
    pasteCode: "Pega el código de autorización (con el sufijo #state está bien)",
    waitingAuth: "Esperando que autorices en el navegador…",
    enterCodePrompt: "Se abrió una nueva pestaña. Introduce este código si se solicita:",
    pkceStep1: "Se abrió una nueva pestaña en claude.ai. Inicia sesión y haz clic en Autorizar.",
    pkceStep2: "Copia el código de autorización mostrado tras autorizar.",
    pkceStep3: "Pégalo abajo y envía.",
    flowLabels: {
      pkce: "Inicio de sesión por navegador (PKCE)",
      device_code: "Código de dispositivo",
      external: "CLI externa",
    },
    expiresIn: "caduca en {time}",
  },

  language: {
    switchTo: "Cambiar idioma",
  },

  theme: {
    title: "Tema",
    switchTheme: "Cambiar tema",
  },
  achievements: {
    hero: {
      kicker: "Agentic Gamerscore",
      title: "Hermes Achievements",
      subtitle:
        "Insignias coleccionables de Hermes ganadas a partir del historial real de sesiones. Los logros conocidos no completados se muestran como Descubiertos; los logros secretos permanecen ocultos hasta que aparece el primer comportamiento coincidente.",
      scan_subtitle:
        "Escaneando el historial de sesiones de Hermes. El primer escaneo puede tardar 5–10 segundos en historiales grandes.",
    },
    actions: {
      rescan: "Volver a escanear",
    },
    stats: {
      unlocked: "Desbloqueados",
      unlocked_hint: "insignias ganadas",
      discovered: "Descubiertos",
      discovered_hint: "conocidos, aún no ganados",
      secrets: "Secretos",
      secrets_hint: "ocultos hasta la primera señal",
      highest_tier: "Nivel más alto",
      highest_tier_hint: "Copper → Silver → Gold → Diamond → Olympian",
      latest: "Más reciente",
      latest_hint_empty: "usa Hermes más",
      none_yet: "Ninguno aún",
    },
    state: {
      unlocked: "Desbloqueado",
      discovered: "Descubierto",
      secret: "Secreto",
    },
    tier: {
      target: "Objetivo {tier}",
      hidden: "Oculto",
      complete: "Completo",
      objective: "Objetivo",
    },
    progress: {
      hidden: "oculto",
    },
    scan: {
      building_headline: "Construyendo perfil de logros…",
      building_detail:
        "Leyendo sesiones, llamadas a herramientas, metadatos del modelo y estado de desbloqueo.",
      starting_headline: "Iniciando escaneo de logros…",
      progress_detail:
        "Escaneadas {scanned} de {total} sesiones · {pct}%. Las insignias se desbloquean a medida que se procesa más historial.",
      idle_detail:
        "Leyendo sesiones, llamadas a herramientas, metadatos del modelo y estado de desbloqueo. Las insignias aparecerán aquí a medida que se desbloqueen.",
    },
    guide: {
      tiers_header: "Niveles",
      secret_header: "Logros secretos",
      secret_body:
        "Los secretos ocultan su disparador exacto. Una vez que Hermes detecta una señal relacionada, la tarjeta pasa a Descubierto y muestra su requisito.",
      scan_status_header: "Estado del escaneo",
      scan_status_body:
        "Hermes está escaneando el historial local una vez, después las tarjetas aparecerán automáticamente. No hay nada bloqueado si tarda unos segundos.",
      what_scanned_header: "Qué se escanea",
      what_scanned_body:
        "Sesiones, llamadas a herramientas, metadatos del modelo, errores, logros y estado de desbloqueo local.",
    },
    card: {
      share_title: "Compartir este logro",
      share_label: "Compartir {name}",
      share_text: "Compartir",
      how_to_reveal: "Cómo revelarlo",
      what_counts: "Qué cuenta",
      evidence_label: "Evidencia",
      evidence_session_fallback: "sesión",
      no_evidence: "Aún sin evidencia",
    },
    latest: {
      header: "Desbloqueos recientes",
    },
    empty: {
      no_secrets_header: "No quedan secretos ocultos en este escaneo.",
      no_secrets_body:
        "Pista: los secretos suelen comenzar a partir de fallos inusuales o patrones de usuario avanzado: conflictos de puertos, muros de permisos, variables de entorno faltantes, errores de YAML, colisiones de Docker, uso de rollback/checkpoint, aciertos de caché o pequeñas correcciones tras mucho texto rojo.",
    },
    filters: {
      all_categories: "Todos",
      visibility_all: "todos",
      visibility_unlocked: "desbloqueados",
      visibility_discovered: "descubiertos",
      visibility_secret: "secretos",
    },
    share: {
      dialog_label: "Compartir logro",
      header: "Compartir: {name}",
      close: "Cerrar",
      rendering: "Renderizando…",
      card_alt: "Tarjeta para compartir de {name}",
      error_generic: "Algo salió mal.",
      x_title: "Abre X con una publicación predefinida",
      x_button: "Compartir en X",
      copy_title: "Copia la imagen para pegarla en tu publicación",
      copy_button: "Copiar imagen",
      copied: "Copiado ✓",
      download_button: "Descargar PNG",
      hint:
        "Compartir en X abre una publicación predefinida en una nueva pestaña. Haz clic primero en Copiar imagen si quieres adjuntar la insignia 1200×630: X te permite pegarla directamente en el redactor del tuit. Descargar PNG guarda el archivo para usarlo en cualquier lugar.",
      clipboard_unsupported:
        "Este navegador no admite copiar imágenes al portapapeles: usa Descargar en su lugar.",
      tweet_text: "Just unlocked {tier_part}\"{name}\" in Hermes Agent ☤",
    },
  },
  kanban: {
    loading: "Cargando tablero Kanban…",
    loadFailed: "Error al cargar el tablero Kanban: ",
    loadFailedHint:
      "El backend crea automáticamente kanban.db en la primera lectura. Si el problema persiste, revisa los registros del panel.",
    board: "Tablero",
    newBoard: "+ Nuevo tablero",
    newBoardTitle: "Nuevo tablero",
    newBoardDescription:
      "Los tableros te permiten separar flujos de trabajo no relacionados — uno por proyecto, repositorio o dominio. Los workers de un tablero nunca ven las tareas de otro.",
    slug: "Slug",
    slugHint: "— minúsculas, guiones, p. ej. atm10-server",
    confirmDoneMany:
      "Mark {n} tasks as done? The workers' claims are released and dependent children become ready.",
    confirmArchiveMany:
      "Archive {n} tasks? They disappear from the default board view.",
    confirmBlockedMany:
      "Mark {n} tasks as blocked? The workers' claims are released.",
    displayName: "Nombre visible",
    displayNameHint: "(opcional)",
    description: "Descripción",
    descriptionHint: "(opcional)",
    icon: "Icono",
    iconHint: "(un solo carácter o emoji)",
    switchAfterCreate: "Cambiar a este tablero tras crearlo",
    cancel: "Cancelar",
    creating: "Creando…",
    createBoard: "Crear tablero",
    search: "Buscar",
    filterCards: "Filtrar tarjetas…",
    tenant: "Tenant",
    allTenants: "Todos los tenants",
    assignee: "Asignado a",
    allProfiles: "Todos los perfiles",
    showArchived: "Mostrar archivados",
    lanesByProfile: "Carriles por perfil",
    nudgeDispatcher: "Avisar al dispatcher",
    refresh: "Actualizar",
    selected: "seleccionado(s)",
    complete: "Completar",
    archive: "Archivar",
    apply: "Aplicar",
    clear: "Limpiar",
    createTask: "Crear tarea en esta columna",
    noTasks: "— sin tareas —",
    unassigned: "sin asignar",
    untitled: "(sin título)",
    loadingDetail: "Cargando…",
    addComment: "Añadir un comentario… (Enter para enviar)",
    comment: "Comentario",
    status: "Estado",
    workspace: "Workspace",
    skills: "Habilidades",
    createdBy: "Creado por",
    result: "Result",
    comments: "Comentarios",
    events: "Eventos",
    runHistory: "Historial de ejecuciones",
    workerLog: "Registro del worker",
    loadingLog: "Cargando registro…",
    noWorkerLog:
      "— aún no hay registro del worker (la tarea no se ha lanzado o el registro fue rotado) —",
    noDescription: "— sin descripción —",
    noComments: "— sin comentarios —",
    edit: "editar",
    save: "Guardar",
    dependencies: "Dependencias",
    parents: "Padres:",
    children: "Hijos:",
    none: "ninguno",
    addParent: "— añadir padre —",
    addChild: "— añadir hijo —",
    removeDependency: "Eliminar dependencia",
    block: "Bloquear",
    unblock: "Desbloquear",
    notifyHomeChannels: "Notificar a los canales de inicio",
    diagnostics: "Diagnósticos",
    hide: "Ocultar",
    show: "Mostrar",
    attention: "Atención",
    tasksNeedAttention: "tareas requieren atención",
    taskNeedsAttention: "1 tarea requiere atención",
    diagnostic: "diagnóstico",
    open: "Abrir",
    close: "Cerrar (Esc)",
    reassignTo: "Reasignar a:",
    copied: "Copiado",
    copyCommand: "Copiar comando al portapapeles",
    reclaim: "Recuperar",
    reassign: "Reasignar",
    renderingError: "La pestaña Kanban tuvo un error de renderizado",
    reloadView: "Recargar vista",
    wsAuthFailed:
      "Error de autenticación de WebSocket — recarga la página para refrescar el token de sesión.",
    markDone: "¿Marcar {n} tarea(s) como hechas?",
    markArchived: "¿Archivar {n} tarea(s)?",
    warning: "Advertencia",
    phantomIds: "IDs fantasma:",
    active: "activo",
    ended: "finalizado",
    noProfile: "(sin perfil)",
    showAllAttempts: "Mostrar todos los intentos",
    sendingUpdates: "Enviando actualizaciones a",
    sendNotifications: "Enviar notificaciones de completed / blocked / gave_up a",
    archiveBoardConfirm:
      "¿Archivar el tablero '{name}'? Se moverá a boards/_archived/ para que puedas recuperarlo más tarde. Las tareas de este tablero ya no aparecerán en ninguna parte de la UI.",
    archiveBoardTitle: "Archivar este tablero",
    boardSwitcherHint: "Los tableros te permiten separar flujos de trabajo no relacionados",
    taskCreatedWarning: "Tarea creada, pero: ",
    moveFailed: "Error al mover: ",
    bulkFailed: "Lote: ",
    completionBlockedHallucination: "⚠ Completado bloqueado — IDs de tarjeta fantasma",
    suspectedHallucinatedReferences: "⚠ El texto referenció IDs de tarjeta fantasma",
    pickProfileFirst: "Elige primero un perfil.",
    unblockedMessage: "Desbloqueado {id}. La tarea está lista para el próximo tick.",
    unblockFailed: "Error al desbloquear: ",
    reclaimedMessage: "Recuperado {id}. La tarea vuelve a estar lista.",
    reclaimFailed: "Error al recuperar: ",
    reassignedMessage: "Reasignado {id} a {profile}.",
    reassignFailed: "Error al reasignar: ",
    selectForBulk: "Seleccionar para acciones por lotes",
    clickToEdit: "Haz clic para editar",
    clickToEditAssignee: "Haz clic para editar el asignado",
    emptyAssignee: "(vacío = sin asignar)",
    columnLabels: {
      triage: "Clasificación",
      todo: "Por hacer",
      scheduled: "Programado",
      ready: "Listo",
      running: "En curso",
      blocked: "Bloqueado",
      done: "Hecho",
      archived: "Archivado",
    },
    columnHelp: {
      triage: "Ideas en bruto — un specifier desarrollará la especificación",
      todo: "Esperando dependencias o sin asignar",
      scheduled: "Esperando un retraso conocido o un seguimiento programado",
      ready: "Dependencias satisfechas; asigna un perfil para despachar",
      running: "Reclamado por un worker — en ejecución",
      blocked: "El worker pidió intervención humana",
      done: "Completado",
      archived: "Archivado",
    },
    confirmDone:
      "¿Marcar esta tarea como hecha? Se libera el reclamo del worker y los hijos dependientes pasan a estar listos.",
    confirmArchive:
      "¿Archivar esta tarea? Desaparecerá de la vista por defecto del tablero.",
    confirmBlocked:
      "¿Marcar esta tarea como bloqueada? Se libera el reclamo del worker.",
    completionSummary:
      "Resumen de finalización para {label}. Se almacena como el result de la tarea.",
    completionSummaryRequired:
      "El resumen de finalización es obligatorio antes de marcar una tarea como hecha.",
    triagePlaceholder: "Idea aproximada — la IA la especificará…",
    taskTitlePlaceholder: "Título de la nueva tarea…",
    specifier: "specifier",
    assigneePlaceholder: "asignado",
    priority: "Prioridad",
    skillsPlaceholder:
      "habilidades (opcional, separadas por comas): translation, github-code-review",
    noParent: "— sin padre —",
workspacePathDir: "ruta del workspace (obligatoria, p. ej. ~/projects/my-app)",
      workspacePathOptional:
        "ruta del workspace (opcional, derivada del asignado si está vacía)",
      logTruncated: "(mostrando los últimos 100 KB — registro completo en ",
      logAt: ")",
    },

    dashboard: {
      welcomeBadge: "Panel de Hermes Agent",
      welcomeTitle: "Bienvenido a tu Centro de Control",
      welcomeDesc: "Gestiona tu agente, monitoriza sesiones, configura herramientas y explora los servicios principales.",
      startChatting: "Iniciar Chat",
      exploreServices: "Explorar Servicios",
      activeSessions: "Sesiones Activas",
      connectedPlatforms: "Plataformas",
      totalTools: "Herramientas",
      availableModels: "Modelos",
      viewSessions: "Ver Sesiones",
      configureTools: "Configurar Herramientas",
      manageKeys: "Gestionar Claves",
      quickActions: "Acciones Rápidas",
      newChat: "Nuevo Chat",
      whyHermes: "¿Por qué Hermes Agent?",
      featureLearning: {
        title: "Aprende Solo",
        desc: "Crea y mejora skills automáticamente tras cada tarea compleja"
      },
      featureMemory: {
        title: "Te Conoce",
        desc: "Construye un modelo profundo de tus preferencias y estilo de trabajo"
      },
      featureMultiplatform: {
        title: "Multi-plataforma",
        desc: "Una conversación continua en Telegram, Discord, Slack, WhatsApp y más"
      }
    },
  };
