import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Smartphone,
  Shield,
  Code,
  Zap,
  Layers,
  ChevronDown,
  CheckCircle,
} from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Separator } from "@nous-research/ui/ui/components/separator";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const PLATFORMS = [
  { name: "Telegram", icon: "✈️", features: ["DM 1:1 sin restricciones", "Grupos con allowlist / allowall", "Reply quoting — el agente entiende el contexto", "Notas de voz → texto (STT) → respuesta", "Adjuntos: imágenes, documentos, audio", "Topic threads", "Persistencia cross-platform"] },
  { name: "Discord", icon: "💬", features: ["Cualquier canal de texto o hilo", "Streaming de respuestas en tiempo real", "Mención para invocar — @Hermes", "Integración continua con el resto del servidor", "Permisos granulares por rol"] },
  { name: "Slack", icon: "🔶", features: ["Canales públicos y privados", "Hilos de conversación (contexto persistido)", "DM con el bot", "Mensajes slash: /hermes", "Aprobación de comandos peligrosos"] },
  { name: "WhatsApp", icon: "📱", features: ["Conversación fluida 1:1", "Envío y recepción de imágenes", "Notas de voz transcritas automáticamente", "Sin necesidad de aprender una nueva app"] },
  { name: "Signal", icon: "🔒", features: ["Cifrado E2E nativo", "Grupos de Signal", "Mínimo footprint en el servidor", "Ideal para conversaciones sensibles"] },
  { name: "Email · Webhooks", icon: "📬", features: ["Recibir y responder correos (SMTP/IMAP)", "Webhooks HTTP entrantes", "Cadenas de triggers externos", "Integración con Home Assistant"] },
  { name: "CLI / Terminal", icon: "💻", features: ["CLI interactiva con prompt_toolkit", "TUI completa con React + Ink", "Terminal integrado en la app de escritorio", "Streaming de herramientas en tiempo real", "/comandos de barra ricos"] },
];

const FEATURES = [
  { Icon: Layers, title: "Continuidad Cross-Platform", description: "Una conversación que empieza en Telegram continúa en Discord o CLI sin perder contexto. El agente modela quién eres — no importa cómo te comuniques." },
  { Icon: Globe, title: "Gateway Unificado", description: "Un solo proceso maneja todas las plataformas simultáneamente. Adapteres por plataforma bajo gateway/platforms/ — nuevas plataformas se agregan sin tocar el core." },
  { Icon: Smartphone, title: "Transcripción de Voz (STT)", description: "Notas de voz en Telegram y WhatsApp se transcriben automáticamente antes de llegar al agente — el agente \"escucha\" lo que dijiste." },
  { Icon: Zap, title: "Streaming en Tiempo Real", description: "En plataformas que lo soportan (Discord, Slack), las respuestas se envían parcialmente en tiempo real, no de golpe al final." },
  { Icon: Shield, title: "Seguridad y Controles", description: "Aprobación de comandos peligrosos, emparejamiento por DM, aislamiento en contenedor, y permisos granulares por plataforma." },
  { Icon: Code, title: "Arquitectura Extensible", description: "Cada plataforma tiene su adaptador bajo gateway/platforms/. Nuevas plataformas se agregan sin tocar el core del agente." },
];

export default function Servicio1Page() {
  const { t } = useI18n();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const services = t.services?.messagingGateway || {
    title: "Gateway de Mensajería Multi-plataforma",
    subtitle: "Un solo proceso, siete plataformas, continuidad total",
    description: "El gateway de Hermes es un proceso único que conecta tu agente a múltiples plataformas de mensajería simultáneamente.",
    platformsTitle: "Plataformas Soportadas",
    platformsDesc: "Conecta tu agente a donde estén tus usuarios",
    platformBadge: "Plataforma",
    featuresTitle: "Características Principales",
    featuresDesc: "Potencia tu agente con capacidades nativas multi-plataforma",
    techTitle: "Detalles Técnicos",
    techDesc: "Arquitectura interna y funcionamiento profundo",
    features: [],
    techDetails: [
      { title: "Arquitectura del Gateway", content: "El gateway es un proceso Python único (gateway/run.py) que usa asyncio para manejar múltiples conexiones WebSocket/long-polling concurrentes. Cada plataforma tiene un adapter que implementa la interfaz BaseAdapter con métodos connect(), disconnect(), send(), y manejadores de eventos específicos de la plataforma." },
      { title: "Sistema de Sesiones Unificado", content: "Todas las plataformas comparten el mismo SessionDB (SQLite con FTS5). Cada conversación tiene un session_id único que persiste cross-platform." },
      { title: "Delivery y Routing", content: "Los mensajes se enrutan al agente activo mediante un sistema de colas por sesión. El gateway trackea active_sessions y encola mensajes entrantes en _pending_messages cuando el agente está ocupado." },
    ],
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
          <Badge className="mb-4 inline-flex items-center gap-1.5 bg-accent/10 text-accent border-accent/20">
            <Globe className="h-3 w-3" />
            {t.services?.messagingGateway?.badge || "Gateway Multi-plataforma"}
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-text-primary mb-6">{services.title}</h2>
          <p className="text-lg sm:text-xl text-text-secondary max-w-3xl mx-auto mb-8">{services.subtitle}</p>
          <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed">{services.description}</p>
        </section>

        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-bold text-text-primary">{t.services?.messagingGateway?.platformsTitle || services.platformsTitle}</h3>
              <p className="text-text-secondary mt-1">{t.services?.messagingGateway?.platformsDesc || services.platformsDesc}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLATFORMS.map((platform) => (
              <Card key={platform.name} className="group hover:border-accent/30 transition-all duration-300 hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{platform.icon}</span>
                      <CardTitle className="text-lg">{platform.name}</CardTitle>
                    </div>
                    <Badge tone="outline" className="text-xs">{t.services?.messagingGateway?.platformBadge || "Plataforma"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2">
                    {platform.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-text-primary mb-2">{t.services?.messagingGateway?.featuresTitle || "Características Principales"}</h3>
            <p className="text-text-secondary max-w-2xl mx-auto">{t.services?.messagingGateway?.featuresDesc || "Potencia tu agente con capacidades nativas multi-plataforma"}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <Card key={index} className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-lg text-accent">
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
            <h3 className="text-2xl font-bold text-text-primary mb-2">{t.services?.messagingGateway?.techTitle || "Detalles Técnicos"}</h3>
            <p className="text-text-secondary max-w-2xl mx-auto">{t.services?.messagingGateway?.techDesc || "Arquitectura interna y funcionamiento profundo"}</p>
          </div>
          <div className="space-y-4">
            {services.techDetails.map((detail, index) => (
              <AccordionItem key={index} title={detail.title} content={detail.content} isOpen={expandedSections[`tech-${index}`]} onToggle={() => toggleSection(`tech-${index}`)} />
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center gap-4 pt-8 border-t border-current/20">
          <Link to="/servicios">
            <Button outlined className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t.services?.backToServices || "Volver a Servicios"}
            </Button>
          </Link>
          <Link to="/servicios/servicio-2">
            <Button className="gap-2">
              {t.services?.nextService || "Siguiente Servicio"}
              <ArrowRight className="h-4 w-4" />
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
