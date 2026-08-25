import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Database,
  Search,
  Sparkles,
  RefreshCw,
  FileText,
  ChevronDown,
} from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";
import { Separator } from "@nous-research/ui/ui/components/separator";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const FEATURES = [
  { Icon: Sparkles, title: "Creación Automática de Habilidades", description: "Tras tareas complejas, el agente detecta patrones y genera habilidades automáticas — scripts reutilizables, knowledge que agrega a su base, y prompts especializados. Para verlas: /skills." },
  { Icon: RefreshCw, title: "Auto-mejora Continua", description: "Las habilidades no son estáticas. Durante el uso, el agente identifica mejoras, optimiza prompts, y refina sus respuestas. Cada sesión es una iteración más." },
  { Icon: Database, title: "Memoria Persistente Curada", description: "Información relevante se guarda en bases de datos (SQLite con FTS5) y en memorias semi-estructuradas. El agente construye un modelo cada vez más profundo de quién eres." },
  { Icon: Search, title: "Búsqueda FTS5 de Sesiones", description: "Busca en conversaciones pasadas con consultas booleanas, frases exactas, y wildcards. El agente puede recuperar contexto de sesiones antiguas automáticamente." },
  { Icon: FileText, title: "Compresión de Contexto Inteligente", description: "Cuando el contexto se vuelve muy largo, el agente puede comprimirlo manteniendo lo relevante — sin perder información importante." },
  { Icon: Brain, title: "Modelado de Usuario Dialéctico (Honcho)", description: "Compatible con Honcho para modelado de usuario avanzado. El agente no solo recuerda hechos — construye un modelo dialéctico de tus preferencias, estilo de trabajo y patrones." },
];

const MEMORY_PROVIDERS = [
  { name: "Honcho (Built-in)", description: "Modelado dialéctico de usuario — el agente construye un modelo profundo de quién eres a través de diálogo estructurado.", features: ["Modelado de usuario", "Memoria semántica", "Recuerdos episódicos", "Inferencia de preferencias"] },
  { name: "mem0", description: "Memoria a largo plazo con recuperación semántica y grafo de conocimiento.", features: ["Grafo de conocimiento", "Recuperación semántica", "Memoria jerárquica", "API REST"] },
  { name: "supermemory", description: "Memoria persistente con búsqueda vectorial y organización automática.", features: ["Búsqueda vectorial", "Organización automática", "Contexto cruzado", "Escalable"] },
  { name: "byterover", description: "Memoria ligera optimizada para agentes de código con enfoque en patrones de desarrollo.", features: ["Patrones de código", "Contexto de desarrollo", "Ligero", "Rápido"] },
  { name: "hindsight", description: "Memoria retrospectiva que aprende de errores y éxitos pasados.", features: ["Aprendizaje de errores", "Retrospectiva", "Mejora continua", "Contexto histórico"] },
  { name: "holographic", description: "Memoria holográfica con codificación distribuida y recuperación asociativa.", features: ["Codificación distribuida", "Recuperación asociativa", "Resistente a ruido", "Alta capacidad"] },
];

const TECH_DETAILS = [
  { title: "Skill Curator - Sistema de Mantenimiento Automático", content: "El curator (agent/curator.py) es un sistema en segundo plano que rastrea el uso de habilidades creadas por el agente (created_by: \"agent\"). Métricas: use_count, view_count, patch_count, last_activity_at. Transiciones automáticas: active → stale → archived. Skills archivados van a ~/.hermes/skills/.archive/ y son restaurables. Skills pincelados (pinned) son inmunes a todas las transiciones automáticas." },
  { title: "SessionDB con FTS5", content: "La base de datos de sesiones (hermes_state.py) usa SQLite con extensión FTS5 para búsqueda full-text. Cada sesión tiene: id único, título auto-generado, historial completo de mensajes (role: user/assistant/system/tool), metadata (modelo, tokens, herramientas usadas). FTS5 permite consultas booleanas, frases exactas, wildcards, y ranking por relevancia." },
  { title: "Compresión de Contexto", content: "Cuando el contexto excede el límite (configurable via compression.max_tokens), el agente invoca compresión: resume segmentos antiguos manteniendo decisiones clave, preferencias del usuario, y estado actual del task. La compresión usa un modelo auxiliar (auxiliary.compression) separado del modelo principal." },
  { title: "Integración agentskills.io", content: "Hermes es compatible con el estándar abierto agentskills.io. Las habilidades exportadas incluyen metadatos estandarizados: name, description, version, author, license, platforms, metadata.hermes.tags, category, related_skills, config. Esto permite compartir skills entre agentes Hermes y otros frameworks compatibles." },
];

