/**
 * Demo do Shell CASA (Fase 0) — ShellInterno + blocos, em React. Rota dev:
 * /casa-ui/shell. Prova que o esqueleto + cards/kpi/pulso renderizam no app real,
 * recolorindo por unidade. Dados fictícios.
 */
import { ShellInterno, PageHeader, Kpi, Card, SecTitle, Pulso, Pill, ListRow, CoroaSeal } from "@/components/casa";

export default function ShellDemoPage() {
  return (
    <ShellInterno modulo="presidencia" telaAtiva="/presidencia" user="Erick Ramos" cargo="Presidência" iniciais="ER">
      <PageHeader
        titulo="Sala de Comando"
        descricao="Demo do Shell CASA em React · dados fictícios"
        acoes={
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Gerar Relatório da Corte
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Famílias atendidas" valor="1.342" delta="+8% vs anterior" tendencia="Em alta" />
        <Kpi label="Vagas preenchidas" valor="84%" delta="+5% vs anterior" tendencia="Em alta" />
        <Kpi label="Certificados" valor="213" delta="+12% vs anterior" tendencia="Em alta" />
        <Kpi label="Saúde populacional" valor="72/100" tendencia="Estável" alerta />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <SecTitle>Pulso das unidades</SecTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Pulso nome="Centro Médico" meta="12 vagas · fila 5" pct={82} cor="#10C2BB" status={<Pill tom="unidade">Saudável</Pill>} />
            <Pulso nome="Capacitação" meta="3 vagas · fila 12" pct={91} cor="#FF772E" status={<Pill tom="warn">Cheio</Pill>} />
            <Pulso nome="Esportivo" meta="20 vagas · fila 2" pct={68} cor="#9A3D0B" status={<Pill tom="unidade">Saudável</Pill>} />
            <Pulso nome="Educacional" meta="1 vaga · fila 8" pct={95} cor="#007571" status={<Pill tom="warn">Atenção</Pill>} />
          </div>
        </Card>
        <Card>
          <SecTitle>Atividade recente da Corte</SecTitle>
          <ListRow avatar="JL" titulo="Joana aprovou 9 Fichas Cidadãs" subtitulo="Serviço Social · ontem" trailing={<CoroaSeal status="aprovado">Selado</CoroaSeal>} />
          <ListRow avatar="MD" titulo="Mutirão odontológico · 38 crianças" subtitulo="Médico × Educacional · ontem" trailing={<Pill tom="ok">feito</Pill>} />
          <ListRow avatar="CB" titulo="2ª turma de Barbearia certificou 12 alunos" subtitulo="Capacitação · há 2h" trailing={<Pill tom="ok">feito</Pill>} />
        </Card>
      </div>
    </ShellInterno>
  );
}
