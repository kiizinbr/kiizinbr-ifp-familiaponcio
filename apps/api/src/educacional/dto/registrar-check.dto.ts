import { IsString } from "class-validator";

export class RegistrarCheckDto {
  /** A criança (MembroFamiliar). */
  @IsString()
  membroId!: string;

  /** Quem entrega (ENTRADA) ou retira (SAÍDA) — ResponsavelAutorizado. */
  @IsString()
  autorizadoId!: string;
}
