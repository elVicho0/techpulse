import {
  Bookmark,
  BrainCircuit,
  Database,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  Newspaper,
  Settings2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
  end?: boolean;
  badgeKey?: "repositories" | "news" | "ideas" | "saved";
  accent?: "blue" | "violet" | "cyan" | "amber" | "green";
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const navigation: NavSection[] = [
  {
    title: "Inteligencia",
    items: [
      {
        to: "/",
        label: "Overview",
        icon: LayoutDashboard,
        description: "Pulso general, tendencias y actividad",
        end: true,
        accent: "blue",
      },
      {
        to: "/repositories",
        label: "GitHub Trending",
        icon: GitBranch,
        description: "Repositorios descubiertos y ranking explicable",
        badgeKey: "repositories",
        accent: "blue",
      },
      {
        to: "/ai-radar",
        label: "AI Radar",
        icon: BrainCircuit,
        description: "Agentes, modelos, RAG y herramientas de IA",
        accent: "violet",
      },
      {
        to: "/data",
        label: "Data Engineering",
        icon: Database,
        description: "ETL, streaming, lakehouse y orquestación",
        accent: "cyan",
      },
    ],
  },
  {
    title: "Contenido",
    items: [
      {
        to: "/news",
        label: "Tech News",
        icon: Newspaper,
        description: "Noticias clasificadas por importancia y procedencia",
        badgeKey: "news",
        accent: "amber",
      },
      {
        to: "/ideas",
        label: "Project Ideas",
        icon: Lightbulb,
        description: "Ideas trazables a repositorios reales",
        badgeKey: "ideas",
        accent: "green",
      },
      {
        to: "/saved",
        label: "Guardados",
        icon: Bookmark,
        description: "Repositorios, noticias e ideas guardadas",
        badgeKey: "saved",
        accent: "violet",
      },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        to: "/settings",
        label: "Settings",
        icon: Settings2,
        description: "Fuentes, intervalos, worker y embeddings",
        accent: "blue",
      },
    ],
  },
];

export const allNavItems = navigation.flatMap((section) => section.items);

export function navItemForPath(pathname: string): NavItem | undefined {
  if (pathname.startsWith("/repo/")) return allNavItems.find((item) => item.to === "/repositories");
  if (pathname.startsWith("/ideas/")) return allNavItems.find((item) => item.to === "/ideas");
  return [...allNavItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
}
