import { ClientLayout } from "@/components/shared/ClientLayout";

export default function ClientRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientLayout>{children}</ClientLayout>;
}
