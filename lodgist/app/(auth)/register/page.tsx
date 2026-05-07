"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/resolver";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import {
  Loader2,
  Eye,
  EyeOff,
  UserPlus,
  Building2,
  User,
  Briefcase,
  Phone,
  Check,
  MapPin,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { getAllStateNames } from "@/lib/data/nigerianLgas";

// ─── Schema ──────────────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    name: z
      .string({ message: "Name is required" })
      .min(2, "Name must be at least 2 characters"),
    email: z
      .string({ message: "Email is required" })
      .email("Please enter a valid email"),
    password: z
      .string({ message: "Password is required" })
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string({ message: "Please confirm your password" }),
    role: z.enum(["TENANT", "LANDLORD", "AGENT"], {
      message: "Please select a role",
    }),
    phone: z.string().optional(),
    stateOfOrigin: z.string({ message: "Please select your state of origin" }),
    terms: z.literal(true, "You must accept the terms and conditions"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => {
      if (data.role === "LANDLORD" || data.role === "AGENT") {
        return !!data.phone && data.phone.length >= 7;
      }
      return true;
    },
    {
      message: "Phone number is required for landlords and agents",
      path: ["phone"],
    },
  );

type RegisterInput = z.infer<typeof registerSchema>;

// ─── Role options ─────────────────────────────────────────────────────────────

interface RoleOption {
  value: "TENANT" | "LANDLORD" | "AGENT";
  label: string;
  description: string;
  icon: React.ReactNode;
}

const roleOptions: RoleOption[] = [
  {
    value: "TENANT",
    label: "Tenant",
    description: "Looking for a place",
    icon: <User className="h-6 w-6" />,
  },
  {
    value: "LANDLORD",
    label: "Landlord",
    description: "I have property to rent",
    icon: <Building2 className="h-6 w-6" />,
  },
  {
    value: "AGENT",
    label: "Agent",
    description: "I represent properties",
    icon: <Briefcase className="h-6 w-6" />,
  },
];

// ─── State options ────────────────────────────────────────────────────────────

const NIGERIAN_STATES = getAllStateNames();

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: undefined,
      phone: "",
      stateOfOrigin: "",
      terms: false as unknown as true,
    },
  });

  const { isSubmitting } = form.formState;
  const selectedRole = form.watch("role");

  async function onSubmit(values: RegisterInput) {
    setServerError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
          role: values.role,
          phone: values.phone || undefined,
          stateOfOrigin: values.stateOfOrigin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.message ?? "Registration failed. Please try again.");
        return;
      }

      // Auto-login after successful registration
      const signInResult = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (!signInResult?.ok) {
        // Registration succeeded but auto-login failed — redirect to login
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#0B1B2B]">Create an account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join Lodgist and find your perfect property
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
            step === 1
              ? "bg-[#FF6F3C] text-white"
              : "bg-[#FF6F3C]/20 text-[#FF6F3C]",
          )}
        >
          1
        </div>
        <span
          className={cn(
            "text-xs font-medium transition-colors",
            step === 1 ? "text-[#0B1B2B]" : "text-muted-foreground",
          )}
        >
          Account
        </span>
        <div className="h-px flex-1 bg-gray-200" />
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
            step === 2
              ? "bg-[#FF6F3C] text-white"
              : "bg-gray-100 text-muted-foreground",
          )}
        >
          2
        </div>
        <span
          className={cn(
            "text-xs font-medium transition-colors",
            step === 2 ? "text-[#0B1B2B]" : "text-muted-foreground",
          )}
        >
          Profile
        </span>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {serverError}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* ── Step 1: Account ──────────────────────────────────────────── */}
          {step === 1 && (
            <>
              {/* Role Selector (card-style) */}
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>I am a...</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-3 gap-3">
                        {roleOptions.map((option) => {
                          const isSelected = field.value === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => field.onChange(option.value)}
                              className={cn(
                                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all",
                                isSelected
                                  ? "border-[#FF6F3C] bg-[#FF6F3C]/5 ring-1 ring-[#FF6F3C]/20"
                                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                              )}
                            >
                              <div
                                className={cn(
                                  "flex h-10 w-10 items-center justify-center rounded-full",
                                  isSelected
                                    ? "bg-[#FF6F3C] text-white"
                                    : "bg-gray-100 text-muted-foreground",
                                )}
                              >
                                {option.icon}
                              </div>
                              <div>
                                <p
                                  className={cn(
                                    "text-sm font-semibold",
                                    isSelected
                                      ? "text-[#FF6F3C]"
                                      : "text-[#0B1B2B]",
                                  )}
                                >
                                  {option.label}
                                </p>
                                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                                  {option.description}
                                </p>
                              </div>
                              {isSelected && (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6F3C]">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
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

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="At least 8 characters"
                          autoComplete="new-password"
                          className="pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Confirm Password */}
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Repeat your password"
                          autoComplete="new-password"
                          className="pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Next step button */}
              <Button
                type="button"
                onClick={() => setStep(2)}
                className="flex w-full items-center justify-center gap-2 bg-[#FF6F3C] py-5 text-white hover:bg-[#e85d2c]"
              >
                Next &mdash; Profile
              </Button>
            </>
          )}

          {/* ── Step 2: Profile ──────────────────────────────────────────── */}
          {step === 2 && (
            <>
              {/* Phone (Landlord/Agent only) */}
              {(selectedRole === "LANDLORD" || selectedRole === "AGENT") && (
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        Phone Number
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+234 800 000 0000"
                          autoComplete="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* State of Origin */}
              <FormField
                control={form.control}
                name="stateOfOrigin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      State of Origin
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select your state" />
                        </SelectTrigger>
                        <SelectContent>
                          {NIGERIAN_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Terms */}
              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={field.value === true}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                          className="mt-0.5"
                        />
                        <label
                          htmlFor="terms"
                          className="cursor-pointer text-sm leading-relaxed text-muted-foreground"
                          onClick={() => field.onChange(!field.value)}
                        >
                          I agree to the{" "}
                          <Link
                            href="/terms"
                            className="font-medium text-[#FF6F3C] transition-colors hover:text-[#e85d2c]"
                          >
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link
                            href="/privacy"
                            className="font-medium text-[#FF6F3C] transition-colors hover:text-[#e85d2c]"
                          >
                            Privacy Policy
                          </Link>
                        </label>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 bg-[#FF6F3C] py-5 text-white hover:bg-[#e85d2c]"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>

              {/* Back button */}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Back to account details
              </button>
            </>
          )}
        </form>
      </Form>

      {/* Login link */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-[#FF6F3C] transition-colors hover:text-[#e85d2c]"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
