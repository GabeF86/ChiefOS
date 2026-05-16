import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { MfaChallengeForm } from "./MfaChallengeForm";

export const metadata = {
  title: "Verify · ChiefOS",
};

export default function MfaChallengePage({
  searchParams,
}: {
  searchParams: { factor?: string; next?: string };
}) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Two-factor code</CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MfaChallengeForm
              factorId={searchParams.factor ?? ""}
              next={searchParams.next ?? "/dashboard"}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
