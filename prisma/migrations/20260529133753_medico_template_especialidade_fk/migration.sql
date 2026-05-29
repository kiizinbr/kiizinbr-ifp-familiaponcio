-- AddForeignKey
ALTER TABLE "AgendaTemplate" ADD CONSTRAINT "AgendaTemplate_especialidadeId_fkey" FOREIGN KEY ("especialidadeId") REFERENCES "Especialidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
