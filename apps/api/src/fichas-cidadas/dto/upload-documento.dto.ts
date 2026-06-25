import { IsEnum } from "class-validator";
import { TipoDocumento } from "@ifp/database";

/**
 * Campos de texto do multipart no upload de documento da ficha (Onda C2).
 * O arquivo em si chega pelo FileInterceptor (não entra aqui); o `tipo`
 * classifica o documento (RG, comprovante de renda, laudo médico, etc.).
 */
export class UploadDocumentoDto {
  @IsEnum(TipoDocumento)
  tipo!: TipoDocumento;
}
