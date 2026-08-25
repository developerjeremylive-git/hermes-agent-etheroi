import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  Monitor,
  Terminal,
  Cpu,
  Layers,
  Shield,
  Globe,
  Smartphone,
  Wifi,
  HardDrive,
  Cloud,
  ChevronDown,
  Box,
} from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Separator } from "@nous-research/ui/ui/components/separator";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const FEATURES = [
  { Icon: Terminal, title: "Terminal Real Integrado", description: "No es un widget — es un terminal PTY real (xterm.js + WebGL) que corre en el proceso backend. Ejecuta comandos, scripts, y herramientas mientras chateas." },
  { Icon: Monitor, title: "Chat Persistente con Streaming", description: "Composer rico con autocompletado de slash commands, streaming de respuestas token-by-token, historial de conversaciones con búsqueda, y reanudación de sesiones." },
  { Icon: Layers, title: "Modo Bots - Agentes con Personalidad", description: "Cada bot es un perfil completo de Hermes: su propio config.yaml, memoria, skills, SOUL.md, modelo, y chat canónico (Bot Chat)." },
  { Icon: Cpu, title: "6 Backends de Terminal", description: "Local, Docker, SSH, Singularity, Modal, Daytona. Modal y Daytona ofrecen persistencia serverless — el entorno hiberna cuando idle." },
  { Icon: Smartphone, title: "Picker de Sesiones Visual", description: "Navegador visual de sesiones con preview, búsqueda, filtros por origen, y reanudación one-click." },
  { Icon: Shield, title: "Aprobación Visual de Comandos", description: "UI nativa que muestra el comando, working directory, y riesgos antes de ejecutar. Configurable por toolset y perfil." },
];

const DESKTOP_TABS = [
  {
    id: "architecture",
    label: "Arquitectura",
    items: [
      { title: "Arquitectura Electron + tui_gateway", description: "La app Electron (apps/desktop/) es un renderer React + nanostore que habla JSON-RPC con un backend tui_gateway (Python) vía WebSocket. El backend spawnea el agente y maneja herramientas, terminal, y sesión." },
      { title: "WebSocket JSON-RPC Transport", description: "Comunicación bidireccional: renderer → backend (prompt.submit, slash.exec, approval.respond) y backend → renderer (message.delta/complete, tool.start/progress/complete, approval.request)." },
    ],
  },
  {
    id: "terminal",
    label: "Terminal PTY",
    items: [
      { title: "Terminal PTY Real (xterm.js + WebGL)", description: "El terminal usa xterm.js con renderizador WebGL, addon-fit para resize automático, y unicode11 para caracteres anchos modernos. Backend usa ptyprocess (POSIX)." },
    ],
  },
  {
    id: "bots",
    label: "Modo Bots",
    items: [
      { title: "Bot Mode - One Bot = One Canonical Chat", description: "Diseño inmutable: Un bot = UN chat canónico para siempre, identificado por NOMBRE. lifecycle al click: resolve registry SIEMPRE — busca sesión 'Bot Chat' por título exacto." },
    ],
  },
  {
    id: "web",
    label: "Dashboard Web",
    items: [
      { title: "Dashboard Web Embebido", description: "hermes dashboard sirve el mismo tui_gateway + SPA React. El chat web embebe el real hermes --tui vía PTY WebSocket (/api/pty?token=...)." },
      { title: "Perfiles Completamente Aislados", description: "Cada perfil tiene su propio HERMES_HOME: config.yaml, .env, memoria, sesiones, skills, skins, logs, cron. _apply_profile_override() setea HERMES_HOME antes de imports." },
    ],
  },
];

const TECH_DETAILS = [
  { title: "Apps/desktop Architecture", content: "apps/desktop/src/ — renderer React 19 + nanostore. apps/shared/ — @hermes/shared con JsonRpcGatewayClient + WS helpers. electron/main.ts — main process, spawnea backend via hermes serve (headless)." },
  { title: "tui_gateway Server", content: "tui_gateway/server.py — JSON-RPC sobre stdio (Ink TUI) y WebSocket (Electron/Web). Métodos: prompt.submit, slash.exec, session.list/resume, tool.start/progress/complete." },
  { title: "Bot Mode - Invariant", content: "Un bot = UN chat canónico para siempre, identificado por NOMBRE. La identidad es (perfil, sesión titulada exactamente 'Bot Chat'). NO hay session-id pin." },
  { title: "Cross-Platform PTY", content: "hermes dashboard → /chat embedde hermes --tui real. Browser carga ChatPage.tsx → xterm.js Terminal con WebGL renderer. Server spawnea vía ptyprocess." },
];

const BACKENDS = [
  { name: "Local", icon: HardDrive, desc: "Tu máquina local con acceso completo al sistema", features: ["Acceso total al FS", "Sin latencia", "Hardware local", "Gratuito"] },
  { name: "Docker", icon: Box, desc: "Ejecución aislada en contenedor — seguridad y reproducibilidad", features: ["Aislamiento total", "Reproducible", "Imágenes versionadas", "Límites de recursos"] },
  { name: "SSH", icon: Wifi, desc: "Conecta a servidor remoto y ejecuta comandos allí", features: ["Ejecución remota", "Acceso a servidores", "Claves SSH", "Túneles"] },
  { name: "Singularity", icon: Cloud, desc: "Contenedores HPC y entornos de investigación científica", features: ["HPC compatible", "Sin root", "Reproducible", "Científico"] },
  { name: "Modal", icon: Cpu, desc: "Serverless con persistencia — hiberna cuando idle, coste ~$0", features: ["Serverless", "Persistente", "Auto-scaling", "GPU disponible"] },
  { name: "Daytona", icon: Globe, desc: "Entornos cloud con persistencia y zero-cost cuando idle", features: ["Cloud IDE", "Persistente", "Zero-cost idle", "Colaborativo"] },
];

