import { Link } from "react-router";
import {
  MessageSquare,
  Cpu,
  FileText,
  Package,
  Settings,
  KeyRound,
  Sparkles,
  ArrowRight,
  Zap,
  Brain,
  Monitor,
  Globe,
  Layers,
  CheckCircle,
} from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const SERVICE_CARDS = [
  {
    id: "servicio-1",
    title: "Gateway de Mensajería Multi-plataforma",
    shortDesc: "Un solo proceso conecta tu agente a 7 plataformas con continuidad total",
    Icon: Globe,
    iconBg: "bg-blue/10 text-blue",
    badge: "Multi-plataforma",
    features: [
      "7 plataformas nativas",
      "Continuidad cross-platform",
      "STT automático (voz → texto)",
      "Streaming tiempo real",
      "Aprobación comandos peligrosos",
      "Arquitectura extensible",
    ],
    route: "/servicios/servicio-1",
    highlightColor: "blue" as const,
  },
  {
    id: "servicio-2",
    title: "Bucle de Aprendizaje & Memoria Persistente",
    shortDesc: "El único agente que aprende de verdad — crea skills, se auto-mejora y te modela",
    Icon: Brain,
    iconBg: "bg-purple/10 text-purple",
    badge: "Aprendizaje Automático",
    features: [
      "Creación automática de skills",
      "Auto-mejora continua",
      "Memoria persistente curada",
      "Búsqueda FTS5 + semántica",
      "Compresión contexto inteligente",
      "6 proveedores de memoria",
    ],
    route: "/servicios/servicio-2",
    highlightColor: "purple" as const,
  },
  {
    id: "servicio-3",
    title: "App de Escritorio & Terminal Real",
    shortDesc: "Electron + React con terminal PTY real, chat persistente, y bots con personalidad",
    Icon: Monitor,
    iconBg: "bg-green/10 text-green",
    badge: "App Nativa",
    features: [
      "Terminal PTY real (WebGL)",
      "Chat streaming + slash commands",
      "Modo Bots con personalidad",
      "6 backends terminal",
      "Modal/Daytona serverless",
      "Dashboard web con TUI real",
    ],
    route: "/servicios/servicio-3",
    highlightColor: "green" as const,
  },
];

const HIGHLIGHT_CLASSES = {
  blue: "bg-blue/10 hover:bg-blue/20 text-blue border-blue/20",
  purple: "bg-purple/10 hover:bg-purple/20 text-purple border-purple/20",
  green: "bg-green/10 hover:bg-green/20 text-green border-green/20",
} as const;

