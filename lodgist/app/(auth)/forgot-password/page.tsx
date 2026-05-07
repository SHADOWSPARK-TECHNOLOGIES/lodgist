"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/resolver";
import Link from "next/link";
import { z } from "zod";
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// ─── Schema ──────────────────────────────────────────────────────────────────

const forgotPasswordSchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .email("Please enter a valid email"),
});

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [isSent, setIsSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: ForgotPasswordInput) {
    // For now, this is just UI — no email sending backend yet
    // Simulate a brief delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSent(true);
  }

  if (isSent) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#0B1B2B]">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            If an account with that email exists, we{`'`}ve sent a password
            reset link to{" "}
            <span className="font-medium text-[#0B1B2B]">
              {form.getValues("email")}
            </span>
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#FF6F3C] transition-colors hover:text-[#e85d2c]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#0B1B2B]">Forgot password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email and we{`'`}ll send you a reset link
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 bg-[#FF6F3C] py-5 text-white hover:bg-[#e85d2c]"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      </Form>

      {/* Back to login */}
      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-[#0B1B2B]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </div>
  );
}
