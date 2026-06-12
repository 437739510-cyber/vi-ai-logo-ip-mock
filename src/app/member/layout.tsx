import { MemberLayout } from "@/components/shared/MemberLayout";

export default function MemberRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MemberLayout>{children}</MemberLayout>;
}
