import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-24 text-center">
      <h1 className="text-6xl font-bold">Wrong turn</h1>
      <p className="mt-3 text-gravel">That page doesn&apos;t exist, or it was moved.</p>
      <Link href="/" className="btn-dark mt-6">Go to the home page</Link>
    </div>
  );
}
