import { redirect } from "next/navigation";

/** A casa da família é o diário. */
export default function FamiliaHome() {
  redirect("/familia/diario");
}
