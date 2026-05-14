import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { EstadoCivil, Escolaridade } from "@ifp/database";

const CPF_REGEX = /^\d{11}$/;

const toDigits = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.replace(/\D/g, "") : value;

export class CreateFichaCidadaDto {
  @IsString()
  @MaxLength(120)
  nomeCompleto!: string;

  @IsString()
  @Transform(toDigits)
  @Matches(CPF_REGEX, { message: "cpf deve conter 11 dígitos" })
  cpf!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  rg?: string;

  @IsDateString({}, { message: "dataNascimento deve estar em ISO 8601 (YYYY-MM-DD)" })
  dataNascimento!: string;

  @IsOptional()
  @IsEnum(EstadoCivil)
  estadoCivil?: EstadoCivil;

  @IsOptional()
  @IsEnum(Escolaridade)
  escolaridade?: Escolaridade;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fotoUrl?: string;

  @IsString()
  @Transform(toDigits)
  @Length(10, 11, { message: "telefone deve ter 10 ou 11 dígitos" })
  telefone!: string;

  @IsOptional()
  @IsString()
  @Transform(toDigits)
  @Length(10, 11)
  telefoneAlt?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  @IsOptional()
  @IsString()
  @Transform(toDigits)
  @Length(8, 8)
  cep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  logradouro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  complemento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  bairro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  cidade?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
