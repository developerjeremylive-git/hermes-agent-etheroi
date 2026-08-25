import { Link } from "react-router";
import {
  Globe,
  Brain,
  Monitor,
  ArrowRight,
  Sparkles,
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
    features: ["7 plataformas nativas", "Continuidad cross-platform", "STT automático (voz → texto)", "Streaming tiempo real", "Aprobación comandos peligrosos", "Arquitectura extensible"],
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
    features: ["Creación automática de skills", "Auto-mejora continua", "Memoria persistente curada", "Búsqueda FTS5 + semántica", "Compresión contexto inteligente", "6 proveedores de memoria"],
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
    features: ["Terminal PTY real (WebGL)", "Chat streaming + slash commands", "Modo Bots con personalidad", "6 backends terminal", "Modal/Daytona serverless", "Dashboard web con TUI real"],
    route: "/servicios/servicio-3",
    highlightColor: "green" as const,
  },
];

const HIGHLIGHT_CLASSES = {
  blue: "bg-blue/10 hover:bg-blue/20 text-blue border-blue/20",
  purple: "bg-purple/10 hover:bg-purple/20 text-purple border-purple/20",
  green: "bg-green/10 hover:bg-green/20 text-green border-green/20",
} as const;

const COMPARISON_ROWS = [
  { label: "Plataformas", key: "comparisonPlatforms", index: 0 },
  { label: "Aprendizaje", key: "comparisonLearning", index: 1 },
  { label: "Memoria", key: "comparisonMemory", index: 2 },
  { label: "Terminal", key: "comparisonTerminal", index: 3 },
  { label: "Seguridad", key: "comparisonSecurity", index: 4 },
  { label: "Extensibilidad", key: "comparisonExtensibility", index: 5 },
] as const;

export default function ServiciosPage() {
  const { t } = useI18n();
  const overview = t.services?.overview;

  return (
    <div className="min-h-screen bg-background-base text-text-primary">
      <header className="border-b border-current/20 bg-background-base/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
              <span className="font-medium">{t.services?.backToHome || "Inicio"}</span>
            </Link>
            <h1 className="text-xl font-bold text-text-primary">{overview?.title || "Servicios de Hermes Agent"}</h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <section className="mb-16 text-center">
          <Badge className="mb-4 inline-flex items-center gap-1.5 bg-accent/10 text-accent border-accent/20">
            <Sparkles className="h-3 w-3" />
            {overview?.badge || "Tres Pilares Fundamentales"}
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-text-primary mb-6">
            {overview?.title || "Servicios de Hermes Agent"}
          </h2>
          <p className="text-lg sm:text-xl text-text-secondary max-w-3xl mx-auto mb-8">
            {overview?.subtitle || "Tres pilares fundamentales que hacen a Hermes único"}
          </p>
          <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed">
            {overview?.description || "Descubre las capacidades centrales que convierten a Hermes en el agente de IA más completo."}
          </p>
        </section>

        <section className="mb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SERVICE_CARDS.map((service) => (
              <Link key={service.id} to={service.route}>
                <Card className="group h-full cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-accent/30 hover:-translate-y-1">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={cn("p-2 rounded-lg", service.iconBg)}>
                        <service.Icon className="h-7 w-7" />
                      </div>
                      <Badge tone="outline" className="text-xs self-start">{service.badge}</Badge>
                    </div>
                    <CardTitle className="mt-4 text-xl group-hover:text-accent transition-colors">{service.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-text-secondary leading-relaxed">{service.shortDesc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {service.features.map((feature, index) => (
                        <Badge key={index} tone="outline" className="text-xs h-5 px-2">
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
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-text-primary mb-2">{overview?.comparisonTitle || "Comparación Rápida"}</h3>
            <p className="text-text-secondary max-w-2xl mx-auto">{overview?.comparisonDesc || "Qué ofrece cada servicio de un vistazo"}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-current/20 text-left text-text-tertiary uppercase tracking-wider text-xs">
                  <th className="pb-3 font-semibold">Característica</th>
                  {SERVICE_CARDS.map((service) => (
                    <th key={service.id} className="pb-3 font-semibold text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <service.Icon className={cn("h-4 w-4", service.iconBg.split(" ")[1].replace("text-", ""))} />
                        <span>{service.title.split(" ")[0]}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-current/10">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td className="py-4 font-medium text-text-primary">
                      {overview?.[row.key] || row.label}
                    </td>
                    {SERVICE_CARDS.map((service) => (
                      <td key={service.id} className="py-4 text-center text-text-secondary">
                        {service.features[row.index]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="text-center">
          <div className="bg-gradient-to-r from-accent/10 to-blue/10 border border-accent/20 rounded-2xl p-8 sm:p-12">
            <h3 className="text-2xl font-bold text-text-primary mb-4">{overview?.ctaTitle || "¿Listo para empezar?"}</h3>
            <p className="text-text-secondary mb-6 max-w-xl mx-auto">{overview?.ctaDesc || "Instala Hermes Agent y experimenta el poder de un agente autoconsciente que aprende, recuerda y se adapta a ti."}</p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link to="/servicios/servicio-1">
                <Button className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  {overview?.startWithMessaging || "Empezar con Mensajería"}
                </Button>
              </Link>
              <Link to="/servicios/servicio-2">
                <Button outlined className="gap-2">
                  <Brain className="h-4 w-4" />
                  {overview?.exploreLearning || "Explorar Aprendizaje"}
                </Button>
              </Link>
              <Link to="/servicios/servicio-3">
                <Button outlined className="gap-2">
                  <Monitor className="h-4 w-4" />
                  {overview?.tryDesktop || "Probar Desktop"}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
