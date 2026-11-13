export type Role = "user" | "admin";
export type ListingStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type ChangeType = "maintenance" | "modification" | "accident";

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  contact_number: string;
  region: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface CarModel {
  id: number;
  make: string;
  model: string;
  variant: string | null;
  body_type: string;
  transmission: string;
  drivetrain: string;
  fuel_type: string;
  year: number;
  retail_srp: number;
}

export interface CarPart {
  id: number;
  brand: string;
  name: string;
  model_number: string | null;
  category: string;
  srp: number;
}

export interface Options {
  body_types: string[];
  transmissions: string[];
  drivetrains: string[];
  fuel_types: string[];
  part_categories: string[];
  regions: string[];
  change_types: ChangeType[];
}

export interface Image {
  id: number;
  url: string;
}

export interface Vehicle {
  id: number;
  car: CarModel;
  trim: string | null;
  color: string;
  plate_ending: string;
  mileage_km: number;
  images: Image[];
  listing: { id: number; status: ListingStatus; asking_price: number; description: string; review_note: string | null } | null;
  total_spent: number;
  log_count: number;
  created_at: string;
}

export interface LogEntry {
  id: number;
  vehicle_id: number;
  change_type: ChangeType;
  details: string;
  cost: number;
  mileage_km: number | null;
  performed_on: string;
  images: Image[];
}

export interface Listing {
  id: number;
  status: ListingStatus;
  asking_price: number;
  description: string;
  review_note: string | null;
  created_at: string;
  vehicle: Vehicle;
  seller: { first_name: string; region: string | null; contact_number: string | null; email: string | null };
  logs: { change_type: ChangeType; details: string; cost: number; mileage_km: number | null; performed_on: string }[];
}

export interface ListingPage {
  items: Listing[];
  total: number;
  page: number;
  page_size: number;
}

export interface Prediction {
  make: string;
  model: string;
  modification_type: string | null;
  parts: string[];
  months: number;
  base_price: number;
  parts_cost: number;
  current_total: number;
  predicted_price: number;
  formula_price: number;
  monthly_inflation_rate: number;
  projection: { month: number; value: number }[];
}

export interface CountItem {
  label: string;
  count: number;
}

export interface Analytics {
  totals: Record<string, number>;
  by_make: CountItem[];
  by_body_type: CountItem[];
  by_fuel_type: CountItem[];
  by_year: CountItem[];
  listings_by_status: CountItem[];
}
