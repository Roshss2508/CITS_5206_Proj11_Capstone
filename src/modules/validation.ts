import Decimal from "decimal.js";
import { z } from "zod";
import { COST_CATEGORIES } from "@/src/modules/types";

const decimalString = z.string().trim().regex(/^\d+(\.\d{1,6})?$/, "Enter a non-negative number with up to six decimal places.");
const moneyString = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a non-negative amount with up to two decimal places.");
const optionalMoney = z.union([moneyString, z.literal(""), z.null()]).optional();
const id = z.string().trim().min(1).max(80);

export const createCaseSchema = z.object({
  platformName: z.string().trim().min(2).max(120),
  pricingPeriod: z.string().trim().min(2).max(80),
});

export const updateCaseSchema = createCaseSchema.partial().extend({ currentStep: z.number().int().min(1).max(5).optional() });

export const capabilitiesSchema = z.object({
  capabilities: z.array(z.object({
    id: id.optional(),
    name: z.string().trim().min(2).max(100),
    billableUnit: z.enum(["HOUR", "DAY", "SAMPLE"]),
    active: z.boolean().default(true),
    displayOrder: z.number().int().min(0).max(99),
  })).min(1).max(20),
});

export const costsSchema = z.object({
  costs: z.array(z.object({
    id: id.optional(),
    capabilityId: id.nullable(),
    category: z.enum(COST_CATEGORIES),
    scope: z.enum(["CAPABILITY", "PLATFORM"]),
    label: z.string().trim().min(2).max(120),
    amount: moneyString,
    justification: z.string().trim().min(3).max(1000),
  })).max(200),
});

export const incomeSchema = z.object({
  income: z.array(z.object({
    id: id.optional(),
    sourceName: z.string().trim().min(2).max(120),
    sourceType: z.enum(["UWA_SUPPORT", "NON_UWA_SUPPORT"]),
    amount: moneyString,
    justification: z.string().trim().min(3).max(1000),
  })).max(100),
});

export const capacitySchema = z.object({
  capacity: z.array(z.object({
    id: id.optional(),
    capabilityId: id,
    maximumCapacity: decimalString,
    forecastUtilisationPct: decimalString.refine((value) => Number(value) <= 100, "Utilisation cannot exceed 100%."),
    historicYear1: optionalMoney,
    historicYear2: optionalMoney,
    historicYear3: optionalMoney,
    justification: z.string().trim().min(3).max(1000),
  }).refine(
    (row) => new Decimal(row.maximumCapacity).times(row.forecastUtilisationPct).greaterThan(0),
    { message: "Forecast billable units must be greater than zero. Increase maximum capacity or forecast utilisation.", path: ["forecastUtilisationPct"] },
  )).min(1).max(20),
});

export const proposedRatesSchema = z.object({
  proposedRates: z.array(z.object({
    id: id.optional(),
    capabilityId: id,
    uwaRate: optionalMoney,
    apfrRate: optionalMoney,
    commercialRate: optionalMoney,
    uwaSharePct: decimalString,
    apfrSharePct: decimalString,
    commercialSharePct: decimalString,
    justification: z.string().trim().min(3).max(1000),
  }).refine(
    (row) => new Decimal(row.uwaSharePct).plus(row.apfrSharePct).plus(row.commercialSharePct).equals(100),
    { message: "UWA, APFR and Commercial user shares must total exactly 100%.", path: ["commercialSharePct"] },
  )).min(1).max(20),
});

export const statusSchema = z.object({
  status: z.enum(["DRAFT", "READY_FOR_REVIEW", "APPROVED", "ARCHIVED"]),
  comment: z.string().trim().max(1000).default(""),
});
