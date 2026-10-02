"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@/lib/resolver";
import { Plus, Trash2, Save, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

import {
  hostelIntakeSchema,
  type HostelIntakeInput,
  PILOT_AREAS,
  NEAREST_CAMPUS,
  OPERATOR_RELATIONSHIP,
  AUTHORITY_EVIDENCE,
  ROOM_TYPES,
  OCCUPANCY_POLICY,
  POWER_SOURCE,
  WATER_SOURCE,
  LOCATION_PRECISION,
  totalKnownMoveInCost,
  formatNaira,
  verificationLabel,
} from "@/lib/validation/hostel-intake";

/* ─── Money component input ─────────────────────────────────────── */

function MoneyField({
  label,
  value,
  unknown,
  onChange,
  hint,
}: {
  label: string;
  value: number | null;
  unknown: boolean;
  onChange: (next: { amount: number | null; unknown: boolean }) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          placeholder="0"
          disabled={unknown}
          value={value ?? ""}
          onChange={(e) =>
            onChange({
              amount: e.target.value === "" ? null : Number(e.target.value),
              unknown,
            })
          }
          className="flex-1"
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
          <Checkbox
            checked={unknown}
            onCheckedChange={(c) =>
              onChange({ amount: c ? null : value, unknown: Boolean(c) })
            }
          />
          Unknown
        </label>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function HostelIntakePage() {
  const [saved, setSaved] = useState(false);

  const form = useForm<HostelIntakeInput>({
    resolver: zodResolver(hostelIntakeSchema),
    defaultValues: {
      operator: {
        name: "",
        phone: "",
        relationship: "owner",
        authorityEvidence: "none_seen",
      },
      property: {
        lodgeName: "",
        area: "Eziobodo",
        nearestCampus: "FUTO",
        walkingMinutesToGate: null,
      },
      location: { precision: "unknown", latitude: null, longitude: null },
      rooms: {
        roomTypes: ["self_contain"],
        bedsPerRoom: null,
        sharedBathroom: null,
        sharedKitchen: null,
        occupancyPolicy: "unknown",
      },
      costs: {
        rent: { amount: null, unknown: false },
        rentPeriod: "per_year",
        deposit: { amount: null, unknown: false },
        agencyFee: { amount: null, unknown: false },
        legalFee: { amount: null, unknown: false },
        serviceCharge: { amount: null, unknown: false },
        utilities: { amount: null, unknown: false },
        otherCharge: { amount: null, unknown: false },
      },
      facilities: {
        power: { status: "unknown", source: "unknown" },
        powerHoursPerDay: null,
        water: { status: "unknown", source: "unknown" },
        security: { status: "unknown" },
        wifi: { status: "unknown" },
        furnished: { status: "unknown" },
      },
      media: { photoCount: 0, publishPermission: false },
      listing: {
        origin: "direct_submission",
        publication: "draft",
        availability: "unknown",
        verification: "not_checked",
        actionEligibility: "enquiry",
      },
      reviewer: { visitedBy: "", visitedOn: new Date().toISOString().slice(0, 10) },
    },
  });

  const costs = form.watch("costs");
  const listing = form.watch("listing");
  const totals = totalKnownMoveInCost(costs);

  const onSubmit = (data: HostelIntakeInput) => {
    // Persist locally until the API route exists — the visit data must not be
    // lost if the agent is offline in Eziobodo.
    const key = `lodgist-intake-${Date.now()}`;
    try {
      localStorage.setItem(key, JSON.stringify(data));
      setSaved(true);
    } catch {
      // Storage full or unavailable — surface rather than silently drop.
      alert("Could not save locally. Copy the values before leaving this page.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Hostel intake</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill this in during the operator visit. Everything here comes from what the
          operator told you — mark anything they did not state as Unknown.
        </p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Operator ── */}
          <Card>
            <CardHeader>
              <CardTitle>Operator</CardTitle>
              <CardDescription>Who is advertising, and what authority they showed.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="operator.name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Operator full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="operator.phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+234 800 000 0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="operator.relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship to property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {OPERATOR_RELATIONSHIP.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="operator.authorityEvidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Authority evidence seen</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AUTHORITY_EVIDENCE.map((e) => (
                          <SelectItem key={e} value={e}>
                            {e.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Note what you saw. Do not photograph sensitive documents.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Property ── */}
          <Card>
            <CardHeader>
              <CardTitle>Property</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="property.lodgeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lodge name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Ace Lodge" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="property.area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PILOT_AREAS.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="property.nearestCampus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nearest campus</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NEAREST_CAMPUS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="property.walkingMinutesToGate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Walking minutes to gate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="As stated by operator"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="property.landmark"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Landmark</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. opposite Nkwo Ukwu market" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Location precision ── */}
          <Card>
            <CardHeader>
              <CardTitle>Location precision</CardTitle>
              <CardDescription>
                Never publish an invented precise pin. If you did not drop a pin, leave this
                unknown.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="location.precision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precision</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LOCATION_PRECISION.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location.latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="Optional"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location.longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="Optional"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Rooms ── */}
          <Card>
            <CardHeader>
              <CardTitle>Rooms</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="rooms.roomTypes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Room types available</FormLabel>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ROOM_TYPES.map((rt) => {
                        const checked = field.value?.includes(rt) ?? false;
                        return (
                          <label
                            key={rt}
                            className="flex items-center gap-2 rounded-md border p-2 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                const next = c
                                  ? [...(field.value ?? []), rt]
                                  : (field.value ?? []).filter((v) => v !== rt);
                                field.onChange(next);
                              }}
                            />
                            {rt.replace(/_/g, " ")}
                          </label>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rooms.bedsPerRoom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beds per room</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="As stated"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rooms.occupancyPolicy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Occupancy policy</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {OCCUPANCY_POLICY.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Costs ── */}
          <Card>
            <CardHeader>
              <CardTitle>Cost components</CardTitle>
              <CardDescription>
                Keep every charge separate. Mark anything the operator did not state as
                Unknown — do not estimate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="costs.rentPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rent period</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="per_year">Per year</SelectItem>
                        <SelectItem value="per_session">Per session</SelectItem>
                        <SelectItem value="per_month">Per month</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Monthly and annual rents are not comparable — this must be explicit.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["rent", "Rent"],
                    ["deposit", "Deposit"],
                    ["agencyFee", "Agency fee"],
                    ["legalFee", "Legal / agreement fee"],
                    ["serviceCharge", "Service charge"],
                    ["utilities", "Utilities"],
                    ["otherCharge", "Other disclosed charge"],
                  ] as const
                ).map(([key, label]) => (
                  <FormField
                    key={key}
                    control={form.control}
                    name={`costs.${key}` as const}
                    render={({ field }) => (
                      <FormItem>
                        <MoneyField
                          label={label}
                          value={field.value?.amount ?? null}
                          unknown={field.value?.unknown ?? false}
                          onChange={(next) =>
                            field.onChange({ ...field.value, ...next })
                          }
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total known move-in cost</span>
                  <span className="font-medium">{formatNaira(totals.knownTotal)}</span>
                </div>
                {!totals.isComplete && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {totals.unknownCount} component
                    {totals.unknownCount === 1 ? "" : "s"} unknown — this total is
                    incomplete.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Facilities ── */}
          <Card>
            <CardHeader>
              <CardTitle>Facilities</CardTitle>
              <CardDescription>
                Record what the operator claimed, not what you assume.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="facilities.power.source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Power source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {POWER_SOURCE.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="facilities.powerHoursPerDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Power hours per day (claimed)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={24}
                        placeholder="0–24"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="facilities.water.source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Water source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WATER_SOURCE.map((w) => (
                          <SelectItem key={w} value={w}>
                            {w}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="facilities.security.hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Security hours (claimed)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 6pm–6am" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="facilities.wifi.provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WiFi provider (claimed)</FormLabel>
                    <FormControl>
                      <Input placeholder="Leave blank if none" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="facilities.furnished.includes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Furnished — what's included</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. bed, wardrobe, fan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Media ── */}
          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="media.photoCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photos captured</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value || 0))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="media.publishPermission"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 rounded-md border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(c) => field.onChange(Boolean(c))}
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="cursor-pointer">
                        Operator gave permission to publish photos
                      </FormLabel>
                      <FormDescription>
                        Without this, the listing cannot carry their images.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Listing state ── */}
          <Card>
            <CardHeader>
              <CardTitle>Listing state</CardTitle>
              <CardDescription>
                Verification starts at not_checked and only a reviewer decision moves it.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="listing.availability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Availability</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unknown">Unknown</SelectItem>
                        <SelectItem value="reported_available">Reported available</SelectItem>
                        <SelectItem value="recently_confirmed">Recently confirmed</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="listing.actionEligibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action eligibility</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="source_link_only">Source link only</SelectItem>
                        <SelectItem value="enquiry">Enquiry</SelectItem>
                        <SelectItem value="viewing_request">Viewing request</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2 rounded-md border bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">Public label: </span>
                <span className="font-medium">{verificationLabel(listing.verification)}</span>
              </div>
            </CardContent>
          </Card>

          {/* ── Reviewer ── */}
          <Card>
            <CardHeader>
              <CardTitle>Visit record</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="reviewer.visitedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visited by</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reviewer.visitedOn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visit date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reviewer.notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="Anything the operator said that doesn't fit a field above."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button type="submit" className="gap-2">
              <Save className="h-4 w-4" />
              Save intake
            </Button>
            {saved && (
              <span className="text-sm text-emerald-600">
                Saved locally. Export before clearing browser data.
              </span>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
