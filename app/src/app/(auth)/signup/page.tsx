import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { SignUpForm } from "./SignUpForm";

export const metadata = {
  title: "Sign up · ChiefOS",
};

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Single-user for now &mdash; that&apos;s you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SignUpForm />
        <p className="text-sm text-ink-3 text-center">
          Already have one?{" "}
          <Link href="/signin" className="text-teal hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
