import { IsNotEmpty, IsString } from "class-validator";

export class CriarConversaDto {
  /** Criança (MembroFamiliar) — a conversa é única por criança. */
  @IsString({ message: "membroId deve ser um texto." })
  @IsNotEmpty({ message: "Informe a criança (membroId)." })
  membroId!: string;
}
