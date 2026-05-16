import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SignInForm } from "./SignInForm";

export const metadata = {
  title: "Sign in · ChiefOS",
};

export default function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string; sent?: string };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SignInForm
          next={searchParams.next}
          initialError={searchParams.error}
          magicLinkSent={searchParams.sent === "1"}
        />
        <p className="text-sm text-ink-3 text-center">
          No account?{" "}
          <Link href="/signup" className="text-teal hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
