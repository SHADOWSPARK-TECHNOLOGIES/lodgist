import type { Metadata } from "next";
import CheckIntake from "@/components/rental/CheckIntake";

export const metadata: Metadata = {
  title: "Check a rental before you pay",
  description: "Found a house online? Before you send money, let Lodgist check it.",
};

export default function CheckPage() {
  return <CheckIntake />;
}
