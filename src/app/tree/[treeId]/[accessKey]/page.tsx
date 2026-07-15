import PublicTreePinGate from "@/app/components/PublicTreePinGate";

interface PageProps {
  params: Promise<{ treeId: string; accessKey: string }>;
}

export default async function PublicTreePage({ params }: PageProps) {
  const { treeId, accessKey } = await params;
  return <PublicTreePinGate treeId={treeId} accessKey={accessKey} />;
}
