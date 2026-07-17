/**
 * Client-side Zod schemas mirroring API constraints.
 * Used with react-hook-form + zodResolver until the SPA can import api-zod directly.
 */
import { z } from "zod";
import { COUNTRY_CODES, CURRENCIES, LOCALES } from "./markets";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  /** Empty password continues to account creation. */
  password: z.string().optional().default(""),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
  firstName: z.string().trim().max(80).optional().or(z.literal("")),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || v.replace(/\s/g, "").length >= 9, {
      message: "Phone must be at least 9 digits",
    }),
  countryCode: z.enum(COUNTRY_CODES),
  preferredCurrency: z.enum(CURRENCIES),
  locale: z.enum(LOCALES),
});
export type SignupFormValues = z.infer<typeof signupSchema>;

export const profileSchema = z.object({
  firstName: z.string().trim().max(80).optional().or(z.literal("")),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || v.replace(/\s/g, "").length >= 9, {
      message: "Phone must be at least 9 digits",
    }),
  countryCode: z.enum(COUNTRY_CODES),
  preferredCurrency: z.enum(CURRENCIES),
  locale: z.enum(LOCALES),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional().or(z.literal("")),
  fullName: z.string().trim().min(1, "Full name is required"),
  phone: z
    .string()
    .trim()
    .min(9, "Phone must be at least 9 digits")
    .refine((v) => v.replace(/\D/g, "").length >= 9, {
      message: "Enter a valid phone number",
    }),
  line1: z.string().trim().min(1, "Street address is required"),
  city: z.string().trim().min(1, "City is required"),
  region: z.string().trim().max(80).optional().or(z.literal("")),
  digitalAddress: z.string().trim().max(40).optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
});
export type AddressFormSchemaValues = z.infer<typeof addressSchema>;

export const vendorShopSchema = z.object({
  name: z.string().trim().min(2, "Store name is required").max(120),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type VendorShopFormValues = z.infer<typeof vendorShopSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const assignRoleSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["buyer", "vendor_owner", "vendor_staff", "admin", "support_agent"]),
  vendorId: z.coerce.number().int().positive().optional().nullable(),
});
export type AssignRoleFormValues = z.infer<typeof assignRoleSchema>;
