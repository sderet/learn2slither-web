import type { ReactNode } from "react";
import Document, { documentMetadata } from "../../components/Document";

export const metadata = documentMetadata("fr");

export default function FrenchLayout({ children }: { children: ReactNode }) {
  return <Document locale="fr">{children}</Document>;
}
