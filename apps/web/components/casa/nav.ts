/** Navegação do Shell CASA por módulo (dados puros; sem JSX). */
import {
  Activity,
  Award,
  Baby,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  ClipboardList,
  FileText,
  Home,
  LayoutGrid,
  LineChart,
  ListChecks,
  ListOrdered,
  MapPin,
  MessageSquare,
  Network,
  Scissors,
  Send,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ModuloCasa =
  | "presidencia"
  | "medico"
  | "capacitacao"
  | "educacional"
  | "esportivo"
  | "servico-social"
  | "admin";

export const NOME_UNIDADE: Record<ModuloCasa, string> = {
  presidencia: "Corte · Presidência",
  medico: "Centro Médico",
  capacitacao: "Centro de Capacitação",
  educacional: "Centro Educacional",
  esportivo: "Centro Esportivo",
  "servico-social": "Serviço Social",
  admin: "Administração",
};

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV: Record<ModuloCasa, NavItem[]> = {
  presidencia: [
    { href: "/presidencia", label: "Painel", icon: Home },
    { href: "/presidencia/unidades", label: "Unidades", icon: LayoutGrid },
    { href: "/presidencia/impacto", label: "Impacto", icon: BarChart3 },
    { href: "/presidencia/impacto-series", label: "Séries", icon: LineChart },
    { href: "/presidencia/familias", label: "Famílias", icon: Users },
    { href: "/presidencia/territorio", label: "Território", icon: MapPin },
    { href: "/presidencia/saude", label: "Saúde", icon: Stethoscope },
    { href: "/presidencia/jornada", label: "Jornada", icon: Network },
    { href: "/presidencia/prestacao-contas", label: "Prestação", icon: ClipboardList },
    { href: "/presidencia/relatorios", label: "Relatórios", icon: FileText },
  ],
  medico: [
    { href: "/medico", label: "Painel", icon: Home },
    { href: "/medico/agenda", label: "Agenda", icon: Calendar },
    { href: "/medico/fila", label: "Fila", icon: ListOrdered },
    { href: "/medico/fila-chegada", label: "Chegada", icon: UserCheck },
    { href: "/medico/prontuarios", label: "Prontuários", icon: ClipboardList },
    { href: "/medico/beneficiarios", label: "Beneficiários", icon: Users },
    { href: "/medico/indicadores", label: "Indicadores", icon: BarChart3 },
    { href: "/medico/equipe", label: "Equipe", icon: Stethoscope },
  ],
  capacitacao: [
    { href: "/capacitacao", label: "Painel", icon: Home },
    { href: "/capacitacao/turmas", label: "Turmas", icon: Users },
    { href: "/capacitacao/cursos", label: "Cursos", icon: BookOpen },
    { href: "/capacitacao/matriculas", label: "Matrículas", icon: ClipboardList },
    { href: "/capacitacao/banco-modelos", label: "Modelos", icon: Scissors },
    { href: "/capacitacao/certificados", label: "Certificados", icon: Award },
    { href: "/capacitacao/indicadores", label: "Indicadores", icon: Activity },
  ],
  educacional: [
    { href: "/educacional", label: "Painel", icon: Home },
    { href: "/educacional/turmas", label: "Turmas", icon: Baby },
    { href: "/educacional/mensagens", label: "Mensagens", icon: MessageSquare },
    { href: "/educacional/indicadores", label: "Indicadores", icon: BarChart3 },
    { href: "/educacional/comunicados", label: "Comunicados", icon: Bell },
  ],
  esportivo: [
    { href: "/esportivo", label: "Painel", icon: Home },
    { href: "/esportivo/turmas", label: "Turmas", icon: Users },
    { href: "/esportivo/indicadores", label: "Indicadores", icon: BarChart3 },
  ],
  "servico-social": [
    { href: "/servico-social", label: "Início", icon: Home },
    { href: "/servico-social/fichas", label: "Fichas", icon: FileText },
    { href: "/servico-social/agenda", label: "Agenda", icon: Calendar },
    { href: "/servico-social/triagem", label: "Triagem", icon: ListChecks },
    { href: "/servico-social/elegibilidade", label: "Elegib.", icon: ShieldCheck },
    { href: "/servico-social/encaminhamentos", label: "Encaminh.", icon: Send },
    { href: "/servico-social/ponte", label: "Ponte", icon: Network },
  ],
  admin: [
    { href: "/admin/usuarios", label: "Usuários", icon: Users },
    { href: "/admin/unidades", label: "Unidades", icon: LayoutGrid },
    { href: "/admin/auditoria", label: "Auditoria", icon: ShieldCheck },
    { href: "/admin/comunicados", label: "Comunicados", icon: Bell },
    { href: "/admin/config", label: "Configuração", icon: Settings },
  ],
};