export default function Servicio2Page() {
  const { t } = useI18n();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const services = t.services?.learningMemory || {
    title: "Bucle de Aprendizaje Cerrado & Memoria Persistente",
    subtitle: "El único agente que aprende de verdad — crea habilidades, se auto-mejora y construye un modelo de ti",
    description: "Hermes es el único agente con un bucle de aprendizaje integrado que funciona sin supervisión.",
    featuresTitle: "Capacidades Principales",
    featuresDesc: "El bucle de aprendizaje que hace a Hermes único",
    providersTitle: "Proveedores de Memoria Disponibles",
    providersDesc: "Elige el backend de memoria que mejor se adapte a tus necesidades",
    techTitle: "Arquitectura Técnica",
    techDesc: "Cómo funciona el aprendizaje y la memoria bajo el capó",
    features: [],
    memoryProviders: [],
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
          <Badge className="mb-4 inline-flex items-center gap-1.5 bg-purple/10 text-purple border-purple/20">
            <Brain className="h-3 w-3" />
            {t.services?.learningMemory?.badge || "Aprendizaje Automático"}
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-text-primary mb-6">{services.title}</h2>
          <p className="text-lg sm:text-xl text-text-secondary max-w-3xl mx-auto mb-8">{services.subtitle}</p>
          <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed">{services.description}</p>
        </section>

        <section className="mb-16">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-text-primary mb-2">{t.services?.learningMemory?.featuresTitle || "Capacidades Principales"}</h3>
            <p className="text-text-secondary max-w-2xl mx-auto">{t.services?.learningMemory?.featuresDesc || "El bucle de aprendizaje que hace a Hermes único"}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <Card key={index} className="h-full group hover:border-purple/30 transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple/10 rounded-lg text-purple">
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
            <h3 className="text-2xl font-bold text-text-primary mb-2">{t.services?.learningMemory?.providersTitle || "Proveedores de Memoria Disponibles"}</h3>
            <p className="text-text-secondary max-w-2xl mx-auto">{t.services?.learningMemory?.providersDesc || "Elige el backend de memoria que mejor se adapte a tus necesidades"}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MEMORY_PROVIDERS.map((provider, index) => (
              <Card key={index} className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg">{provider.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-text-secondary text-sm">{provider.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.features.map((feature, i) => (
                      <Badge key={i} tone="outline" className="text-xs">{feature}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-text-primary mb-2">{t.services?.learningMemory?.techTitle || "Arquitectura Técnica"}</h3>
            <p className="text-text-secondary max-w-2xl mx-auto">{t.services?.learningMemory?.techDesc || "Cómo funciona el aprendizaje y la memoria bajo el capó"}</p>
          </div>
          <div className="space-y-4">
            {TECH_DETAILS.map((detail, index) => (
              <AccordionItem key={index} title={detail.title} content={detail.content} isOpen={expandedSections[`tech-${index}`]} onToggle={() => toggleSection(`tech-${index}`)} accentColor="purple" />
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center gap-4 pt-8 border-t border-current/20">
          <Link to="/servicios/servicio-1">
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
          <Link to="/servicios/servicio-3">
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

function AccordionItem({ title, content, isOpen, onToggle }: { title: string; content: string; isOpen: boolean; onToggle: () => void; accentColor?: string }) {
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
