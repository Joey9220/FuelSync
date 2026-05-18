import { Card } from "./Card";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return <Card className="text-center text-sm font-semibold text-slate-500">{label}</Card>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="text-center">
      <div className="text-lg font-black">{title}</div>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <Card className="border-red-200 bg-red-50 text-sm font-semibold text-red-700">{message}</Card>;
}