export default function Servicio3Page() {
  const { t } = useI18n();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState("architecture");

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const services = t.services?.desktopTerminal || {
    title: "App de Escritorio & Terminal Real",
    subtitle: "Hermes Desktop — Electron + React con terminal integrado, chat en vivo, y bots con personalidad",
    description: "Hermes Desktop es una app Electron completa que trae toda la potencia del agente a tu escritorio.",
    badge: "App de Escritorio Nativa",
    featuresTitle: "Características Principales",
    featuresDesc: "Todo lo que necesitas en tu escritorio",
    deepTitle: "Arquitectura en Profundidad",
    deepDesc: "Detalles técnicos de la app de escritorio y terminal",
    techTitle: "Detalles de Implementación",
    techDesc: "Cómo funciona todo bajo el capó",
    backendsTitle: "Backends de Terminal Disponibles",
    backendsDesc: "Elige el entorno de ejecución que necesitas",
    features: [],
    desktopFeatures: [],
    techDetails: [],
  };

  return (
    <div className="min-h-screen bg-background-base text-text-primary">
      <header className="border-b border-current/20 bg-background-base/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/servicios" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">{t.services?.backToServices || "Volver a Servicios"}</span>
            </Link>
            <h1 className="text-xl font-bold text-text-primary">{services.title}</h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <section className="mb-16 text-center">
          <Badge className="mb-4 inline-flex items-center gap-1.5 bg-blue/10 text-blue border-blue/20">
            <Monitor className="h-3 w-3" />
            {t.services?.desktopTerminal?.badge || services.badge}
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-text-primary mb-6">{services.title}</h2>
          <p className="text-lg sm:text-xl text-text-secondary max-w-3xl mx-auto mb-8">{services.subtitle}</p>
          <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed">{services.description}</p>
        </section>

        <section className="mb-16">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-text-primary mb-2">{t.services?.desktopTerminal?.featuresTitle || "Características Principales"}</h3>
            <p className="text-text-secondary max-w-2xl mx-auto">{t.services?.desktopTerminal?.featuresDesc || "Todo lo que necesitas en tu escritorio"}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <Card key={index} className="h-full group hover:border-blue/30 transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue/10 rounded-lg text-blue">
                      <feature.Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-text-secondary text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-text-primary mb-2">{t.services?.desktopTerminal?.deepTitle || "Arquitectura en Profundidad"}</h3>
            <p className="text-text-secondary max-w-2xl mx-auto">{t.services?.desktopTerminal?.deepDesc || "Detalles técnicos de la app de escritorio y terminal"}</p>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-6">
              {DESKTOP_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    activeTab === tab.id
                      ? "bg-accent/10 text-accent border border-accent/30"
                      : "bg-background-elevated text-text-secondary border border-border hover:text-text-primary hover:border-border-hover"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {DESKTOP_TABS.filter((tab) => tab.id === activeTab).map((tab) => (
              <div key={tab.id} className="space-y-4">
                {tab.items.map((item, idx) => (
                  <AccordionItem key={idx} title={item.title} content={item.description} isOpen={expandedSections[`${tab.id}-${idx}`]} onToggle={() => toggleSection(`${tab.id}-${idx}`)} />
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-text-primary mb-2">{t.services?.desktopTerminal?.techTitle || "Detalles de Implementación"}</h3>
            <p className="text-text-secondary max-w-2xl mx-auto">{t.services?.desktopTerminal?.techDesc || "Cómo funciona todo bajo el capó"}</p>
          </div>
          <div className="space-y-4">
            {TECH_DETAILS.map((detail, index) => (
              <AccordionItem key={index} title={detail.title} content={detail.content} isOpen={expandedSections[`tech-${index}`]} onToggle={() => toggleSection(`tech-${index}`)} />
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-text-primary mb-2">{t.services?.desktopTerminal?.backendsTitle || "Backends de Terminal Disponibles"}</h3>
            <p className="text-text-secondary max-w-2xl mx-auto">{t.services?.desktopTerminal?.backendsDesc || "Elige el entorno de ejecución que necesitas"}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BACKENDS.map((backend, index) => (
              <Card key={index} className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue/10 rounded-lg text-blue">
                      <backend.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{backend.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-text-secondary text-sm">{backend.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {backend.features.map((feature, i) => (
                      <Badge key={i} tone="outline" className="text-xs">{feature}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center gap-4 pt-8 border-t border-current/20">
          <Link to="/servicios/servicio-2">
            <Button outlined className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t.services?.prevService || "Servicio Anterior"}
            </Button>
          </Link>
          <Link to="/servicios">
            <Button outlined className="gap-2">
              <ChevronDown className="h-4 w-4" />
              {t.services?.backToServices || "Volver a Servicios"}
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}

function AccordionItem({ title, content, isOpen, onToggle }: { title: string; content: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-text-primary">{title}</h4>
          <ChevronDown className={cn("h-5 w-5 text-text-tertiary transition-transform", isOpen && "rotate-180")} />
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <Separator className="mb-4" />
          <div className="prose prose-sm dark:prose-invert max-w-none text-text-secondary">
            <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
