export const HOTEL_MAXIMUM_PETS = 30 as const;
export const DEPOSIT_PERCENT = 50 as const;
export const HOURLY_MAXIMUM_HOURS = 6 as const;

export type RoomType = "condo" | "villa" | "reserve";
export type RatePlanCode = "HOURLY" | "HOTEL_SUPPLIED" | "OWNER_SUPPLIED";

export interface PriceQuoteInput {
  ratePlan: RatePlanCode;
  petCount: number;
  nights?: number;
}

const pricePerPet: Record<RatePlanCode, number> = {
  HOURLY: 100,
  HOTEL_SUPPLIED: 250,
  OWNER_SUPPLIED: 150
};

export function calculateQuote(input: PriceQuoteInput): number {
  if (!Number.isInteger(input.petCount) || input.petCount < 1) {
    throw new Error("petCount must be a positive integer");
  }
  const units = input.ratePlan === "HOURLY" ? 1 : input.nights;
  if (!units || !Number.isInteger(units) || units < 1) {
    throw new Error("nights must be a positive integer for overnight bookings");
  }
  return pricePerPet[input.ratePlan] * input.petCount * units;
}

export function calculateDeposit(totalAmount: number): number {
  if (totalAmount < 0) throw new Error("totalAmount cannot be negative");
  return Math.round(totalAmount * (DEPOSIT_PERCENT / 100) * 100) / 100;
}

export function isHotelCapacityAvailable(occupiedPets: number, requestedPets: number): boolean {
  return occupiedPets >= 0 && requestedPets > 0 &&
    occupiedPets + requestedPets <= HOTEL_MAXIMUM_PETS;
}
