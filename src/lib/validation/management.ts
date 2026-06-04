import { z } from "zod";
import { ROLES, ACCESS_TYPES } from "@/lib/constants";

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  // Only ADMIN or CUSTOMER can be created via the API.
  role: z.enum([ROLES.ADMIN, ROLES.CUSTOMER]),
  // For ADMIN: scope config. For CUSTOMER: treeIds only.
  accessType: z.enum([ACCESS_TYPES.ALL, ACCESS_TYPES.CUSTOM]).optional(),
  treeIds: z.array(z.string().trim()).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
});

export const assignTreesSchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
  accessType: z.enum([ACCESS_TYPES.ALL, ACCESS_TYPES.CUSTOM]).optional(),
  treeIds: z.array(z.string().trim()).optional(),
});

export type AssignTreesInput = z.infer<typeof assignTreesSchema>;

export const createTreeSchema = z.object({
  treeId: z.string().trim().min(1, "treeId is required"),
  name: z.string().trim().min(1, "name is required"),
  location: z.string().trim().optional(),
  lat: z.number(),
  lng: z.number(),
});
