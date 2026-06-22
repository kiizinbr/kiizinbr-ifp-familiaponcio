/**
 * Config de teste UNITÁRIO da API (faltava — só havia o e2e em test/).
 * ts-jest em modo isolatedModules (transpile-only): roda specs de lógica pura
 * sem subir Nest nem banco. tsconfig inline evita o exclude de *.spec.ts do
 * tsconfig.json do projeto.
 *
 * Rodar: pnpm --filter @ifp/api test
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        isolatedModules: true,
        tsconfig: {
          module: "CommonJS",
          target: "ES2022",
          esModuleInterop: true,
        },
      },
    ],
  },
};
