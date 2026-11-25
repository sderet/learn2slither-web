import type { ReactNode } from "react";
import Document, { documentMetadata } from "../components/Document";

export const metadata = documentMetadata("en");

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <Document locale="en">{children}</Document>;
}