export default function DashboardHomePage() {
  const { t } = useI18n();

  const quickStats = [
    { label: t.dashboard?.activeSessions || "Sesiones Activas", value: "—", Icon: MessageSquare, color: "text-blue" },
    { label: t.dashboard?.connectedPlatforms || "Plataformas", value: "—", Icon: Globe, color: "text-green" },
    { label: t.dashboard?.totalTools || "Herramientas", value: "40+", Icon: Package, color: "text-purple" },
    { label: t.dashboard?.availableModels || "Modelos", value: "300+", Icon: Cpu, color: "text-accent" },
  ];

  const quickActions = [
    { label: t.dashboard?.newChat || "Nuevo Chat", href: "/chat", Icon: MessageSquare, primary: true },
    { label: t.dashboard?.viewSessions || "Ver Sesiones", href: "/sessions", Icon: FileText, primary: false },
    { label: t.dashboard?.configureTools || "Configurar Tools", href: "/config", Icon: Settings, primary: false },
    { label: t.dashboard?.manageKeys || "Gestionar Claves", href: "/env", Icon: KeyRound, primary: false },
  ];

  const features = [
    {
      Icon: Zap,
      title: t.dashboard?.featureLearning?.title || "Aprende Solo",
      desc: t.dashboard?.featureLearning?.desc || "Crea y mejora skills automáticamente tras cada tarea compleja",
    },
    {
      Icon: Brain,
      title: t.dashboard?.featureMemory?.title || "Te Conoce",
      desc: t.dashboard?.featureMemory?.desc || "Construye un modelo profundo de tus preferencias y estilo de trabajo",
    },
    {
      Icon: Layers,
      title: t.dashboard?.featureMultiplatform?.title || "Multi-plataforma",
      desc: t.dashboard?.featureMultiplatform?.desc || "Una conversación continua en Telegram, Discord, Slack, WhatsApp y más",
    },
  ];

  return (
    <div className="min-h-screen bg-background-base text-text-primary">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <section className="mb-16 text-center">
          <Badge className="mb-4 inline-flex items-center gap-1.5 bg-accent/10 text-accent border-accent/20">
            <Sparkles className="h-3 w-3" />
            {t.dashboard?.welcomeBadge || "Hermes Agent Dashboard"}
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-text-primary mb-6">
            {t.dashboard?.welcomeTitle || "Bienvenido a tu Centro de Control"}
          </h1>
          <p className="text-lg sm:text-xl text-text-secondary max-w-3xl mx-auto mb-8">
            {t.dashboard?.welcomeDesc || "Gestiona tu agente, monitoriza sesiones, configura herramientas y explora los servicios principales."}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/chat">
              <Button className="gap-2">
                <MessageSquare className="h-4 w-4" />
                {t.dashboard?.startChatting || "Iniciar Chat"}
              </Button>
            </Link>
            <Link to="/servicios">
              <Button outlined className="gap-2">
                <Sparkles className="h-4 w-4" />
                {t.dashboard?.exploreServices || "Explorar Servicios"}
              </Button>
            </Link>
          </div>
        </section>

        <section className="mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {quickStats.map((stat, index) => (
              <Card key={index} className="text-center">
                <CardContent className="py-6">
                  <div className={cn("h-10 w-10 rounded-xl mx-auto mb-3 flex items-center justify-center", `${stat.color}/10`)}>
                    <stat.Icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                  <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                  <p className="text-sm text-text-secondary mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                {t.services?.overview?.title || "Servicios de Hermes Agent"}
              </h2>
              <p className="text-text-secondary">
                {t.services?.overview?.subtitle || "Tres pilares fundamentales que hacen a Hermes único"}
              </p>
            </div>
            <Link to="/servicios">
              <Button outlined className="gap-2">
                {t.services?.overview?.viewAll || "Ver todos"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SERVICE_CARDS.map((service) => (
              <Link key={service.id} to={service.route}>
                <Card className="group h-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-accent/30 hover:-translate-y-1">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={cn("p-2 rounded-lg", service.iconBg)}>
                        <service.Icon className="h-7 w-7" />
                      </div>
                      <Badge tone="outline" className="text-xs self-start">
                        {service.badge}
                      </Badge>
                    </div>
                    <CardTitle className="mt-4 text-lg group-hover:text-accent transition-colors">
                      {service.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-text-secondary text-sm leading-relaxed">
                      {service.shortDesc}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {service.features.slice(0, 4).map((feature, idx) => (
                        <Badge key={idx} tone="outline" className="text-xs h-5 px-2">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-current/20">
                      <Button className={cn("w-full justify-between", HIGHLIGHT_CLASSES[service.highlightColor])}>
                        <span>{t.services?.overview?.viewAll || "Explorar"}</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h3 className="text-xl font-bold text-text-primary mb-6">
            {t.dashboard?.quickActions || "Acciones Rápidas"}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <Link key={index} to={action.href}>
                <Button
                  outlined={!action.primary}
                  className={cn("h-auto py-4 flex-col items-start gap-3 text-left", action.primary && "bg-accent hover:bg-accent/90")}
                >
                  <div className={cn("p-2 rounded-lg", action.primary ? "bg-white/10" : "bg-current/10")}>
                    <action.Icon className="h-5 w-5" />
                  </div>
                  <span className="font-medium">{action.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xl font-bold text-text-primary mb-6">
            {t.dashboard?.whyHermes || "¿Por qué Hermes Agent?"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="text-center">
                <CardContent className="py-6">
                  <div className="p-3 rounded-xl bg-accent/10 text-accent mx-auto mb-4 w-fit">
                    <feature.Icon className="h-6 w-6" />
                  </div>
                  <h4 className="font-semibold text-text-primary mb-2">{feature.title}</h4>
                  <p className="text-text-secondary text-sm">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
