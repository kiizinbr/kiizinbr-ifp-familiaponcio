import { PageSkeleton } from "../../_components/page-skeleton";

export default function Loading() {
  // O detalhe roda vários queries Prisma (matrículas + candidatos); o skeleton
  // do segmento aparece enquanto o Server Component resolve.
  return <PageSkeleton cards={2} />;
}
