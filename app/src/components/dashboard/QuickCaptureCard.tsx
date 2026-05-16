import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { QuickCaptureForm } from "./QuickCaptureForm";

export function QuickCaptureCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Capture</CardTitle>
      </CardHeader>
      <CardContent>
        <QuickCaptureForm />
      </CardContent>
    </Card>
  );
}
