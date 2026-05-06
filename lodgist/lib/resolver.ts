import { zodResolver as zodResolverOriginal } from "@hookform/resolvers/zod";
import type { Resolver, FieldValues } from "react-hook-form";
import type { z } from "zod";

/**
 * Wraps @hookform/resolvers zodResolver to work around a type mismatch
 * between @hookform/resolvers v5 and react-hook-form v7.75.0.
 *
 * The resolver types from @hookform/resolvers bundle their own copy of
 * react-hook-form's Resolver generic, which doesn't match the main
 * react-hook-form package's Resolver type. This wrapper casts through
 * `any` to bridge the incompatibility.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodResolver<T extends z.ZodType<any, any, any>>(
  schema: T,
): Resolver<z.infer<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return zodResolverOriginal(schema as any) as unknown as Resolver<z.infer<T>>;
}
