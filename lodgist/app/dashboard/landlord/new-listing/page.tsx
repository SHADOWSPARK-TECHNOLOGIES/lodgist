"use client";

import React, { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/resolver";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Upload,
  X,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  propertyCreateSchema,
  NIGERIAN_STATES,
  PROPERTY_TYPES,
  AMENITIES,
  type PropertyCreateInput,
} from "@/lib/validation/property";

/* ─── Image Preview Component ──────────────────────────────────── */

function ImagePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(() =>
    URL.createObjectURL(file),
  );

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
    // Only run cleanup on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
      {preview ? (
        <img
          src={preview}
          alt={file.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive/80 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
      <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 text-[10px] text-white">
        {(file.name ?? "").length > 12 ? (file.name ?? "").slice(0, 10) + "…" : file.name}
      </span>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */

export default function NewListingPage() {
  const router = useRouter();
  const [images, setImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const form = useForm<PropertyCreateInput>({
    resolver: zodResolver(propertyCreateSchema),
    defaultValues: {
      title: "",
      description: "",
      address: "",
      city: "",
      state: undefined,
      lga: "",
      propertyType: undefined,
      price: undefined,
      bedrooms: undefined,
      bathrooms: undefined,
      amenities: [],
      images: [],
    },
  });

  const watchedType = form.watch("propertyType");
  const showResidentialFields =
    watchedType === "apartment" || watchedType === "house";

  /* ─── Image handlers ─────────────────────────────────────────── */

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      const remaining = 10 - images.length;
      setImages((prev) => [...prev, ...files.slice(0, remaining)].slice(0, 10));
      // Reset input so re-selecting same file triggers onChange
      e.target.value = "";
    },
    [images.length]
  );

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ─── Submit ─────────────────────────────────────────────────── */

  async function onSubmit(values: PropertyCreateInput) {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      // Build FormData for multipart upload
      const formData = new FormData();
      formData.append("title", values.title);
      formData.append("description", values.description);
      formData.append("address", values.address);
      formData.append("city", values.city);
      formData.append("state", values.state);
      formData.append("lga", values.lga);
      formData.append("propertyType", values.propertyType);
      formData.append("price", String(values.price));

      if (values.bedrooms !== undefined) {
        formData.append("bedrooms", String(values.bedrooms));
      }
      if (values.bathrooms !== undefined) {
        formData.append("bathrooms", String(values.bathrooms));
      }
      if (values.amenities && values.amenities.length > 0) {
        formData.append("amenities", JSON.stringify(values.amenities));
      }

      // Append image files
      for (const file of images) {
        formData.append("images", file);
      }

      // ownerId is set server-side from the session — not sent from the client

      const res = await fetch("/api/properties", {
        method: "POST",
        // Do NOT set Content-Type — browser sets it with boundary for FormData
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.message ?? `Server responded with ${res.status}`
        );
      }

      setSubmitSuccess(true);
      // Redirect after short delay
      setTimeout(() => router.push("/dashboard/landlord"), 1500);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create New Listing</CardTitle>
          <CardDescription>
            Fill in the details below to list your property. All fields marked
            with * are required.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-8"
              noValidate
            >
              {/* ── Title ── */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Title <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 3-Bedroom Flat in GRA"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Description ── */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Description <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the property in detail…"
                        className="min-h-32"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Property Type + Price ── */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="propertyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Property Type <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select type…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {PROPERTY_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t.charAt(0).toUpperCase() + (t ?? "").slice(1)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Price (NGN) <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="1000"
                          placeholder="500000"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
                                : e.target.value
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ── Bedrooms / Bathrooms (conditional) ── */}
              {showResidentialFields && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bedrooms</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            placeholder="3"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ""
                                  ? undefined
                                  : e.target.value
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bathrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bathrooms</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            placeholder="2"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ""
                                  ? undefined
                                  : e.target.value
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* ── Location ── */}
              <fieldset className="rounded-lg border border-border p-4">
                <legend className="px-2 text-sm font-semibold text-foreground">
                  Location
                </legend>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          State <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select state…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {NIGERIAN_STATES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lga"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          LGA <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Ikeja" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          City <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Lagos" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Address <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="123 Main Street, GRA"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </fieldset>

              {/* ── Amenities ── */}
              <FormField
                control={form.control}
                name="amenities"
                render={() => (
                  <FormItem>
                    <FormLabel>Amenities</FormLabel>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {AMENITIES.map((amenity) => {
                        const currentAmenities =
                          form.watch("amenities") ?? [];
                        const checked = currentAmenities.includes(amenity);
                        return (
                          <label
                            key={amenity}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-primary/5"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(chk) => {
                                const next = chk
                                  ? [...currentAmenities, amenity]
                                  : currentAmenities.filter(
                                      (a) => a !== amenity
                                    );
                                form.setValue("amenities", next);
                              }}
                            />
                            {amenity}
                          </label>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Image Upload ── */}
              <FormItem>
                <FormLabel>Images (max 10)</FormLabel>
                <FormControl>
                  <div className="space-y-3">
                    {/* Upload button */}
                    <Label
                      htmlFor="image-upload"
                      className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <Upload className="h-5 w-5" />
                      <span>
                        {images.length === 0
                          ? "Click to upload images"
                          : `Add more images (${images.length}/10)`}
                      </span>
                    </Label>
                    <Input
                      id="image-upload"
                      type="file"
                      multiple
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/avif"
                      className="hidden"
                      onChange={handleImageSelect}
                      disabled={images.length >= 10}
                    />

                    {/* Preview grid */}
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {images.map((file, i) => (
                          <ImagePreview
                            key={`${file.name}-${i}`}
                            file={file}
                            onRemove={() => removeImage(i)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>

              {/* ── Submit Error ── */}
              {submitError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </div>
              )}

              {/* ── Success ── */}
              {submitSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-teal/50 bg-teal/10 p-3 text-sm text-teal">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Listing created successfully! Redirecting…
                </div>
              )}

              {/* ── Actions ── */}
              <CardFooter className="flex justify-end gap-3 px-0 pb-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    "Create Listing"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
